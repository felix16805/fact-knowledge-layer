import { cn } from "@/lib/utils";
import { Link2, Link2Off, Layers, HelpCircle } from "lucide-react";
import type { RelationshipType } from "@/lib/validators";

interface RelationshipBadgeProps {
  type: RelationshipType;
  className?: string;
}

export function RelationshipBadge({ type, className }: RelationshipBadgeProps) {
  const config = {
    corroborates: {
      icon: Link2,
      label: "CORROBORATES",
      styles: "border-success/30 text-success bg-success/5",
    },
    contradicts: {
      icon: Link2Off,
      label: "CONTRADICTS",
      styles: "border-destructive/30 text-destructive bg-destructive/5",
    },
    reconcilable: {
      icon: Layers,
      label: "RECONCILABLE",
      styles: "border-accent/30 text-accent bg-accent/5",
    },
    insufficient_context: {
      icon: HelpCircle,
      label: "INSUFFICIENT CONTEXT",
      styles: "border-muted-foreground/30 text-muted-foreground bg-muted/5",
    },
  };

  const { icon: Icon, label, styles } = config[type];

  return (
    <div className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 border text-xs font-mono font-medium tracking-wide", styles, className)}>
      <Icon className="w-3.5 h-3.5" />
      {label}
    </div>
  );
}
