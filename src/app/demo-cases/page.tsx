import { createAdminClient } from "@/lib/supabase/server";
import { DemoCaseCard } from "@/components/demo-case-card";
import { AlertCircle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DemoCasesPage() {
  const supabase = await createAdminClient();

  const { data: demoCases, error } = await supabase
    .from("demo_cases")
    .select("*")
    .order("created_at", { ascending: true });

  return (
    <div className="flex-1 flex flex-col max-w-6xl mx-auto w-full p-4 md:p-8 space-y-8">
      <div className="mb-2">
        <h1 className="text-3xl font-mono tracking-tighter uppercase mb-2">Demo Cases</h1>
        <p className="text-muted-foreground text-sm max-w-2xl leading-relaxed">
          The assignment requires demonstrating four specific capabilities. These pinned cases highlight how the system handles unit conversions, metric scoping, contradiction detection, and unstated assumptions.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive text-sm font-mono flex items-center gap-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error.message}
        </div>
      )}

      {!demoCases || demoCases.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-border text-muted-foreground text-sm font-mono uppercase">
          No demo cases seeded yet. Run the seeding script.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {demoCases.map((demoCase: any) => (
            <DemoCaseCard key={demoCase.id} demoCase={demoCase} />
          ))}
        </div>
      )}
    </div>
  );
}
