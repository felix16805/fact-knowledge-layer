import { createAdminClient } from "@/lib/supabase/server";

/**
 * Rate-limit check using the rate_limit_log table.
 * Uses an upsert with ON CONFLICT to safely handle concurrent requests.
 *
 * Window: 10 minutes. Limit: 5 requests per IP per endpoint.
 *
 * Returns { allowed: boolean; remaining: number }
 */
export async function checkRateLimit(
  ip: string,
  endpoint: string,
  maxRequests = 5,
  windowMinutes = 10
): Promise<{ allowed: boolean; remaining: number }> {
  const supabase = await createAdminClient();

  // Truncate to the current window_start (floor to windowMinutes interval)
  const now = new Date();
  const windowMs = windowMinutes * 60 * 1000;
  const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs);

  // Upsert: insert row or increment hit_count if it exists
  const { data, error } = await supabase.rpc("upsert_rate_limit", {
    p_ip: ip,
    p_endpoint: endpoint,
    p_window_start: windowStart.toISOString(),
  });

  if (error) {
    // If rate limit check fails (e.g., db connectivity), fail open — log but allow
    console.error("[rate-limit] DB error, failing open:", error.message);
    return { allowed: true, remaining: maxRequests };
  }

  const hitCount = (data as number) ?? 1;
  const allowed = hitCount <= maxRequests;
  const remaining = Math.max(0, maxRequests - hitCount);

  return { allowed, remaining };
}

/**
 * Extract the real client IP from Next.js request headers.
 * Tries X-Forwarded-For first (proxy), falls back to a placeholder.
 */
export function getClientIp(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    headers.get("x-real-ip") ??
    "unknown"
  );
}
