import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * GET /api/demo-cases
 * Returns the four pinned demo cases with their associated relationships.
 * These are seeded by scripts/seed-demo-cases.ts after the pipeline runs.
 */
export async function GET() {
  const supabase = await createAdminClient();

  const { data, error } = await supabase
    .from("demo_cases")
    .select(
      `id, case_number, title, description, notes,
       relationship:fact_relationships!relationship_id(
         id, relationship_type, reasoning, reconciling_factor, confidence,
         fact_a:facts!fact_a_id(
           id, subject, metric, value, unit, time_scope, doc_scope, quoted_evidence,
           document:documents!document_id(id, filename),
           source_chunk:chunks!source_chunk_id(page_number)
         ),
         fact_b:facts!fact_b_id(
           id, subject, metric, value, unit, time_scope, doc_scope, quoted_evidence,
           document:documents!document_id(id, filename),
           source_chunk:chunks!source_chunk_id(page_number)
         )
       )`
    )
    .order("case_number", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch demo cases" },
      { status: 500 }
    );
  }

  return NextResponse.json(data ?? []);
}
