import { hashStr } from "./format";

export interface ParsedAddress {
  raw: string; parts: string[]; street: string; area: string;
  city: string; province: string; postcode: string; label: string;
}

const PROVINCES = [
  "Aceh", "Sumatera Utara", "Sumatera Barat", "Riau", "Kepulauan Riau", "Jambi", "Bengkulu",
  "Sumatera Selatan", "Bangka Belitung", "Lampung", "Banten", "DKI Jakarta", "Jawa Barat",
  "Jawa Tengah", "DI Yogyakarta", "Jawa Timur", "Bali", "Nusa Tenggara Barat", "Nusa Tenggara Timur",
  "Kalimantan Barat", "Kalimantan Tengah", "Kalimantan Selatan", "Kalimantan Timur", "Kalimantan Utara",
  "Sulawesi Utara", "Gorontalo", "Sulawesi Tengah", "Sulawesi Barat", "Sulawesi Tenggara", "Sulawesi Selatan",
  "Maluku Utara", "Maluku", "Papua Barat", "Papua Selatan", "Papua Tengah", "Papua Pegunungan", "Papua",
];

export const GAZETTEER: { name: string; lat: number; lon: number; zoom: number }[] = [
  { name: "Malioboro", lat: -7.7925, lon: 110.3657, zoom: 17 },
  { name: "Tugu Yogyakarta", lat: -7.7829, lon: 110.3671, zoom: 17 },
  { name: "Kebayoran Baru", lat: -6.2444, lon: 106.7997, zoom: 16 },
  { name: "Kebayoran Lama", lat: -6.2385, lon: 106.7819, zoom: 16 },
  { name: "Kemang", lat: -6.2604, lon: 106.8135, zoom: 17 },
  { name: "Mampang Prapatan", lat: -6.2465, lon: 106.8236, zoom: 16 },
  { name: "Cilandak", lat: -6.2894, lon: 106.7987, zoom: 16 },
  { name: "Pasar Minggu", lat: -6.2841, lon: 106.8443, zoom: 16 },
  { name: "Jagakarsa", lat: -6.3346, lon: 106.8236, zoom: 15 },
  { name: "Pesanggrahan", lat: -6.2578, lon: 106.7561, zoom: 15 },
  { name: "Tebet", lat: -6.2266, lon: 106.8503, zoom: 16 },
  { name: "Pancoran", lat: -6.2429, lon: 106.8425, zoom: 16 },
  { name: "Setiabudi", lat: -6.2166, lon: 106.8306, zoom: 16 },
  { name: "Kuningan", lat: -6.2247, lon: 106.8302, zoom: 17 },
  { name: "Sudirman", lat: -6.2088, lon: 106.8228, zoom: 17 },
  { name: "Thamrin", lat: -6.1932, lon: 106.8231, zoom: 17 },
  { name: "Menteng", lat: -6.1965, lon: 106.8306, zoom: 16 },
  { name: "Senopati", lat: -6.2299, lon: 106.8085, zoom: 18 },
  { name: "Blok M", lat: -6.2444, lon: 106.7991, zoom: 18 },
  { name: "Senayan", lat: -6.2258, lon: 106.8016, zoom: 17 },
  { name: "Gambir", lat: -6.1764, lon: 106.8309, zoom: 17 },
  { name: "Monas", lat: -6.1754, lon: 106.8272, zoom: 17 },
  { name: "Kota Tua", lat: -6.1352, lon: 106.8133, zoom: 17 },
  { name: "Kelapa Gading", lat: -6.1583, lon: 106.9061, zoom: 16 },
  { name: "Tanjung Priok", lat: -6.1122, lon: 106.8814, zoom: 15 },
  { name: "Cempaka Putih", lat: -6.1817, lon: 106.8683, zoom: 16 },
  { name: "Rawamangun", lat: -6.1936, lon: 106.8869, zoom: 16 },
  { name: "Jatinegara", lat: -6.2166, lon: 106.8703, zoom: 16 },
  { name: "Kramat Jati", lat: -6.2664, lon: 106.8683, zoom: 15 },
  { name: "Pasar Rebo", lat: -6.3236, lon: 106.8606, zoom: 15 },
  { name: "Cengkareng", lat: -6.1467, lon: 106.7386, zoom: 15 },
  { name: "Grogol", lat: -6.1666, lon: 106.7903, zoom: 16 },
  { name: "Taman Sari", lat: -6.1467, lon: 106.8133, zoom: 16 },
  { name: "Kebon Jeruk", lat: -6.1936, lon: 106.7683, zoom: 16 },
  { name: "Palmerah", lat: -6.1936, lon: 106.7961, zoom: 16 },
  { name: "Slipi", lat: -6.2016, lon: 106.7975, zoom: 17 },
  { name: "Jakarta Selatan", lat: -6.2615, lon: 106.8106, zoom: 14 },
  { name: "Jakarta Pusat", lat: -6.1862, lon: 106.8340, zoom: 14 },
  { name: "Jakarta Barat", lat: -6.1683, lon: 106.7588, zoom: 14 },
  { name: "Jakarta Utara", lat: -6.1385, lon: 106.8827, zoom: 14 },
  { name: "Jakarta Timur", lat: -6.2250, lon: 106.9004, zoom: 14 },
  { name: "Depok", lat: -6.4025, lon: 106.7942, zoom: 14 },
  { name: "Bogor", lat: -6.5950, lon: 106.8166, zoom: 14 },
  { name: "Bekasi", lat: -6.2383, lon: 106.9756, zoom: 14 },
  { name: "Tangerang Selatan", lat: -6.3227, lon: 106.7089, zoom: 14 },
  { name: "Tangerang", lat: -6.1783, lon: 106.6319, zoom: 14 },
  { name: "BSD", lat: -6.3019, lon: 106.6527, zoom: 16 },
  { name: "Bintaro", lat: -6.2712, lon: 106.7213, zoom: 16 },
  { name: "Alam Sutera", lat: -6.2417, lon: 106.6527, zoom: 16 },
  { name: "Bandung", lat: -6.9175, lon: 107.6191, zoom: 14 },
  { name: "Dago", lat: -6.8853, lon: 107.6136, zoom: 16 },
  { name: "Braga", lat: -6.9174, lon: 107.6098, zoom: 17 },
  { name: "Cimahi", lat: -6.8841, lon: 107.5413, zoom: 14 },
  { name: "Cirebon", lat: -6.7320, lon: 108.5523, zoom: 14 },
  { name: "Tasikmalaya", lat: -7.3274, lon: 108.2207, zoom: 14 },
  { name: "Garut", lat: -7.2107, lon: 107.9087, zoom: 14 },
  { name: "Semarang", lat: -6.9667, lon: 110.4167, zoom: 14 },
  { name: "Surakarta", lat: -7.5755, lon: 110.8243, zoom: 14 },
  { name: "Solo", lat: -7.5755, lon: 110.8243, zoom: 14 },
  { name: "Yogyakarta", lat: -7.7956, lon: 110.3695, zoom: 14 },
  { name: "Sleman", lat: -7.7162, lon: 110.3558, zoom: 14 },
  { name: "Bantul", lat: -7.8880, lon: 110.3288, zoom: 14 },
  { name: "Magelang", lat: -7.4797, lon: 110.2177, zoom: 14 },
  { name: "Purwokerto", lat: -7.4244, lon: 109.2300, zoom: 14 },
  { name: "Tegal", lat: -6.8694, lon: 109.1402, zoom: 14 },
  { name: "Pekalongan", lat: -6.8898, lon: 109.6753, zoom: 14 },
  { name: "Surabaya", lat: -7.2575, lon: 112.7521, zoom: 14 },
  { name: "Malang", lat: -7.9666, lon: 112.6326, zoom: 14 },
  { name: "Batu", lat: -7.8671, lon: 112.5239, zoom: 14 },
  { name: "Sidoarjo", lat: -7.4478, lon: 112.7183, zoom: 14 },
  { name: "Kediri", lat: -7.8480, lon: 112.0178, zoom: 14 },
  { name: "Jember", lat: -8.1845, lon: 113.6681, zoom: 14 },
  { name: "Banyuwangi", lat: -8.2192, lon: 114.3691, zoom: 14 },
  { name: "Denpasar", lat: -8.6705, lon: 115.2126, zoom: 14 },
  { name: "Kuta", lat: -8.7184, lon: 115.1686, zoom: 16 },
  { name: "Canggu", lat: -8.6478, lon: 115.1385, zoom: 16 },
  { name: "Ubud", lat: -8.5069, lon: 115.2625, zoom: 16 },
  { name: "Seminyak", lat: -8.6913, lon: 115.1682, zoom: 17 },
  { name: "Gianyar", lat: -8.5439, lon: 115.3255, zoom: 14 },
  { name: "Mataram", lat: -8.5833, lon: 116.1167, zoom: 14 },
  { name: "Kupang", lat: -10.1772, lon: 123.6070, zoom: 14 },
  { name: "Medan", lat: 3.5952, lon: 98.6722, zoom: 14 },
  { name: "Padang", lat: -0.9471, lon: 100.4172, zoom: 14 },
  { name: "Pekanbaru", lat: 0.5071, lon: 101.4478, zoom: 14 },
  { name: "Palembang", lat: -2.9761, lon: 104.7754, zoom: 14 },
  { name: "Bandar Lampung", lat: -5.3971, lon: 105.2668, zoom: 14 },
  { name: "Jambi", lat: -1.6101, lon: 103.6131, zoom: 14 },
  { name: "Bengkulu", lat: -3.8004, lon: 102.2655, zoom: 14 },
  { name: "Pontianak", lat: -0.0263, lon: 109.3425, zoom: 14 },
  { name: "Banjarmasin", lat: -3.3186, lon: 114.5944, zoom: 14 },
  { name: "Samarinda", lat: -0.5022, lon: 117.1536, zoom: 14 },
  { name: "Balikpapan", lat: -1.2379, lon: 116.8529, zoom: 14 },
  { name: "Manado", lat: 1.4748, lon: 124.8421, zoom: 14 },
  { name: "Makassar", lat: -5.1477, lon: 119.4327, zoom: 14 },
  { name: "Kendari", lat: -3.9985, lon: 122.5129, zoom: 14 },
  { name: "Palu", lat: -0.9003, lon: 119.8779, zoom: 14 },
  { name: "Ambon", lat: -3.6954, lon: 128.1814, zoom: 14 },
  { name: "Jayapura", lat: -2.5916, lon: 140.6690, zoom: 14 },
  { name: "Sorong", lat: -0.8762, lon: 131.2558, zoom: 14 },
  { name: "Jakarta", lat: -6.2088, lon: 106.8456, zoom: 13 },
  { name: "Bali", lat: -8.4095, lon: 115.1889, zoom: 11 },
  { name: "Jawa Barat", lat: -6.9147, lon: 107.6098, zoom: 10 },
  { name: "Jawa Tengah", lat: -7.1500, lon: 110.1403, zoom: 10 },
  { name: "Jawa Timur", lat: -7.5360, lon: 112.2384, zoom: 10 },
  { name: "Indonesia", lat: -2.5, lon: 118.0, zoom: 6 },
];

