import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { enqueueDocumentProcessing } from "@/pipeline/job-queue";

export const runtime = "nodejs";

/**
 * POST /api/documents/[id]/process
 * Re-trigger pipeline for a failed or stuck document.
 * Rate-limited: same 5/IP/10min budget as upload-url (same LLM-spend vector).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // ── Rate limiting ──────────────────────────────────────────────────────
  const ip = getClientIp(req.headers);
  const { allowed } = await checkRateLimit(ip, "reprocess");
  if (!allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again in a few minutes." },
      { status: 429 }
    );
  }

  const supabase = await createAdminClient();

  // ── Fetch document ─────────────────────────────────────────────────────
  const { data: doc, error } = await supabase
    .from("documents")
    .select("id, status")
    .eq("id", id)
    .single();

  if (error || !doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  // Only allow re-processing of failed documents (or pending stuck ones)
  if (doc.status === "processing") {
    return NextResponse.json(
      { error: "Document is already being processed" },
      { status: 409 }
    );
  }

  if (doc.status === "ready") {
    return NextResponse.json(
      { error: "Document already processed successfully" },
      { status: 409 }
    );
  }

  // ── Reset and enqueue ──────────────────────────────────────────────────
  await supabase
    .from("documents")
    .update({ status: "pending", error_message: null })
    .eq("id", id);

  await enqueueDocumentProcessing(id);

  return NextResponse.json({ id, status: "pending" });
}
