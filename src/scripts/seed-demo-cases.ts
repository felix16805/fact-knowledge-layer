import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const demoCases = [
  {
    title: "Unit Conversion Detection",
    description: "Detects when the same fact is reported in millions vs thousands and normalizes the comparison to identify corroboration despite raw text differences.",
    related_document_ids: [], // Would be populated with actual document IDs
    related_fact_ids: [],
    analysis: "The system successfully parsed '1.5 million' from Document A and '1,500,000' from Document B, normalized both metrics, and classified the relationship as CORROBORATES.",
  },
  {
    title: "Metric Scoping Boundary",
    description: "Identifies scope differences (e.g., 'Q3 Revenue' vs 'Fiscal Year Revenue') and marks them as INDEPENDENT rather than contradicting.",
    related_document_ids: [],
    related_fact_ids: [],
    analysis: "Despite sharing the same metric name ('Revenue') and company context, the system recognized the temporal scope difference ('Q3' vs 'FY2023') and correctly prevented a false CONTRADICTS classification.",
  },
  {
    title: "Direct Contradiction Detection",
    description: "Flags mathematically impossible intersections across two documents discussing the exact same metric and scope.",
    related_document_ids: [],
    related_fact_ids: [],
    analysis: "Document A stated total liabilities at $4.2B, while Document B stated $4.8B for the exact same quarter. The relationship classifier correctly flagged this as CONTRADICTS.",
  },
  {
    title: "Unstated Assumptions Flagging",
    description: "Identifies when a metric relies on an assumption (like 'Non-GAAP') in one document but not another.",
    related_document_ids: [],
    related_fact_ids: [],
    analysis: "The system noticed Document A's EPS was 'Adjusted Non-GAAP' while Document B just said 'EPS'. It classified them as INDEPENDENT because the underlying assumptions were not verified to be identical.",
  }
];

async function seed() {
  console.log("Seeding demo cases...");
  
  // Clear existing
  await supabase.from("demo_cases").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  const { data, error } = await supabase.from("demo_cases").insert(demoCases).select();
  
  if (error) {
    console.error("Error seeding demo cases:", error);
    process.exit(1);
  }
  
  console.log(`Successfully seeded ${data.length} demo cases!`);
  console.log("View them at http://localhost:3000/demo-cases");
}

seed();
