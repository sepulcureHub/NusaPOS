import type { NextRequest } from "next/server";
import { cacheControlFor, resolveAddress } from "@/lib/geocode-server";
import { clientKey, rateLimit } from "@/lib/rate-limit";

/**
 * Route handler tipis — hanya ekspor GET, tanpa segment config
 * (runtime/dynamic/revalidate) supaya lolos validasi RouteHandlerConfig Next 16.
 * 20 req/menit/IP: cukup untuk autocomplete alamat toko, tapi menutup
 * pemakaian kuota Google & Nominatim oleh pihak lain.
 */
const LIMIT = 20;
const WINDOW_MS = 60_000;

function json(body: unknown, status: number, extra?: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": status === 200 ? cacheControlFor(body as never) : "no-store",
      "X-Robots-Tag": "noindex",
      ...extra,
    },
  });
}

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 3 || q.length > 240) {
    return json({ ok: false, error: "query" }, 400);
  }

  const rl = rateLimit(`geocode:${clientKey(req.headers)}`, LIMIT, WINDOW_MS);
  if (!rl.ok) {
    return json({ ok: false, error: "rate_limited" }, 429, {
      "Retry-After": String(rl.retryAfter),
      "X-RateLimit-Limit": String(rl.limit),
      "X-RateLimit-Remaining": "0",
    });
  }

  const body = await resolveAddress(q);
  return json(body, 200, {
    "X-RateLimit-Limit": String(rl.limit),
    "X-RateLimit-Remaining": String(rl.remaining),
  });
}