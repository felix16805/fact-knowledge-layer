import { cn } from "@/lib/utils";
import { Quote } from "lucide-react";

interface FactCardProps {
  fact: {
    id: string;
    subject: string;
    metric: string;
    value: any;
    unit: string | null;
    time_scope: string | null;
    doc_scope: string | null;
    confidence: number;
    quoted_evidence: string;
    document?: { filename: string };
  };
  onClick?: () => void;
  selected?: boolean;
}

export function FactCard({ fact, onClick, selected }: FactCardProps) {
  const valueDisplay = typeof fact.value === "object" ? JSON.stringify(fact.value) : String(fact.value);

  return (
    <div 
      onClick={onClick}
      className={cn(
        "border p-4 transition-colors cursor-pointer group flex flex-col gap-3",
        selected ? "border-foreground bg-secondary/10" : "border-border hover:border-muted-foreground/50 hover:bg-secondary/20"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-mono text-muted-foreground mb-1 uppercase tracking-wider truncate">
            {fact.subject}
          </div>
          <h4 className="font-medium text-sm text-foreground break-words">
            {fact.metric}
          </h4>
        </div>
        <div className="text-right shrink-0 max-w-[50%]">
          <div className="font-mono text-lg font-semibold break-words">
            {valueDisplay}
            {fact.unit && <span className="text-xs text-muted-foreground ml-1 break-words">{fact.unit}</span>}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mt-auto">
        {fact.time_scope && (
          <span className="px-1.5 py-0.5 bg-secondary text-secondary-foreground text-xs font-mono border border-border">
            {fact.time_scope}
          </span>
        )}
        {fact.doc_scope && (
          <span className="px-1.5 py-0.5 bg-secondary/50 text-muted-foreground text-xs font-mono border border-border">
            {fact.doc_scope}
          </span>
        )}
        <span className="px-1.5 py-0.5 bg-transparent text-muted-foreground text-xs font-mono border border-border ml-auto">
          Conf: {fact.confidence.toFixed(2)}
        </span>
      </div>

      {fact.document && (
        <div className="mt-2 pt-3 border-t border-border flex items-start gap-2 text-xs text-muted-foreground">
          <Quote className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <p className="line-clamp-2 italic break-words min-w-0">"{fact.quoted_evidence}"</p>
        </div>
      )}
    </div>
  );
}
