import Link from "next/link";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex-1 flex items-center justify-center p-8 h-full">
      <div className="max-w-md w-full border border-border bg-card p-8 flex flex-col items-center text-center space-y-6">
        <div className="p-4 bg-secondary/30 rounded-full">
          <AlertCircle className="w-12 h-12 text-muted-foreground" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-mono tracking-tighter uppercase">404 - Not Found</h2>
          <p className="text-sm text-muted-foreground">
            The page or document you are looking for does not exist or has been deleted.
          </p>
        </div>
        <Link 
          href="/" 
          className="inline-flex items-center justify-center h-10 px-6 font-mono text-sm bg-foreground text-background hover:bg-muted-foreground transition-colors"
        >
          Return to Dashboard
        </Link>
      </div>
    </div>
  );
}
