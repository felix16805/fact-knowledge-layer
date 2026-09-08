import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * GET /api/documents/[id]
 * Returns a single document with fact and relationship counts.
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
      `id, filename, storage_path, uploaded_at, status, page_count, error_message,
       facts:facts(count),
       relationships:fact_relationships(count)`
    )
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}
