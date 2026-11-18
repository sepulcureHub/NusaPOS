/**
 * Rate limit in-memory per IP (fixed window).
 * Di serverless (Vercel) memori ini per-instance — cukup untuk menahan abuse ringan
 * dan melindungi kuota Google/Nominatim. Untuk produksi multi-region, ganti backing
 * store ke Upstash Redis / Vercel KV dengan signature yang sama.
 */
const hits = new Map<string, { count: number; resetAt: number }>();
const MAX_KEYS = 5000;

export interface RateResult { ok: boolean; limit: number; remaining: number; retryAfter: number }

export function rateLimit(key: string, limit = 20, windowMs = 60_000, now = Date.now()): RateResult {
  if (hits.size > MAX_KEYS) {
    for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
    if (hits.size > MAX_KEYS) hits.clear();
  }
  const cur = hits.get(key);
  if (!cur || cur.resetAt <= now) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, limit, remaining: limit - 1, retryAfter: 0 };
  }
  cur.count += 1;
  return {
    ok: cur.count <= limit,
    limit,
    remaining: Math.max(0, limit - cur.count),
    retryAfter: Math.max(1, Math.ceil((cur.resetAt - now) / 1000)),
  };
}

/** IP klien di belakang proxy tepercaya (Vercel menyetel x-forwarded-for). */
export function clientKey(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim().slice(0, 64);
  return (headers.get("x-real-ip") ?? "local").slice(0, 64);
}