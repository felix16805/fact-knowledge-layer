import { createClient } from "@supabase/supabase-js";
import { extractFacts } from "./fact-extractor";
import { embedFacts, type FactForEmbedding } from "./embedder";
import { classifyRelationship, type FactForClassification } from "./relationship-classifier";


// Cosine similarity threshold for candidate pair matching.
const SIMILARITY_THRESHOLD = 0.82;

// Max candidate pairs to classify per new fact
const MAX_CANDIDATES_PER_FACT = 10;

// Concurrency limit for chunk extraction — respects Gemini free-tier RPM
const CHUNK_BATCH_SIZE = 3;

// Max characters per chunk — prevents feeding huge pages to Gemini in one shot
const MAX_CHUNK_CHARS = 3000;

interface Chunk {
  id: string;
  page_number: number;
  chunk_type: "text" | "table" | "slide";
  raw_text: string;
}

/**
 * Split a page's text into chunks of at most MAX_CHUNK_CHARS characters,
 * splitting on paragraph breaks where possible.
 */
function splitPageIntoChunks(text: string, pageNumber: number): Array<{
  page_number: number;
  chunk_type: "text";
  raw_text: string;
}> {
  const paragraphs = text.split(/\n{2,}/);
  const chunks: Array<{ page_number: number; chunk_type: "text"; raw_text: string }> = [];
  let current = "";

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    if ((current + "\n\n" + trimmed).length > MAX_CHUNK_CHARS && current.length > 0) {
      chunks.push({ page_number: pageNumber, chunk_type: "text", raw_text: current.trim() });
      current = trimmed;
    } else {
      current = current ? current + "\n\n" + trimmed : trimmed;
    }
  }

  if (current.trim().length >= 20) {
    chunks.push({ page_number: pageNumber, chunk_type: "text", raw_text: current.trim() });
  }

  return chunks;
}

/**
 * Main pipeline orchestrator for a single document.
 * Called directly from POST /api/documents (no queue).
 */
