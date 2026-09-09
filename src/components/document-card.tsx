import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { FileText, CheckCircle2, Clock, XCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface DocumentCardProps {
  document: {
    id: string;
    filename: string;
    status: string;
    uploaded_at: string;
    error_message: string | null;
    chunks_total: number;
    chunks_processed: number;
    current_stage: string | null;
  };
}

export function DocumentCard({ document }: DocumentCardProps) {
  const isFailed = document.status === "failed";
  const isReady = document.status === "ready";
  const isProcessing = !isFailed && !isReady;

  return (
    <Link 
      href={`/documents/${document.id}`}
      className={cn(
        "group block border p-4 transition-colors hover:bg-secondary/20",
        isFailed ? "border-destructive/50" : "border-border hover:border-muted-foreground/50"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className={cn(
            "shrink-0 p-2 mt-0.5",
            isFailed ? "bg-destructive/10 text-destructive" : "bg-secondary text-muted-foreground group-hover:text-foreground transition-colors"
          )}>
            <FileText className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="font-mono text-sm font-medium break-all">
              {document.filename}
            </h3>
            <p className="text-xs text-muted-foreground mt-1 truncate">
              Uploaded {formatDistanceToNow(new Date(document.uploaded_at), { addSuffix: true })}
            </p>
          </div>
        </div>
        
        <div className="flex flex-col items-end gap-1">
          <div className={cn(
            "flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 border uppercase tracking-wider",
            isReady && "border-success/30 text-success bg-success/10",
            isFailed && "border-destructive/30 text-destructive bg-destructive/10",
            isProcessing && "border-muted text-muted-foreground bg-muted/20"
          )}>
            {isReady && <CheckCircle2 className="w-3 h-3" />}
            {isFailed && <XCircle className="w-3 h-3" />}
            {isProcessing && <Clock className="w-3 h-3 animate-pulse" />}
            {document.status}
          </div>
        </div>
      </div>
      
      {isProcessing && document.current_stage && (
        <div className="mt-4 border-t pt-3">
          <div className="flex justify-between items-center mb-1 text-xs">
            <span className="text-muted-foreground uppercase font-mono tracking-wider">
              {document.current_stage}
            </span>
            {document.chunks_total > 0 && (
              <span className="font-mono text-muted-foreground">
                {document.chunks_processed} / {document.chunks_total} chunks
              </span>
            )}
          </div>
          {document.chunks_total > 0 && (
            <div className="w-full bg-secondary h-1">
              <div 
                className="bg-primary h-1 transition-all duration-500 ease-in-out" 
                style={{ width: `${Math.max(5, (document.chunks_processed / document.chunks_total) * 100)}%` }}
              />
            </div>
          )}
        </div>
      )}
      
      {isFailed && document.error_message && (
        <div className="mt-4 text-xs text-destructive flex gap-2 items-start bg-destructive/5 p-2 border border-destructive/10">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span className="font-mono break-words min-w-0">{document.error_message}</span>
        </div>
      )}
    </Link>
  );
}
