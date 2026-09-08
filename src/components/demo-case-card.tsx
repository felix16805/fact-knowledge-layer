import { Bookmark } from "lucide-react";

interface DemoCaseCardProps {
  demoCase: {
    id: string;
    title: string;
    description: string;
    analysis: string;
  };
}

export function DemoCaseCard({ demoCase }: DemoCaseCardProps) {
  return (
    <div className="border border-border bg-card overflow-hidden flex flex-col h-full">
      <div className="p-4 border-b border-border bg-secondary/20 flex items-start justify-between">
        <div>
          <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-2">
            <Bookmark className="w-3.5 h-3.5" />
            Edge Case
          </div>
          <h3 className="text-lg font-medium text-foreground">{demoCase.title}</h3>
        </div>
      </div>
      
      <div className="p-4 flex-1">
        <p className="text-sm text-muted-foreground leading-relaxed mb-6">
          {demoCase.description}
        </p>
        
        <div className="p-3 bg-secondary/10 border border-border text-sm mb-4">
          <div className="font-mono text-xs text-muted-foreground mb-1 uppercase tracking-wider">Analysis</div>
          <div className="font-medium text-primary">{demoCase.analysis}</div>
        </div>
      </div>
      
      <div className="p-4 border-t border-border mt-auto">
        <div className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
          System Successfully Handled
        </div>
      </div>
    </div>
  );
}