export async function processDocument({
  data,
}: {
  data: { documentId: string };
}): Promise<void> {
  const { documentId } = data;
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  console.log(`[pipeline] Starting document ${documentId}`);

  try {
    // ── 1. Mark as processing ──────────────────────────────────────────────
    await supabase
      .from("documents")
      .update({ status: "processing" })
      .eq("id", documentId);

    // ── 2. Fetch document metadata ─────────────────────────────────────────
    const { data: doc, error: docError } = await supabase
      .from("documents")
      .select("id, filename, storage_path")
      .eq("id", documentId)
      .single();

    if (docError || !doc) {
      throw new Error(`Document not found: ${documentId}`);
    }

    // ── 3. Fetch PDF from Supabase Storage ─────────────────────────────────
    const { data: fileData, error: fileError } = await supabase.storage
      .from("pdfs")
      .download(doc.storage_path);

    if (fileError || !fileData) {
      throw new Error(`Failed to download PDF: ${fileError?.message}`);
    }

    const pdfBuffer = Buffer.from(await fileData.arrayBuffer());

    // ── 4. Parse PDF with pdf-parse (pure Node.js, no Python sidecar) ──────
    // Require pdf-parse at call-time so Next.js webpack doesn't bundle it
    // (pdf-parse is listed in serverExternalPackages in next.config.ts)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParseFn = require("pdf-parse") as (
      buf: Buffer
    ) => Promise<{ text: string; numpages: number }>;

    const parsed = await pdfParseFn(pdfBuffer);
    const fullText = parsed.text;
    const pageCount = parsed.numpages || 1;

    // pdf-parse returns all text concatenated — split into pseudo-pages by
    // dividing total text evenly across page count for chunk labelling.
    const charsPerPage = Math.ceil(fullText.length / pageCount);
    const pageTexts: string[] = [];
    for (let p = 0; p < pageCount; p++) {
      pageTexts.push(fullText.slice(p * charsPerPage, (p + 1) * charsPerPage));
    }

    // ── 5. Split pages into chunks ─────────────────────────────────────────
    const rawChunks: Array<{
      page_number: number;
      chunk_type: "text";
      raw_text: string;
    }> = [];

    pageTexts.forEach((text, idx) => {
      const pageChunks = splitPageIntoChunks(text, idx + 1);
      rawChunks.push(...pageChunks);
    });

    console.log(
      `[pipeline] Parsed ${pageCount} pages → ${rawChunks.length} chunks`
    );

    if (rawChunks.length === 0) {
      await supabase
        .from("documents")
        .update({ status: "ready", page_count: pageCount })
        .eq("id", documentId);
      return;
    }

    // ── 6. Store chunks ────────────────────────────────────────────────────
    const { data: storedChunks, error: chunkError } = await supabase
      .from("chunks")
      .insert(
        rawChunks.map((c) => ({
          document_id: documentId,
          page_number: c.page_number,
          chunk_type: c.chunk_type,
          raw_text: c.raw_text,
          bbox: null,
        }))
      )
      .select("id, page_number, chunk_type, raw_text");

    if (chunkError || !storedChunks) {
      throw new Error(`Failed to store chunks: ${chunkError?.message}`);
    }

    await supabase
      .from("documents")
      .update({ page_count: pageCount })
      .eq("id", documentId);

    // ── 7. Extract facts per chunk (batched for rate limit) ────────────────
    const allNewFacts: Array<{
      document_id: string;
      source_chunk_id: string;
      subject: string;
      metric: string;
      value: unknown;
      unit: string | null;
      time_scope: string | null;
      doc_scope: string | null;
      qualifiers: unknown;
      quoted_evidence: string;
      confidence: number;
      page_number: number;
    }> = [];

    for (let i = 0; i < storedChunks.length; i += CHUNK_BATCH_SIZE) {
      const batch = storedChunks.slice(i, i + CHUNK_BATCH_SIZE) as Chunk[];
      const batchResults = await Promise.all(
        batch.map(async (chunk) => {
          const facts = await extractFacts(chunk);
          return facts.map((f) => ({
            document_id: documentId,
            source_chunk_id: chunk.id,
            subject: f.subject,
            metric: f.metric,
            value: f.value,
            unit: f.unit,
            time_scope: f.time_scope,
            doc_scope: f.doc_scope,
            qualifiers: f.qualifiers,
            quoted_evidence: f.quoted_evidence,
            confidence: f.confidence,
            page_number: chunk.page_number,
          }));
        })
      );
      allNewFacts.push(...batchResults.flat());
    }

    console.log(`[pipeline] Extracted ${allNewFacts.length} facts`);

    if (allNewFacts.length === 0) {
      await supabase
        .from("documents")
        .update({ status: "ready" })
        .eq("id", documentId);
      return;
    }

    // ── 8. Embed all new facts ─────────────────────────────────────────────
    const embedInputs: FactForEmbedding[] = allNewFacts.map((f) => ({
      subject: f.subject,
      metric: f.metric,
      value: f.value,
      time_scope: f.time_scope,
      doc_scope: f.doc_scope,
    }));

    const embeddings = await embedFacts(embedInputs);

    // ── 9. Insert facts with embeddings ────────────────────────────────────
    const { data: storedFacts, error: factError } = await supabase
      .from("facts")
      .insert(
        allNewFacts.map((f, idx) => ({
          document_id: f.document_id,
          source_chunk_id: f.source_chunk_id,
          subject: f.subject,
          metric: f.metric,
          value: f.value,
          unit: f.unit,
          time_scope: f.time_scope,
          doc_scope: f.doc_scope,
          qualifiers: f.qualifiers,
          quoted_evidence: f.quoted_evidence,
          confidence: f.confidence,
          embedding: `[${embeddings[idx].join(",")}]`,
        }))
      )
      .select("id, subject, metric, value, time_scope, doc_scope, qualifiers, quoted_evidence");

    if (factError || !storedFacts) {
      throw new Error(`Failed to store facts: ${factError?.message}`);
    }

    // ── 10. Vector-search for candidate pairs from OTHER documents ──────────
    const relationships: Array<{
      fact_a_id: string;
      fact_b_id: string;
      relationship_type: string;
      reasoning: string;
      reconciling_factor: string | null;
      confidence: number;
    }> = [];

    for (let i = 0; i < storedFacts.length; i++) {
      const newFact = storedFacts[i];
      const embedding = embeddings[i];
      const newFactDocInfo = allNewFacts[i];

      const { data: candidates } = await supabase.rpc("find_similar_facts", {
        query_embedding: `[${embedding.join(",")}]`,
        exclude_document_id: documentId,
        similarity_threshold: SIMILARITY_THRESHOLD,
        max_results: MAX_CANDIDATES_PER_FACT,
      });

      if (!candidates || candidates.length === 0) continue;

      const candidateIds = candidates.map((c: { id: string }) => c.id);
      const { data: candidateFacts } = await supabase
        .from("facts")
        .select(
          `id, subject, metric, value, unit, time_scope, doc_scope, qualifiers, quoted_evidence,
           source_chunk:chunks!source_chunk_id(page_number),
           document:documents!document_id(filename)`
        )
        .in("id", candidateIds);

      if (!candidateFacts) continue;

      for (const candidate of candidateFacts) {
        const factAId = newFact.id;
        const factBId = candidate.id;

        const [orderedA, orderedB] =
          factAId < factBId ? [factAId, factBId] : [factBId, factAId];

        const { count } = await supabase
          .from("fact_relationships")
          .select("id", { count: "exact", head: true })
          .eq("fact_a_id", orderedA)
          .eq("fact_b_id", orderedB);

        if (count && count > 0) continue;

        const factAForClassification: FactForClassification = {
          id: newFact.id,
          subject: newFact.subject,
          metric: newFact.metric,
          value: newFact.value,
          unit: null,
          time_scope: newFact.time_scope,
          doc_scope: newFact.doc_scope,
          qualifiers: null,
          quoted_evidence: newFact.quoted_evidence,
          document_filename: doc.filename,
          page_number: newFactDocInfo.page_number,
        };

        const factBForClassification: FactForClassification = {
          id: candidate.id,
          subject: candidate.subject,
          metric: candidate.metric,
          value: candidate.value,
          unit: candidate.unit,
          time_scope: candidate.time_scope,
          doc_scope: candidate.doc_scope,
          qualifiers: candidate.qualifiers,
          quoted_evidence: candidate.quoted_evidence,
          document_filename:
            (candidate.document as unknown as { filename: string } | null)?.filename ?? "unknown",
          page_number:
            (candidate.source_chunk as unknown as { page_number: number } | null)?.page_number ?? 0,
        };

        const result = await classifyRelationship(
          factAForClassification,
          factBForClassification
        );

        relationships.push({
          fact_a_id: orderedA,
          fact_b_id: orderedB,
          relationship_type: result.type,
          reasoning: result.reasoning,
          reconciling_factor:
            result.type === "reconcilable" ? result.reconciling_factor : null,
          confidence: result.confidence,
        });
      }
    }

    // ── 11. Persist relationships ───────────────────────────────────────────
    if (relationships.length > 0) {
      const { error: relError } = await supabase
        .from("fact_relationships")
        .upsert(relationships, { onConflict: "fact_a_id,fact_b_id" });

      if (relError) {
        console.error("[pipeline] Failed to store relationships:", relError.message);
      }
    }

    console.log(
      `[pipeline] Done: ${storedFacts.length} facts, ${relationships.length} relationships`
    );

    // ── 12. Mark ready ─────────────────────────────────────────────────────
    await supabase
      .from("documents")
      .update({ status: "ready" })
      .eq("id", documentId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[pipeline] Failed document ${documentId}:`, message);

    await supabase
      .from("documents")
      .update({ status: "failed", error_message: message })
      .eq("id", documentId);

    throw err;
  }
}
