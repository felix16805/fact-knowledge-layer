import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * GET /api/documents/[id]/status
 * Lightweight status poll endpoint — called every 2s by the upload UI.
 * Returns only what's needed for the UI: status + counts.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createAdminClient();

  const { data, error } = await supabase
    .from("documents")
    .select(
      `status, page_count, error_message, chunks_total, chunks_processed, current_stage, facts:facts(count)`
    )
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  return NextResponse.json({
    status: data.status,
    page_count: data.page_count ?? null,
    error_message: data.error_message ?? null,
    chunks_total: data.chunks_total ?? 0,
    chunks_processed: data.chunks_processed ?? 0,
    current_stage: data.current_stage ?? null,
    fact_count: (data.facts as unknown as [{ count: number }])?.[0]?.count ?? 0,
  });
}
