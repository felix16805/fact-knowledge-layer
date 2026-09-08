import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

/**
 * middleware.ts — generates a fresh CSP nonce per request.
 *
 * The nonce is placed in:
 *  - response header: x-nonce (read by layout.tsx to inject into <Script> tags)
 *  - Content-Security-Policy header: script-src 'nonce-{nonce}'
 *
 * This prevents 'unsafe-inline' scripts while allowing Next.js's
 * server-generated inline scripts (hydration, etc.).
 */
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(randomUUID()).toString("base64");

  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' ${
      process.env.NODE_ENV === "development" ? "'unsafe-eval'" : ""
    }`,
    `style-src 'self' 'unsafe-inline'`,         // Tailwind generates inline styles
    `img-src 'self' data: blob: https:`,        // blob: for PDF.js canvas, https: for Supabase Storage
    `font-src 'self' data:`,
    `connect-src 'self' https://*.supabase.co`, // Supabase REST + Storage
    `object-src 'none'`,
    `base-uri 'self'`,
    `frame-ancestors 'self'`,
    `form-action 'self'`,
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  response.headers.set("content-security-policy", csp);
  response.headers.set("x-frame-options", "SAMEORIGIN");
  response.headers.set("x-content-type-options", "nosniff");
  response.headers.set("referrer-policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "permissions-policy",
    "camera=(), microphone=(), geolocation=()"
  );

  return response;
}

export const config = {
  matcher: [
    // Match all routes except static files and Next.js internals
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
