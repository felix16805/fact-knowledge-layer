import { createAdminClient } from "@/lib/supabase/server";
import { FactCard } from "@/components/fact-card";
import { EvidencePanel } from "@/components/evidence-panel";
import { RelationshipBadge } from "@/components/relationship-badge";
import { AlertCircle } from "lucide-react";
import type { RelationshipType } from "@/lib/validators";

export const dynamic = "force-dynamic";

export default async function FactsPage({
  searchParams,
}: {
  searchParams: Promise<{ fact_a?: string; fact_b?: string }>;
}) {
  const { fact_a, fact_b } = await searchParams;
  const supabase = await createAdminClient();

  // If we have a specific relationship to focus on
  if (fact_a && fact_b) {
    const { data: rel } = await supabase
      .from("fact_relationships")
      .select(`
        relationship_type, reasoning,
        fact_a:facts!fact_a_id(*, document:documents(filename), chunks!source_chunk_id(*)),
        fact_b:facts!fact_b_id(*, document:documents(filename), chunks!source_chunk_id(*))
      `)
      .eq("fact_a_id", fact_a)
      .eq("fact_b_id", fact_b)
      .single();

    if (rel) {
      return (
        <div className="flex-1 flex flex-col w-full h-full p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
          <div className="mb-4">
            <h1 className="text-2xl font-mono tracking-tighter uppercase mb-2">Relationship Analysis</h1>
            <RelationshipBadge type={rel.relationship_type as RelationshipType} className="text-sm px-3 py-1" />
          </div>

          <div className="p-6 bg-card border border-border">
            <h3 className="font-mono text-xs uppercase text-muted-foreground mb-3">Model Reasoning</h3>
            <p className="text-foreground leading-relaxed italic border-l-2 border-primary pl-4 py-1">
              {rel.reasoning}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
            <div className="space-y-6">
              <h2 className="font-mono text-lg border-b border-border pb-2">Fact A</h2>
              <FactCard fact={rel.fact_a as any} />
              <EvidencePanel fact={rel.fact_a as any} chunk={(rel.fact_a as any).chunks as any} />
            </div>
            
            <div className="space-y-6">
              <h2 className="font-mono text-lg border-b border-border pb-2">Fact B</h2>
              <FactCard fact={rel.fact_b as any} />
              <EvidencePanel fact={rel.fact_b as any} chunk={(rel.fact_b as any).chunks as any} />
            </div>
          </div>
        </div>
      );
    }
  }

  // Otherwise, list all relationships found so far
  const { data: relationships, error } = await supabase
    .from("fact_relationships")
    .select(`
      fact_a_id, fact_b_id, relationship_type, reasoning,
      fact_a:facts!fact_a_id(subject, metric, value, unit, time_scope, document:documents(filename)),
      fact_b:facts!fact_b_id(subject, metric, value, unit, time_scope, document:documents(filename))
    `)
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="flex-1 flex flex-col max-w-6xl mx-auto w-full p-4 md:p-8 space-y-8">
      <div className="mb-2">
        <h1 className="text-3xl font-mono tracking-tighter uppercase mb-2">Knowledge Graph</h1>
        <p className="text-muted-foreground text-sm max-w-2xl">
          Browse relationships identified between facts across different documents.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive text-sm font-mono flex items-center gap-3">
          <AlertCircle className="w-4 h-4" />
          {error.message}
        </div>
      )}

      {!relationships || relationships.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-border text-muted-foreground text-sm font-mono uppercase">
          No cross-document relationships identified yet.
        </div>
      ) : (
        <div className="space-y-6">
          {relationships.map((rel: any, i: number) => (
            <div key={i} className="bg-card border border-border p-6 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <RelationshipBadge type={rel.relationship_type} />
                <a 
                  href={`/facts?fact_a=${rel.fact_a_id}&fact_b=${rel.fact_b_id}`}
                  className="text-xs font-mono text-muted-foreground hover:text-foreground hover:underline"
                >
                  View Details →
                </a>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 border border-border/50 bg-background/50">
                  <div className="text-xs font-mono text-muted-foreground mb-1 truncate">
                    {rel.fact_a.document?.filename}
                  </div>
                  <div className="font-medium text-sm">
                    {rel.fact_a.metric}: {JSON.stringify(rel.fact_a.value)} {rel.fact_a.unit}
                  </div>
                </div>
                
                <div className="p-4 border border-border/50 bg-background/50">
                  <div className="text-xs font-mono text-muted-foreground mb-1 truncate">
                    {rel.fact_b.document?.filename}
                  </div>
                  <div className="font-medium text-sm">
                    {rel.fact_b.metric}: {JSON.stringify(rel.fact_b.value)} {rel.fact_b.unit}
                  </div>
                </div>
              </div>

              <div className="text-sm italic text-muted-foreground">
                "{rel.reasoning}"
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
