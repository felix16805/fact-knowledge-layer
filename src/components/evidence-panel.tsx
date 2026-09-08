import { Quote, FileText, FileSearch } from "lucide-react";

interface EvidencePanelProps {
  fact: {
    quoted_evidence: string;
    qualifiers: any;
    document?: { filename: string };
  };
  chunk?: {
    raw_text: string;
    page_number: number;
    chunk_type: string;
  };
}

export function EvidencePanel({ fact, chunk }: EvidencePanelProps) {
  // Simple highlighting of the quote within the chunk
  const highlightQuote = (text: string, quote: string) => {
    if (!quote) return text;
    // We do a simple string replacement. In a real app, this might need 
    // more robust normalization if whitespace differs.
    const parts = text.split(quote);
    if (parts.length === 1) return text; // Quote not found exactly
    
    return (
      <>
        {parts.map((part, i) => (
          <span key={i}>
            {part}
            {i !== parts.length - 1 && (
              <mark className="bg-accent/20 text-accent font-medium px-0.5">{quote}</mark>
            )}
          </span>
        ))}
      </>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
          <Quote className="w-3.5 h-3.5" />
          Extracted Quote
        </h4>
        <div className="p-4 bg-secondary/30 border-l-2 border-primary text-sm italic text-foreground">
          "{fact.quoted_evidence}"
        </div>
      </div>

      {fact.qualifiers && (
        <div>
          <h4 className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">
            Qualifiers & Caveats
          </h4>
          <pre className="p-4 bg-card border border-border text-xs font-mono overflow-x-auto text-muted-foreground">
            {JSON.stringify(fact.qualifiers, null, 2)}
          </pre>
        </div>
      )}

      {chunk && (
        <div>
          <h4 className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
            <FileSearch className="w-3.5 h-3.5" />
            Source Context (Page {chunk.page_number})
          </h4>
          <div className="p-4 bg-card border border-border text-sm font-mono whitespace-pre-wrap leading-relaxed text-muted-foreground h-64 overflow-y-auto">
            {highlightQuote(chunk.raw_text, fact.quoted_evidence)}
          </div>
          <div className="mt-2 text-xs text-muted-foreground flex items-center gap-2">
            <FileText className="w-3.5 h-3.5" />
            Source: {fact.document?.filename || "Unknown"} (Type: {chunk.chunk_type})
          </div>
        </div>
      )}
    </div>
  );
}