const CITIES = GAZETTEER.filter((g) => g.zoom <= 14).map((g) => g.name);

export function parseAddress(raw: string): ParsedAddress {
  const clean = (raw || "").replace(/\s+/g, " ").trim();
  const parts = clean.split(",").map((p) => p.trim()).filter(Boolean);
  const postcode = clean.match(/\b\d{5}\b/)?.[0] ?? "";
  const lower = clean.toLowerCase();
  const findIn = (list: string[]) =>
    list.filter((x) => lower.includes(x.toLowerCase())).sort((a, b) => b.length - a.length)[0] ?? "";

  const province = findIn(PROVINCES);
  let city = findIn(CITIES);
  if (!city) {
    const m = clean.match(/\b(?:Kota|Kabupaten|Kab\.)\s+[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)?/);
    if (m) city = m[0].replace(/^Kab\.\s*/, "Kabupaten ");
  }
  if (!city && /jakarta/i.test(clean)) city = "Jakarta";

  const street = parts.find((p) => /^(jl\.?|jalan|gang|gg\.?|komplek|kompleks|perum|perumahan|gedung|graha|plaza|ruko|kawasan)\b/i.test(p)) ?? "";
  const used = (p: string) => {
    const l = p.toLowerCase();
    if (street && l === street.toLowerCase()) return true;
    if (postcode && p.includes(postcode)) return true;
    if (city && l.includes(city.toLowerCase())) return true;
    if (province && l.includes(province.toLowerCase())) return true;
    if (/^(indonesia|rt|rw|no|blok|lantai|lt)\b/i.test(p)) return true;
    if (/^(jl\.?|jalan|gang|gg\.?)\b/i.test(p)) return true;
    return false;
  };
  const area = parts.find((p) => !used(p) && /[a-zA-Z]/.test(p)) ?? "";
  const label = area || city || province || parts[0] || "Lokasi kedai";
  return { raw: clean, parts, street, area, city, province, postcode, label };
}

