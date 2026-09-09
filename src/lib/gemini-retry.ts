/**
 * Exponential backoff wrapper for Gemini API calls.
 *
 * The free tier (1,500 req/day) has real per-minute rate limits.
 * An unhandled 429 mid-extraction will fail the entire document and
 * show up as a mysterious 'failed' status. This wrapper handles it
 * transparently with retries: 1s → 2s → 4s → 8s, capped at 30s.
 *
 * Usage:
 *   const result = await withGeminiBackoff(() => model.generateContent(prompt))
 */
export async function withGeminiBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 4
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      const e = err as { status?: number; code?: number; message?: string };
      const status = e?.status ?? e?.code;
      const isRetryable =
        status === 429 ||
        status === 503 ||
        e?.message?.includes("429") ||
        e?.message?.includes("503") ||
        e?.message?.includes("UNAVAILABLE") ||
        e?.message?.toLowerCase().includes("rate limit") ||
        e?.message?.toLowerCase().includes("quota") ||
        e?.message?.toLowerCase().includes("unavailable") ||
        e?.message?.toLowerCase().includes("high demand") ||
        e?.message?.toLowerCase().includes("overloaded");

      if (!isRetryable || attempt === maxRetries) {
        throw err;
      }

      const delayMs = Math.min(1000 * Math.pow(2, attempt), 30_000);
      console.warn(
        `[gemini-retry] API rate limited or overloaded (attempt ${attempt + 1}/${maxRetries}). Retrying in ${delayMs}ms...`
      );
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  // TypeScript exhaustiveness — this line is unreachable
  throw new Error("[gemini-retry] Unreachable: exhausted retries without throwing");
}
