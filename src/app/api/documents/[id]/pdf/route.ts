import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * GET /api/documents/[id]/pdf
 * Redirects to a short-lived signed read URL for the PDF in the private bucket.
 * The PDF viewer uses this URL directly via 302 redirect.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createAdminClient();

  const { data: doc, error: docError } = await supabase
    .from("documents")
    .select("storage_path")
    .eq("id", id)
    .single();

  if (docError || !doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const { data, error } = await supabase.storage
    .from("pdfs")
    .download(doc.storage_path);

  if (error || !data) {
    return NextResponse.json(
      { error: "Failed to fetch PDF" },
      { status: 500 }
    );
  }

  return new NextResponse(data, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "inline",
      // Allow this response to be embedded in an iframe on the same origin.
      // Next.js sets X-Frame-Options: SAMEORIGIN by default, but the iframe is
      // on localhost → localhost (same origin). The browser can still block it
      // if the route itself echoes a CSP. Explicitly override to be safe.
      "X-Frame-Options": "SAMEORIGIN",
      "Content-Security-Policy": "frame-ancestors 'self'",
    },
  });
}