export interface GeoPoint { lat: number; lon: number; zoom: number; label: string; precise: boolean }

export function gazetteerLookup(address: string): GeoPoint | null {
  const lower = (address || "").toLowerCase();
  const hit = GAZETTEER.filter((g) => lower.includes(g.name.toLowerCase())).sort((a, b) => b.name.length - a.name.length)[0];
  if (!hit) return null;
  return { lat: hit.lat, lon: hit.lon, zoom: hit.zoom, label: hit.name, precise: hit.zoom >= 16 };
}

export function seededPoint(address: string): GeoPoint {
  const g = gazetteerLookup(address);
  if (g) return g;
  const base = GAZETTEER[GAZETTEER.length - 1];
  const h = hashStr(address || "nusapos");
  return {
    lat: base.lat + ((h % 200) - 100) / 100,
    lon: base.lon + (((h >> 8) % 200) - 100) / 100,
    zoom: 6, label: "Perkiraan wilayah", precise: false,
  };
}

/* ------------------------------ Google Maps ------------------------------ */
export const GOOGLE_MAPS_KEY = (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "").trim();

export const ZOOM_PRESET = { detail: 18, sekitar: 15, luas: 12 } as const;
export type ZoomPreset = keyof typeof ZOOM_PRESET;

/** Satu-satunya sumber peta: Google Maps. */
export function googleEmbedUrl(opts: {
  address: string;
  storeName: string;
  lat?: number;
  lon?: number;
  placeId?: string;
  zoom: number;
}) {
  const z = Math.max(3, Math.min(21, Math.round(opts.zoom)));
  const query = opts.placeId && GOOGLE_MAPS_KEY
    ? `place_id:${opts.placeId}`
    : `${opts.storeName}, ${opts.address}`;

  if (GOOGLE_MAPS_KEY) {
    const p = new URLSearchParams({
      key: GOOGLE_MAPS_KEY,
      q: query,
      zoom: String(z),
      maptype: "roadmap",
      language: "id",
      region: "ID",
    });
    return `https://www.google.com/maps/embed/v1/place?${p.toString()}`;
  }
  const p = new URLSearchParams({ q: query, z: String(z), hl: "id", output: "embed" });
  return `https://maps.google.com/maps?${p.toString()}`;
}

