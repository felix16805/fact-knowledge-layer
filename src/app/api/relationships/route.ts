import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { RelationshipsQuerySchema } from "@/lib/validators";

export const runtime = "nodejs";

/**
 * GET /api/relationships
 * Paginated list of fact relationships with full fact details and reasoning.
 */
export async function GET(req: NextRequest) {
  const query = Object.fromEntries(req.nextUrl.searchParams);
  const parsed = RelationshipsQuerySchema.safeParse(query);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const { relationship_type, page, limit } = parsed.data;
  const offset = (page - 1) * limit;

  const supabase = await createAdminClient();
  let queryBuilder = supabase
    .from("fact_relationships")
    .select(
      `id, relationship_type, reasoning, reconciling_factor, confidence, created_at,
       fact_a:facts!fact_a_id(
         id, subject, metric, value, unit, time_scope, doc_scope, quoted_evidence,
         document:documents!document_id(id, filename),
         source_chunk:chunks!source_chunk_id(page_number)
       ),
       fact_b:facts!fact_b_id(
         id, subject, metric, value, unit, time_scope, doc_scope, quoted_evidence,
         document:documents!document_id(id, filename),
         source_chunk:chunks!source_chunk_id(page_number)
       )`,
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (relationship_type) {
    queryBuilder = queryBuilder.eq("relationship_type", relationship_type);
  }

  const { data, error, count } = await queryBuilder;

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch relationships" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    relationships: data,
    total: count ?? 0,
    page,
    limit,
    pages: Math.ceil((count ?? 0) / limit),
  });
}
