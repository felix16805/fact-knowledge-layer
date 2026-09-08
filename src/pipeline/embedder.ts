import { VoyageAIClient } from "voyageai";

const voyage = new VoyageAIClient({ apiKey: process.env.VOYAGE_API_KEY });

export interface FactForEmbedding {
  subject: string;
  metric: string;
  value: unknown;
  time_scope?: string | null;
  doc_scope?: string | null;
}

/**
 * Embed a single fact using Voyage AI voyage-4 (1024-dim).
 *
 * Canonical serialization combines the structured fields into a
 * human-readable string — this is what gets embedded, not raw JSON.
 * Consistent serialization is critical: the same fact must always
 * produce the same embedding for vector-search to be reproducible.
 */
export async function embedFact(fact: FactForEmbedding): Promise<number[]> {
  const text = [
    fact.subject,
    fact.metric,
    JSON.stringify(fact.value),
    fact.time_scope ?? "",
    fact.doc_scope ?? "",
  ].join(" | ");

  const res = await voyage.embed({
    input: [text],
    model: "voyage-4",
  });

  const embedding = res.data?.[0]?.embedding;
  if (!embedding || embedding.length !== 1024) {
    throw new Error(
      `[embedder] Expected 1024-dim embedding, got ${embedding?.length ?? 0}`
    );
  }

  return embedding;
}

/**
 * Batch embed multiple facts efficiently.
 * Voyage allows up to 128 inputs per request — batches in groups of 64
 * to stay comfortably within limits.
 */
export async function embedFacts(
  facts: FactForEmbedding[]
): Promise<number[][]> {
  const BATCH_SIZE = 64;
  const results: number[][] = [];

  for (let i = 0; i < facts.length; i += BATCH_SIZE) {
    const batch = facts.slice(i, i + BATCH_SIZE);
    const texts = batch.map((f) =>
      [
        f.subject,
        f.metric,
        JSON.stringify(f.value),
        f.time_scope ?? "",
        f.doc_scope ?? "",
      ].join(" | ")
    );

    const res = await voyage.embed({ input: texts, model: "voyage-4" });
    const embeddings = (res.data?.map((d) => d.embedding) ?? []).filter(
      (e): e is number[] => e !== undefined
    );

    if (embeddings.length !== batch.length) {
      throw new Error(
        `[embedder] Batch mismatch: sent ${batch.length}, got ${embeddings.length}`
      );
    }

    results.push(...embeddings);
  }

  return results;
}