export function googleSearchUrl(address: string, storeName: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${storeName}, ${address}`)}`;
}

export function googleDirectionsUrl(address: string, storeName: string, lat?: number, lon?: number) {
  const dest = lat !== undefined && lon !== undefined ? `${lat},${lon}` : `${storeName}, ${address}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}&travelmode=driving`;
}

export interface GeocodeResult {
  ok: boolean;
  lat?: number;
  lon?: number;
  placeId?: string;
  displayName?: string;
  detail?: Record<string, string>;
  source?: "google" | "nominatim" | "photon";
  error?: string;
}

const CACHE_PREFIX = "nusapos:geo:";
const CACHE_TTL = 1000 * 60 * 60 * 24 * 7;

export async function geocodeAddress(address: string, signal?: AbortSignal): Promise<GeocodeResult> {
  const key = CACHE_PREFIX + hashStr(address.toLowerCase().trim());
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const hit = JSON.parse(raw) as { at: number; body: GeocodeResult };
      if (hit?.body?.ok && Date.now() - hit.at < CACHE_TTL) return hit.body;
    }
  } catch { /* abaikan */ }

  const res = await fetch(`/api/geocode?q=${encodeURIComponent(address)}`, { signal, cache: "no-store" });
  if (!res.ok) throw new Error("geocode");
  const body = (await res.json()) as GeocodeResult;
  if (body.ok) {
    try { localStorage.setItem(key, JSON.stringify({ at: Date.now(), body })); } catch { /* penuh */ }
  }
  return body;
}