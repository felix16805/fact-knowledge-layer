import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { FactsQuerySchema } from "@/lib/validators";

export const runtime = "nodejs";

/**
 * GET /api/facts
 * Paginated, filterable list of facts with source document info.
 */
export async function GET(req: NextRequest) {
  const query = Object.fromEntries(req.nextUrl.searchParams);
  const parsed = FactsQuerySchema.safeParse(query);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const { document_id, subject, metric, page, limit } = parsed.data;
  const offset = (page - 1) * limit;

  const supabase = await createAdminClient();
  let queryBuilder = supabase
    .from("facts")
    .select(
      `id, subject, metric, value, unit, time_scope, doc_scope, qualifiers,
       quoted_evidence, confidence, created_at,
       document:documents!document_id(id, filename),
       source_chunk:chunks!source_chunk_id(page_number, chunk_type)`,
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (document_id) queryBuilder = queryBuilder.eq("document_id", document_id);
  if (subject) queryBuilder = queryBuilder.ilike("subject", `%${subject}%`);
  if (metric) queryBuilder = queryBuilder.ilike("metric", `%${metric}%`);

  const { data, error, count } = await queryBuilder;

  if (error) {
    return NextResponse.json({ error: "Failed to fetch facts" }, { status: 500 });
  }

  return NextResponse.json({
    facts: data,
    total: count ?? 0,
    page,
    limit,
    pages: Math.ceil((count ?? 0) / limit),
  });
}
