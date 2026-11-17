"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "./Toasts";
import {
  GOOGLE_MAPS_KEY, GeocodeResult, ZOOM_PRESET, ZoomPreset, gazetteerLookup, geocodeAddress,
  googleDirectionsUrl, googleEmbedUrl, googleSearchUrl, parseAddress, seededPoint,
} from "@/lib/geo";
import { Badge, Button, IconBtn, Input, Segmented } from "./ui";
import {
  IAlert, IArrowRight, ICheck, ICheckCircle, IInfo, IMapPin, IMinus, IPlus, IRefresh, ISearch, IStore, IX,
} from "./icons";

export { parseAddress } from "@/lib/geo";

export function StoreMap({ address, storeName }: { address: string; storeName: string }) {
  const { push } = useToast();
  const parsed = useMemo(() => parseAddress(address), [address]);
  const fallback = useMemo(() => seededPoint(address), [address]);

  const [zoom, setZoom] = useState<number>(fallback.zoom);
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(
    fallback.precise ? { lat: fallback.lat, lon: fallback.lon } : null
  );
  const [placeId, setPlaceId] = useState<string | undefined>(undefined);
  const [placeName, setPlaceName] = useState(fallback.label);
  const [detail, setDetail] = useState<Record<string, string>>({});
  const [source, setSource] = useState<string>("");
  const [status, setStatus] = useState<"idle" | "loading" | "precise" | "approx">("idle");
  const [note, setNote] = useState("");
  const [query, setQuery] = useState(address);
  const [draft, setDraft] = useState(address);
  const [showLabel, setShowLabel] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [nonce, setNonce] = useState(0);
  const [copied, setCopied] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const loadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const g = gazetteerLookup(address) ?? seededPoint(address);
    setZoom(g.zoom);
    setCoords(g.precise ? { lat: g.lat, lon: g.lon } : null);
    setPlaceId(undefined);
    setPlaceName(g.label);
    setDetail({});
    setSource("");
    setQuery(address);
    setDraft(address);
    setNote("");
  }, [address]);

  const resolve = useCallback(async (q: string) => {
    const term = q.trim();
    if (term.length < 3) return;
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setStatus("loading");
    setNote("");
    try {
      const r: GeocodeResult = await geocodeAddress(term, ctrl.signal);
      if (r.ok && Number.isFinite(r.lat) && Number.isFinite(r.lon)) {
        setCoords({ lat: r.lat as number, lon: r.lon as number });
        setPlaceId(r.placeId);
        setPlaceName(r.displayName ?? term);
        setDetail(r.detail ?? {});
        setSource(r.source ?? "");
        setStatus("precise");
        setZoom((z) => (z < 16 ? 17 : z));
        return;
      }
      throw new Error("notfound");
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      const g = gazetteerLookup(term);
      if (g) {
        setCoords(g.precise ? { lat: g.lat, lon: g.lon } : null);
        setPlaceName(g.label);
        setStatus("approx");
        setNote("Pencarian titik belum berhasil. Google Maps tetap menampilkan alamat lengkap kedai — koordinat memakai basis lokasi offline.");
      } else {
        setStatus("approx");
        setNote("Alamat belum dikenali mesin pencari titik. Google Maps tetap memetakan alamat apa adanya — pertegas kata kunci bila perlu.");
      }
    }
  }, []);

  useEffect(() => {
    void resolve(query);
    return () => { if (abortRef.current) abortRef.current.abort(); };
  }, [query, resolve]);

  const embedUrl = useMemo(
    () => googleEmbedUrl({ address, storeName, lat: coords?.lat, lon: coords?.lon, placeId, zoom }),
    [address, storeName, coords, placeId, zoom]
  );

  useEffect(() => {
    setLoaded(false);
    setBlocked(false);
    if (loadTimer.current) clearTimeout(loadTimer.current);
    loadTimer.current = setTimeout(() => setBlocked((b) => (loaded ? b : true)), 11000);
    return () => { if (loadTimer.current) clearTimeout(loadTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embedUrl, nonce]);

  const chips = useMemo(() => {
    const d = detail;
    const picks = [
      d.neighbourhood || d.suburb || d.village || parsed.area,
      d.city_district || d.district,
      d.city || d.town || d.county || parsed.city,
      d.state || parsed.province,
      d.postcode || parsed.postcode,
    ].filter(Boolean) as string[];
    return [...new Set(picks)].slice(0, 5);
  }, [detail, parsed]);

  const preset: ZoomPreset | "custom" =
    zoom === ZOOM_PRESET.detail ? "detail" : zoom === ZOOM_PRESET.sekitar ? "sekitar" : zoom === ZOOM_PRESET.luas ? "luas" : "custom";

  const copyCoord = async () => {
    const text = coords ? `${coords.lat.toFixed(6)}, ${coords.lon.toFixed(6)}` : `${storeName}, ${address}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
      push({ msg: coords ? "Koordinat disalin" : "Alamat disalin", type: "ok" });
    } catch {
      push({ msg: text, type: "info", dur: 6000 });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge color="var(--chili)"><IMapPin size={10} /> Google Maps</Badge>
        <Segmented
          value={preset === "custom" ? "" : preset}
          onChange={(v) => { if (v) setZoom(ZOOM_PRESET[v as ZoomPreset]); }}
          options={[{ v: "detail", l: "Detail" }, { v: "sekitar", l: "Sekitar" }, { v: "luas", l: "Luas" }]}
        />
        <div className="flex items-center gap-1">
          <IconBtn label="Perkecil peta" onClick={() => setZoom((z) => Math.max(3, z - 1))}><IMinus size={15} /></IconBtn>
          <span className="text-[11px] font-mono font-bold w-10 text-center">z{zoom}</span>
          <IconBtn label="Perbesar peta" onClick={() => setZoom((z) => Math.min(21, z + 1))}><IPlus size={15} /></IconBtn>
        </div>
        <input type="range" min={3} max={21} step={1} value={zoom} aria-label="Tingkat zoom Google Maps"
          onChange={(e) => setZoom(Number(e.target.value))} className="w-28 cursor-pointer" />
        <IconBtn label="Muat ulang peta" onClick={() => setNonce((v) => v + 1)}><IRefresh size={15} /></IconBtn>
        <IconBtn label={showLabel ? "Sembunyikan label kedai" : "Tampilkan label kedai"} active={showLabel}
          onClick={() => setShowLabel((v) => !v)}><IStore size={15} /></IconBtn>
        <span className="ml-auto">
          {status === "loading" ? <Badge color="var(--laut)">mencari titik…</Badge>
            : status === "precise" ? <Badge color="var(--pandan)"><ICheckCircle size={10} /> titik presisi{source ? ` · ${source}` : ""}</Badge>
              : <Badge color="var(--amber)"><IInfo size={10} /> alamat langsung</Badge>}
        </span>
      </div>

      <div className="relative rounded-2xl border border-line overflow-hidden bg-surface2" style={{ aspectRatio: "16 / 10" }}>
        <iframe
          key={`${embedUrl}-${nonce}`}
          title={`Google Maps — ${storeName}, ${parsed.label}`}
          src={embedUrl}
          className="w-full h-full border-0 block"
          loading="lazy"
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
          onLoad={() => { setLoaded(true); setBlocked(false); }}
          onError={() => setBlocked(true)}
        />

        {!loaded && !blocked && (
          <div className="absolute inset-0 grid place-items-center pointer-events-none" style={{ background: "color-mix(in srgb, var(--bg) 58%, transparent)" }}>
            <div className="text-center">
              <IRefresh size={22} className="spin mx-auto text-accent" />
              <p className="text-[11px] text-faint mt-2">Memuat Google Maps · {parsed.label}…</p>
            </div>
          </div>
        )}

        {blocked && (
          <div className="absolute inset-0 grid place-items-center p-5" style={{ background: "color-mix(in srgb, var(--bg) 88%, transparent)" }}>
            <div className="text-center max-w-sm">
              <span className="w-12 h-12 rounded-2xl grid place-items-center mx-auto"
                style={{ color: "var(--amber)", background: "color-mix(in srgb, var(--amber) 15%, transparent)" }}>
                <IAlert size={22} />
              </span>
              <p className="font-display font-bold text-base mt-3">Google Maps belum termuat</p>
              <p className="text-[11.5px] text-mute mt-1.5 leading-relaxed">
                Jaringan atau pemblokir konten mungkin menahan peta. Coba muat ulang, atau buka lokasinya langsung di aplikasi Google Maps.
              </p>
              <div className="flex flex-wrap gap-2 justify-center mt-4">
                <Button size="sm" onClick={() => setNonce((v) => v + 1)}><IRefresh size={14} /> Muat ulang</Button>
                <a className="btn btn-ghost btn-sm" href={googleSearchUrl(address, storeName)} target="_blank" rel="noreferrer">
                  <IMapPin size={14} /> Buka Google Maps
                </a>
              </div>
            </div>
          </div>
        )}

        {showLabel && (
          <div className="absolute top-2 left-2 flex flex-wrap gap-1 pointer-events-none" style={{ zIndex: 3 }}>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line2 bg-overlay/92 backdrop-blur-sm px-2.5 py-1 text-[10px] font-bold shadow-lg">
              <IStore size={11} className="text-accent" /> {storeName}
            </span>
            {coords && (
              <span className="rounded-full border border-line2 bg-overlay/92 backdrop-blur-sm px-2.5 py-1 text-[10px] font-mono font-bold">
                {coords.lat.toFixed(5)}, {coords.lon.toFixed(5)}
              </span>
            )}
          </div>
        )}

        <div className="absolute bottom-1.5 right-1.5 rounded-md bg-overlay/90 backdrop-blur-sm px-2 py-0.5 text-[8.5px] text-faint" style={{ zIndex: 3 }}>
          Peta © Google
        </div>
      </div>

      <div className="rounded-xl border border-line bg-surface p-3">
        <div className="flex flex-wrap items-start gap-2">
          <IMapPin size={15} className="text-chili shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold leading-snug">{placeName || parsed.raw}</p>
            <p className="text-[10.5px] text-faint mt-1">{parsed.raw}</p>
            <div className="flex flex-wrap gap-1 mt-1.5">
              {chips.map((c) => (
                <span key={c} className="rounded-full border border-line bg-bg2 px-2 py-0.5 text-[9.5px] font-bold text-mute">{c}</span>
              ))}
            </div>
          </div>
        </div>

        {note && <p className="text-[10.5px] text-amber mt-2 flex gap-1.5"><IInfo size={12} className="shrink-0 mt-0.5" /> {note}</p>}

        <div className="flex flex-wrap gap-1.5 mt-3">
          <a className="btn btn-primary btn-sm" href={googleDirectionsUrl(address, storeName, coords?.lat, coords?.lon)} target="_blank" rel="noreferrer">
            <IArrowRight size={14} /> Petunjuk arah
          </a>
          <a className="btn btn-ghost btn-sm" href={googleSearchUrl(address, storeName)} target="_blank" rel="noreferrer">
            <IMapPin size={14} /> Buka di Google Maps
          </a>
          <Button variant="ghost" size="sm" onClick={copyCoord}>
            {copied ? <><ICheck size={14} /> Tersalin</> : <><IMapPin size={14} /> Salin {coords ? "koordinat" : "alamat"}</>}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => void resolve(query)}><IRefresh size={14} /> Cari ulang titik</Button>
        </div>

        <div className="mt-3 pt-3 border-t border-line">
          <p className="text-[10px] font-bold uppercase tracking-widest text-faint mb-1.5">Alamat kurang spesifik? Pertegas pencarian</p>
          <div className="flex gap-2">
            <Input value={draft} onChange={(e) => setDraft(e.target.value)} className="py-2 text-xs"
              placeholder="cth. Jl. Kemang Raya 12, Mampang Prapatan, Jakarta Selatan"
              onKeyDown={(e) => { if (e.key === "Enter") setQuery(draft); }} />
            <Button size="sm" onClick={() => setQuery(draft)} disabled={!draft.trim() || draft.trim() === query}><ISearch size={14} /> Cari</Button>
            {draft !== address && <IconBtn label="Kembali ke alamat admin" onClick={() => { setDraft(address); setQuery(address); }}><IX size={14} /></IconBtn>}
          </div>
          <p className="text-[10px] text-faint mt-1.5">
            Peta mengikuti alamat dari Pengaturan → Profil Toko. {GOOGLE_MAPS_KEY
              ? "Google Maps Embed API aktif dengan kunci resmi."
              : "Mode embed publik Google Maps — tambahkan NEXT_PUBLIC_GOOGLE_MAPS_API_KEY untuk presisi place_id resmi."}
          </p>
        </div>
      </div>
    </div>
  );
}