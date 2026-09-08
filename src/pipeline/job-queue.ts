import { processDocument } from "./document-processor";

/**
 * Thin shim — no pg-boss, no queue.
 * POST /api/documents calls this; it fires processDocument() in the background
 * (void — intentionally not awaited) so the HTTP response returns immediately.
 *
 * On Vercel Node runtime, the function stays alive long enough to finish
 * processing because the response is already sent. For very large PDFs on
 * Hobby plans (60 s limit) the function may time out — a known limitation.
 */
export async function enqueueDocumentProcessing(
  documentId: string
): Promise<string | null> {
  // Fire-and-forget: start processing but don't block the caller
  void processDocument({ data: { documentId } });
  // Return a fake job ID for API compatibility
  return `inline-${documentId}`;
}

export const QUEUE_NAME = "process_document" as const;
