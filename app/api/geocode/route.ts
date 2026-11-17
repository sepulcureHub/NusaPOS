import type { NextRequest } from "next/server";
import { cacheControlFor, resolveAddress } from "@/lib/geocode-server";

/**
 * Route handler tipis.
 * Hanya mengekspor GET — tidak ada `export const runtime / dynamic / revalidate`,
 * supaya lolos validasi RouteHandlerConfig yang di-generate Next saat build.
 *
 * Route otomatis dynamic karena membaca req.nextUrl.searchParams.
 * Caching diatur lewat header respons, bukan lewat segment config.
 */
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();

  const body = q.length < 3 || q.length > 240
    ? ({ ok: false, error: "query" } as const)
    : await resolveAddress(q);

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": cacheControlFor(body),
      "X-Robots-Tag": "noindex",
    },
  });
}