"use client";

import { useState } from "react";
import { Loader2, AlertCircle } from "lucide-react";

interface PDFViewerProps {
  url: string;
  initialPage?: number;
}

export function PDFViewer({ url, initialPage = 1 }: PDFViewerProps) {
  // Append page number to URL for browser's native PDF viewer
  const pdfUrl = `${url}#page=${initialPage}`;

  return (
    <div className="flex flex-col h-full bg-secondary/10 border border-border relative">
      <iframe
        src={pdfUrl}
        className="w-full h-full border-0"
        title="PDF Document Viewer"
      />
    </div>
  );
}
