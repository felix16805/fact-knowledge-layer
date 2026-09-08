import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { RegisterDocumentSchema } from "@/lib/validators";
import { enqueueDocumentProcessing } from "@/pipeline/job-queue";

export const runtime = "nodejs";

/**
 * POST /api/documents
 * Register a document row after the browser has uploaded to Storage.
 * Body: { storagePath, filename }
 *
 * Three-step idempotency:
 * 1. Validate storagePath format (must match server-issued pattern)
 * 2. Storage existence check (reject if file not actually there)
 * 3. ON CONFLICT (storage_path) DO NOTHING — returns existing row, no re-enqueue
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = RegisterDocumentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const { storagePath, filename } = parsed.data;
  const supabase = await createAdminClient();

  // ── Storage existence check ────────────────────────────────────────────
  // Prevents fabricated paths from creating rows guaranteed to fail processing
  const { error: headError } = await supabase.storage
    .from("pdfs")
    .download(storagePath);
  // Note: Supabase JS v2 doesn't expose a HEAD method; download is used to check existence.
  // For large files this downloads the full blob — acceptable for a prototype.
  // Production: use a ranged GET (bytes=0-0) via a direct fetch to the signed URL.
  if (headError) {
    return NextResponse.json(
      { error: "File not found in storage. Upload it first." },
      { status: 400 }
    );
  }

  // ── Idempotent insert ──────────────────────────────────────────────────
  const { data: inserted, error: insertError } = await supabase
    .from("documents")
    .insert({ storage_path: storagePath, filename, status: "pending" })
    .select()
    .maybeSingle();

  if (insertError) {
    // Check for UNIQUE constraint violation (duplicate storage_path)
    if (insertError.code === "23505") {
      // Row already exists — return it without re-enqueuing
      const { data: existing } = await supabase
        .from("documents")
        .select()
        .eq("storage_path", storagePath)
        .single();
      return NextResponse.json(existing, { status: 200 });
    }
    console.error("[documents POST] Insert error:", insertError.message);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  if (!inserted) {
    // Shouldn't happen, but guard anyway
    const { data: existing } = await supabase
      .from("documents")
      .select()
      .eq("storage_path", storagePath)
      .single();
    return NextResponse.json(existing, { status: 200 });
  }

  // ── Enqueue processing job ─────────────────────────────────────────────
  // We use Next.js's after() to run this in the background *after* the HTTP response
  // is sent, ensuring Vercel doesn't freeze the serverless function mid-execution.
  after(async () => {
    try {
      await enqueueDocumentProcessing(inserted.id);
    } catch (err) {
      console.error("[documents POST] Background processing error:", err);
      // Fallback: update status to failed if it blows up synchronously
      await supabase
        .from("documents")
        .update({ status: "failed", error_message: "Background processing crashed" })
        .eq("id", inserted.id);
    }
  });

  return NextResponse.json(inserted, { status: 201 });
}

/**
 * GET /api/documents
 * List all documents with their status, ordered by upload date.
 */
export async function GET() {
  const supabase = await createAdminClient();

  const { data, error } = await supabase
    .from("documents")
    .select(
      `id, filename, storage_path, uploaded_at, status, page_count, error_message,
       facts:facts(count),
       relationships:fact_relationships(count)`
    )
    .order("uploaded_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Failed to fetch documents" }, { status: 500 });
  }

  return NextResponse.json(data);
}
