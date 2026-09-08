import { UploadZone } from "@/components/upload-zone";
import { DocumentCard } from "@/components/document-card";
import { createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createAdminClient();
  
  const { data: documents, error } = await supabase
    .from("documents")
    .select("*")
    .order("uploaded_at", { ascending: false })
    .limit(50);

  return (
    <div className="flex-1 flex flex-col max-w-6xl mx-auto w-full p-4 md:p-8 space-y-12">
      <section>
        <div className="mb-6">
          <h1 className="text-3xl font-mono tracking-tighter uppercase mb-2">Ingestion Pipeline</h1>
          <p className="text-muted-foreground text-sm max-w-2xl">
            Upload financial PDFs to extract facts, verify unit and scope boundaries, and find corroborating or contradicting evidence automatically.
          </p>
        </div>
        
        <div className="bg-card border border-border p-6 md:p-12">
          <UploadZone />
        </div>
      </section>

      <section>
        <div className="flex items-end justify-between mb-6">
          <h2 className="text-xl font-mono uppercase tracking-tight">Recent Documents</h2>
        </div>

        {error ? (
          <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive text-sm font-mono flex items-center gap-3">
            Error loading documents: {error.message}
          </div>
        ) : documents && documents.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {documents.map((doc: any) => (
              <DocumentCard key={doc.id} document={doc} />
            ))}
          </div>
        ) : (
          <div className="p-12 text-center border border-dashed border-border text-muted-foreground text-sm font-mono uppercase">
            No documents processed yet
          </div>
        )}
      </section>
    </div>
  );
}
