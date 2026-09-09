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
const MIN_INTERVAL_MS = 13_000 // 5 RPM = one call per 12s minimum; 13s for safety margin

export async function withGeminiBackoff<T>(
  fn: () => Promise<T>,
  opts: { maxRetries?: number; onRetry?: (delayMs: number, attempt: number) => void } = {}
): Promise<T> {
  const { maxRetries = 4, onRetry } = opts
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      const e = err as { status?: number; code?: number; message?: string };
      const status = e?.status ?? e?.code;
      const msg = e?.message?.toLowerCase() ?? "";

      const is429 = status === 429 || msg.includes("429") || msg.includes("quota") || msg.includes("rate limit");
      const is503 = status === 503 || msg.includes("503") || msg.includes("unavailable") || msg.includes("overloaded") || msg.includes("high demand");

      if (!is429 && !is503) throw err;
      if (attempt === maxRetries) throw err;

      const delay = Math.min(1000 * Math.pow(2, attempt), 30_000);
      console.warn(`[gemini-retry] API rate limited or overloaded (attempt ${attempt + 1}/${maxRetries}). Retrying in ${delay}ms...`);
      onRetry?.(delay, attempt + 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error("unreachable");
}

export async function paceGeminiCall<T>(fn: () => Promise<T>, opts?: Parameters<typeof withGeminiBackoff>[1]): Promise<T> {
  const result = await withGeminiBackoff(fn, opts)
  await new Promise(r => setTimeout(r, MIN_INTERVAL_MS))
  return result
}
