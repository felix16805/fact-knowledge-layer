"use client";

import { PDFViewer } from "@/components/pdf-viewer";

export function PDFViewerWrapper({ url }: { url: string }) {
  return <PDFViewer url={url} />;
}
