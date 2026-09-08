import { createAdminClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { PDFViewerWrapper } from "@/components/pdf-viewer-wrapper";
import { FactCard } from "@/components/fact-card";
import { CheckCircle2, Clock, XCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createAdminClient();

  // Fetch document details
  const { data: doc } = await supabase
    .from("documents")
    .select("*")
    .eq("id", id)
    .single();

  if (!doc) notFound();

  // Fetch facts
  const { data: facts } = await supabase
    .from("facts")
    .select("*, chunks!source_chunk_id(page_number)")
    .eq("document_id", id)
    .order("created_at", { ascending: true });

  const isFailed = doc.status === "failed";
  const isReady = doc.status === "ready";
  const isProcessing = !isFailed && !isReady;

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] lg:h-screen w-full">
      <header className="shrink-0 flex items-center justify-between p-4 border-b border-border bg-card">
        <div className="flex items-center gap-4">
          <Link href="/" className="p-2 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors border border-transparent hover:border-border">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="font-mono font-semibold tracking-tight truncate max-w-sm md:max-w-xl">{doc.filename}</h1>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
              <div className={cn(
                "flex items-center gap-1 font-mono uppercase",
                isReady && "text-success",
                isFailed && "text-destructive",
                isProcessing && "text-accent"
              )}>
                {isReady && <CheckCircle2 className="w-3.5 h-3.5" />}
                {isFailed && <XCircle className="w-3.5 h-3.5" />}
                {isProcessing && <Clock className="w-3.5 h-3.5 animate-pulse" />}
                {doc.status}
              </div>
              <span className="font-mono">{facts?.length || 0} facts extracted</span>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left pane: Document Viewer */}
        <div className="w-full md:w-1/2 lg:w-3/5 border-r border-border h-full overflow-hidden bg-zinc-950">
          <PDFViewerWrapper url={`/api/documents/${id}/pdf`} />
        </div>

        {/* Right pane: Facts */}
        <div className="w-full md:w-1/2 lg:w-2/5 h-full overflow-y-auto bg-background p-4 space-y-4">
          <div className="font-mono text-sm uppercase tracking-wider text-muted-foreground mb-4 sticky top-0 bg-background/95 backdrop-blur py-2 border-b border-border z-10">
            Extracted Facts
          </div>

          {isProcessing && (
            <div className="p-8 text-center border border-dashed border-accent/30 text-accent bg-accent/5 font-mono text-sm animate-pulse">
              Extraction in progress...
            </div>
          )}

          {isFailed && (
            <div className="p-6 bg-destructive/10 border border-destructive/20 text-destructive text-sm font-mono whitespace-pre-wrap">
              Extraction Failed:
              {"\n\n"}{doc.error_message}
            </div>
          )}

          {facts?.map((fact: any) => (
            <FactCard 
              key={fact.id} 
              fact={{
                ...fact,
                page_number: fact.chunks?.page_number
              }} 
            />
          ))}

          {isReady && facts?.length === 0 && (
            <div className="p-8 text-center border border-dashed border-border text-muted-foreground font-mono text-sm">
              No facts were extracted from this document.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
