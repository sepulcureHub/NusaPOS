/**
 * Geocoder sisi server. Prioritas: Google Geocoding API (paling akurat),
 * lalu Nominatim, lalu Photon. Semua dipanggil dari server supaya header
 * User-Agent bisa dikirim dan tidak diblokir CORS saat deploy di Vercel.
 */

export interface GeocodeOk {
  ok: true;
  lat: number;
  lon: number;
  placeId?: string;
  displayName: string;
  detail: Record<string, string>;
  source: "google" | "nominatim" | "photon";
}

export interface GeocodeFail {
  ok: false;
  error: "query" | "notfound" | "unavailable";
}

export type GeocodeResponse = GeocodeOk | GeocodeFail;

const UA = "NusaPOS/1.7 (store locator; +https://nusapos.local)";
const TTL = 1000 * 60 * 60 * 24;
const BUDGET_MS = 8000;
const MAX_CACHE = 500;

const memory = new Map<string, { at: number; body: GeocodeOk }>();

function googleKey() {
  return (process.env.GOOGLE_MAPS_API_KEY ?? process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "").trim();
}

function prune() {
  if (memory.size <= MAX_CACHE) return;
  const oldest = memory.keys().next().value;
  if (oldest !== undefined) memory.delete(oldest);
}

function toDetail(v: unknown): Record<string, string> {
  if (!v || typeof v !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (typeof val === "string" || typeof val === "number") out[k] = String(val);
  }
  return out;
}

interface GoogleComponent { long_name: string; short_name: string; types: string[] }

function googleDetail(components: GoogleComponent[]): Record<string, string> {
  const pick = (...types: string[]) => {
    for (const t of types) {
      const hit = components.find((c) => c.types?.includes(t));
      if (hit) return hit.long_name;
    }
    return "";
  };
  const out: Record<string, string> = {
    street: pick("route"),
    house_number: pick("street_number"),
    neighbourhood: pick("neighborhood", "sublocality_level_2"),
    suburb: pick("sublocality_level_1", "sublocality"),
    city_district: pick("administrative_area_level_3"),
    city: pick("locality", "administrative_area_level_2", "postal_town"),
    state: pick("administrative_area_level_1"),
    postcode: pick("postal_code"),
    country: pick("country"),
  };
  for (const k of Object.keys(out)) if (!out[k]) delete out[k];
  return out;
}

async function google(q: string, signal: AbortSignal): Promise<GeocodeOk> {
  const key = googleKey();
  if (!key) throw new Error("google no key");

  const p = new URLSearchParams({ address: q, language: "id", region: "id", key });
  const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${p.toString()}`, {
    signal,
    cache: "no-store",
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`google ${res.status}`);

  const json = (await res.json()) as {
    status?: string;
    error_message?: string;
    results?: Array<{
      formatted_address?: string;
      place_id?: string;
      geometry?: { location?: { lat?: number; lng?: number } };
      address_components?: GoogleComponent[];
    }>;
  };
  if (json.status !== "OK") throw new Error(`google ${json.status ?? "unknown"}`);

  const hit = json.results?.[0];
  const lat = hit?.geometry?.location?.lat;
  const lon = hit?.geometry?.location?.lng;
  if (!hit || typeof lat !== "number" || typeof lon !== "number") throw new Error("google empty");

  return {
    ok: true,
    lat,
    lon,
    placeId: hit.place_id,
    displayName: hit.formatted_address ?? q,
    detail: googleDetail(hit.address_components ?? []),
    source: "google",
  };
}

async function nominatim(q: string, signal: AbortSignal): Promise<GeocodeOk> {
  const url =
    "https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=1&accept-language=id&q=" +
    encodeURIComponent(q);

  const res = await fetch(url, {
    signal,
    cache: "no-store",
    headers: { "User-Agent": UA, "Accept-Language": "id,en", Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`nominatim ${res.status}`);

  const json: unknown = await res.json();
  const arr = Array.isArray(json) ? json : [];
  const hit = arr[0] as { lat?: unknown; lon?: unknown; display_name?: unknown; address?: unknown } | undefined;
  if (!hit) throw new Error("nominatim empty");

  const lat = Number(hit.lat);
  const lon = Number(hit.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error("nominatim bad coords");

  return {
    ok: true, lat, lon,
    displayName: typeof hit.display_name === "string" && hit.display_name ? hit.display_name : q,
    detail: toDetail(hit.address),
    source: "nominatim",
  };
}

async function photon(q: string, signal: AbortSignal): Promise<GeocodeOk> {
  const url = "https://photon.komoot.io/api/?limit=1&lang=en&q=" + encodeURIComponent(q);
  const res = await fetch(url, {
    signal,
    cache: "no-store",
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`photon ${res.status}`);

  const json: unknown = await res.json();
  const features = (json as { features?: unknown })?.features;
  const f = (Array.isArray(features) ? features[0] : undefined) as
    | { geometry?: { coordinates?: unknown }; properties?: unknown }
    | undefined;
  if (!f) throw new Error("photon empty");

  const coords = f.geometry?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) throw new Error("photon bad coords");
  const lon = Number(coords[0]);
  const lat = Number(coords[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error("photon bad coords");

  const props = toDetail(f.properties);
  const display = [props.name, props.street, props.district, props.city, props.state, props.country].filter(Boolean).join(", ");
  return { ok: true, lat, lon, displayName: display || q, detail: props, source: "photon" };
}

export async function resolveAddress(raw: string): Promise<GeocodeResponse> {
  const q = raw.replace(/\s+/g, " ").trim();
  if (q.length < 3 || q.length > 240) return { ok: false, error: "query" };

  const key = q.toLowerCase();
  const cached = memory.get(key);
  if (cached && Date.now() - cached.at < TTL) return cached.body;

  const full = /indonesia/i.test(q) ? q : `${q}, Indonesia`;
  const attempts: Array<(signal: AbortSignal) => Promise<GeocodeOk>> = [
    (s) => google(full, s),
    (s) => nominatim(full, s),
    (s) => photon(full, s),
    (s) => photon(q, s),
    (s) => nominatim(q, s),
  ];

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), BUDGET_MS);

  try {
    for (const attempt of attempts) {
      if (ctrl.signal.aborted) break;
      try {
        const body = await attempt(ctrl.signal);
        memory.set(key, { at: Date.now(), body });
        prune();
        return body;
      } catch { /* provider berikutnya */ }
    }
  } finally {
    clearTimeout(timer);
  }

  return { ok: false, error: ctrl.signal.aborted ? "unavailable" : "notfound" };
}

export function cacheControlFor(body: GeocodeResponse): string {
  return body.ok
    ? "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800"
    : "no-store";
}