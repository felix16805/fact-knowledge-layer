import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { UploadUrlQuerySchema } from "@/lib/validators";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

/**
 * GET /api/upload-url?filename=myfile.pdf
 *
 * Issues a short-lived (60s) Supabase Storage signed upload URL.
 * The browser uses this URL to PUT directly to Storage — no PDF bytes
 * flow through the Next.js server.
 *
 * Rate-limited: 5 requests per IP per 10 minutes.
 */
export async function GET(req: NextRequest) {
  // ── Rate limiting ──────────────────────────────────────────────────────
  const ip = getClientIp(req.headers);
  const { allowed, remaining } = await checkRateLimit(ip, "upload-url");
  if (!allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again in a few minutes." },
      {
        status: 429,
        headers: { "X-RateLimit-Remaining": "0" },
      }
    );
  }

  // ── Input validation ───────────────────────────────────────────────────
  const query = Object.fromEntries(req.nextUrl.searchParams);
  const parsed = UploadUrlQuerySchema.safeParse(query);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const { filename } = parsed.data;

  // ── Generate storage path ──────────────────────────────────────────────
  // Pattern: pdfs/{uuid}/{sanitized-filename}
  // This is the pattern validators.ts enforces on POST /api/documents
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `pdfs/${randomUUID()}/${safeFilename}`;

  // ── Issue signed upload URL ────────────────────────────────────────────
  const supabase = await createAdminClient();
  const { data, error } = await supabase.storage
    .from("pdfs")
    .createSignedUploadUrl(storagePath, { upsert: false });

  if (error || !data) {
    console.error("[upload-url] Supabase error:", error?.message);
    return NextResponse.json(
      { error: "Failed to generate upload URL" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      signedUploadUrl: data.signedUrl,
      token: data.token,
      storagePath,
    },
    {
      headers: { "X-RateLimit-Remaining": String(remaining) },
    }
  );
}
