"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth, useStore } from "@/lib/store";
import { useToast } from "@/components/Toasts";
import { sfx } from "@/lib/sound";
import type { Product, ProductKind, SavedView } from "@/lib/types";
import { CATEGORIES, CATEGORY_COLORS } from "@/lib/types";
import { download, num, rupiah, toCSV, uid } from "@/lib/format";
import { soldMap } from "@/lib/analytics";
import {
  DAY_ORDER, DAY_SHORT, activeDiscount, daysLabel, discountLabel, effectivePrice,
  hasAnyPromo, hasDiscount, isAvailableToday, isLimited, promoDays, stockOf, todayPromo,
} from "@/lib/pricing";
import { ProductThumb } from "@/components/ProductThumb";
import { ProductForm } from "@/components/ProductForm";
import { Highlight, SearchField } from "@/components/SearchField";
import { Badge, Button, EmptyState, IconBtn, Input, PageSkel, Select, Toggle, useClickOutside } from "@/components/ui";
import {
  IBookmark, IBox, ICalendar, ICheck, IChevronDown, IChevronUp, IDownload, IFilter,
  IGrip, IImage, IMenu, IMinus, IPen, IPercent, IPlus, IRefresh, ISparkle, ITag, ITrash, IX,
} from "@/components/icons";

const SORTS = [
  { v: "manual", l: "Urutan manual (drag)" },
  { v: "name", l: "Nama A–Z" },
  { v: "price-asc", l: "Harga termurah" },
  { v: "price-desc", l: "Harga termahal" },
  { v: "stock-asc", l: "Stok paling sedikit" },
  { v: "sold-desc", l: "Paling laris" },
  { v: "discount-desc", l: "Diskon terbesar" },
];

export default function ProdukPage() {
  return (
    <Suspense fallback={<PageSkel />}>
      <Produk />
    </Suspense>
  );
}

function Produk() {
  const { state, dispatch } = useStore();
  const { can, isAdmin } = useAuth();
  const { push } = useToast();
  const router = useRouter();
  const sp = useSearchParams();
  const viewsRef = useRef<HTMLDivElement>(null);
  const manage = can("products.manage");

  const [q, setQ] = useState(sp.get("q") ?? "");
  const [cats, setCats] = useState<string[]>([]);
  const [kind, setKind] = useState("all");
  const [status, setStatus] = useState("Semua");
  const [sort, setSort] = useState("manual");
  const [view, setView] = useState<"grid" | "table">("grid");
  const [today, setToday] = useState(false);
  const [discOnly, setDiscOnly] = useState(false);
  const [promoToday, setPromoToday] = useState(false);
  const [lowOnly, setLowOnly] = useState(false);
  const [limitedOnly, setLimitedOnly] = useState(false);
  const [photoOnly, setPhotoOnly] = useState(false);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [form, setForm] = useState<{ open: boolean; product: Product | null; kind: ProductKind }>({ open: false, product: null, kind: "single" });
  const [viewsOpen, setViewsOpen] = useState(false);
  const [viewName, setViewName] = useState("");
  useClickOutside(viewsRef, () => setViewsOpen(false));

  useEffect(() => { setQ(sp.get("q") ?? ""); }, [sp]);

  useEffect(() => {
    if (!state.hydrated || !manage) return;
    const edit = sp.get("edit");
    if (edit) {
      const p = state.products.find((x) => x.id === edit);
      if (p) setForm({ open: true, product: p, kind: p.kind });
    } else if (sp.get("new")) {
      setForm({ open: true, product: null, kind: sp.get("new") === "bundle" ? "bundle" : "single" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp, state.hydrated, manage]);

  const sold = useMemo(() => soldMap(state.transactions), [state.transactions]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const min = Number(minPrice) || 0;
    const max = Number(maxPrice) || Infinity;
    let list = state.products.filter((p) => {
      const eff = effectivePrice(p);
      if (cats.length && !cats.includes(p.category)) return false;
      if (kind !== "all" && p.kind !== kind) return false;
      if (status !== "Semua" && (status === "Aktif" ? !p.active : p.active)) return false;
      if (today && !isAvailableToday(p)) return false;
      if (discOnly && !hasAnyPromo(p)) return false;
      if (promoToday && !todayPromo(p)) return false;
      if (lowOnly && stockOf(p, state.products) > state.settings.lowStock) return false;
      if (limitedOnly && !isLimited(p)) return false;
      if (photoOnly && !p.photo) return false;
      if (eff < min || eff > max) return false;
      if (s && !(p.name.toLowerCase().includes(s) || p.sku.toLowerCase().includes(s) || p.desc.toLowerCase().includes(s) || p.category.toLowerCase().includes(s))) return false;
      return true;
    });
    switch (sort) {
      case "name": list = [...list].sort((a, b) => a.name.localeCompare(b.name)); break;
      case "price-asc": list = [...list].sort((a, b) => effectivePrice(a) - effectivePrice(b)); break;
      case "price-desc": list = [...list].sort((a, b) => effectivePrice(b) - effectivePrice(a)); break;
      case "stock-asc": list = [...list].sort((a, b) => stockOf(a, state.products) - stockOf(b, state.products)); break;
      case "sold-desc": list = [...list].sort((a, b) => (sold.get(b.id) ?? 0) - (sold.get(a.id) ?? 0)); break;
      case "discount-desc": list = [...list].sort((a, b) => (b.price - effectivePrice(b)) - (a.price - effectivePrice(a))); break;
    }
    return list;
  }, [state.products, state.settings.lowStock, q, cats, kind, status, sort, sold, today, discOnly, promoToday, lowOnly, limitedOnly, photoOnly, minPrice, maxPrice]);

  if (!state.hydrated) return <PageSkel />;

  const activeFilters = [
    ...cats.map((c) => ({ key: `cat-${c}`, label: c, clear: () => setCats(cats.filter((x) => x !== c)) })),
    ...(kind !== "all" ? [{ key: "kind", label: kind === "bundle" ? "Paket" : "Satuan", clear: () => setKind("all") }] : []),
    ...(status !== "Semua" ? [{ key: "status", label: status, clear: () => setStatus("Semua") }] : []),
    ...(today ? [{ key: "today", label: "Tersedia hari ini", clear: () => setToday(false) }] : []),
    ...(promoToday ? [{ key: "promoToday", label: "Promo hari ini", clear: () => setPromoToday(false) }] : []),
    ...(discOnly ? [{ key: "disc", label: "Punya promo", clear: () => setDiscOnly(false) }] : []),
    ...(lowOnly ? [{ key: "low", label: "Stok menipis", clear: () => setLowOnly(false) }] : []),
    ...(limitedOnly ? [{ key: "limited", label: "Limited edition", clear: () => setLimitedOnly(false) }] : []),
    ...(photoOnly ? [{ key: "photo", label: "Punya foto", clear: () => setPhotoOnly(false) }] : []),
    ...(minPrice ? [{ key: "min", label: `Min ${rupiah(Number(minPrice))}`, clear: () => setMinPrice("") }] : []),
    ...(maxPrice ? [{ key: "max", label: `Maks ${rupiah(Number(maxPrice))}`, clear: () => setMaxPrice("") }] : []),
    ...(q ? [{ key: "q", label: `“${q}”`, clear: () => setQ("") }] : []),
  ];

  const resetAll = () => {
    setQ(""); setCats([]); setKind("all"); setStatus("Semua"); setToday(false); setPromoToday(false);
    setDiscOnly(false); setLowOnly(false); setLimitedOnly(false); setPhotoOnly(false);
    setMinPrice(""); setMaxPrice("");
    sfx.tap();
  };

  const closeForm = () => {
    setForm({ open: false, product: null, kind: "single" });
    if (sp.get("edit") || sp.get("new")) router.replace("/produk");
  };

  const deleteProducts = (ids: string[]) => {
    const entries = ids
      .map((id) => ({ product: state.products.find((p) => p.id === id)!, index: state.products.findIndex((p) => p.id === id) }))
      .filter((e) => e.product);
    dispatch({ type: "DELETE_PRODUCTS", ids });
    setSelected(new Set());
    sfx.remove();
    push({ msg: `${ids.length} produk dihapus`, type: "info", actionLabel: "Urungkan", onAction: () => dispatch({ type: "RESTORE_PRODUCTS", entries }) });
  };

  const exportCSV = (onlySelected: boolean) => {
    const list = onlySelected ? state.products.filter((p) => selected.has(p.id)) : filtered;
    const rows: (string | number)[][] = [["Nama", "SKU", "Kategori", "Jenis", "Harga", "Diskon Dasar", "Promo Hari", "Harga Hari Ini", "Modal", "Stok", "Terjual90h", "Hari Tersedia", "Foto", "Status"]];
    list.forEach((p) => rows.push([
      p.name, p.sku, p.category, p.kind === "bundle" ? "Paket" : "Satuan", p.price,
      p.discount.value > 0 ? discountLabel(p.discount) : "-",
      promoDays(p).map((d) => `${DAY_SHORT[d]} ${discountLabel(p.dayPromos.find((x) => x.day === d)!)}`).join(" | ") || "-",
      effectivePrice(p), p.cost, stockOf(p, state.products), sold.get(p.id) ?? 0,
      daysLabel(p), p.photo ? "Ada" : "Tidak", p.active ? "Aktif" : "Nonaktif",
    ]));
    download(`nusapos-produk-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(rows), "text/csv");
    push({ msg: `${list.length} produk diekspor ke CSV`, type: "ok" });
  };

  const toggleAll = () => {
    const all = filtered.length > 0 && filtered.every((p) => selected.has(p.id));
    setSelected(all ? new Set() : new Set(filtered.map((p) => p.id)));
  };

  const toggleOne = (id: string) => {
    const n = new Set(selected);
    if (n.has(id)) n.delete(id); else n.add(id);
    setSelected(n);
  };

  const applyView = (v: SavedView) => {
    setQ(v.search); setCats(v.cats ?? (v.category && v.category !== "Semua" ? [v.category] : []));
    setSort(v.sort); setStatus(v.status); setKind(v.kind ?? "all");
    setToday(!!v.today); setDiscOnly(!!v.discOnly); setPromoToday(!!v.promoToday);
    setLowOnly(!!v.lowOnly); setLimitedOnly(!!v.limitedOnly); setPhotoOnly(!!v.photoOnly);
    setMinPrice(v.minPrice ?? ""); setMaxPrice(v.maxPrice ?? "");
    setViewsOpen(false);
    sfx.tap();
    push({ msg: `View "${v.name}" diterapkan`, type: "ok" });
  };

  const saveView = () => {
    if (!viewName.trim()) return;
    dispatch({
      type: "SAVE_VIEW",
      view: {
        id: uid(), name: viewName.trim(), search: q, category: cats[0] ?? "Semua", sort, status,
        cats, kind, today, discOnly, promoToday, lowOnly, limitedOnly, photoOnly, minPrice, maxPrice,
      },
    });
    setViewName(""); setViewsOpen(false);
    sfx.add();
    push({ msg: "View tersimpan", type: "ok" });
  };

  const dragProps = (p: Product) => manage && sort === "manual" ? {
    draggable: true,
    onDragStart: (e: React.DragEvent) => { setDragId(p.id); e.dataTransfer.effectAllowed = "move"; },
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); setOverId(p.id); },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      if (dragId && dragId !== p.id) { dispatch({ type: "REORDER", dragId, overId: p.id }); sfx.tap(); }
      setDragId(null); setOverId(null);
    },
    onDragEnd: () => { setDragId(null); setOverId(null); },
  } : {};

  const countOf = (c: string) => state.products.filter((p) => p.category === c).length;
  const promoCount = state.products.filter((p) => !!todayPromo(p)).length;

  const DayDots = ({ p }: { p: Product }) => {
    const pd = promoDays(p);
    return (
      <span className="inline-flex gap-[3px]" title={`${daysLabel(p)}${pd.length ? ` · promo: ${pd.map((d) => DAY_SHORT[d]).join(", ")}` : ""}`}>
        {DAY_ORDER.map((d) => {
          const on = p.availableDays.includes(d);
          const hasPromo = pd.includes(d);
          return (
            <span key={d} className="w-[7px] h-[7px] rounded-full"
              style={{
                background: !on ? "var(--surface2)" : hasPromo ? "var(--amber)" : isLimited(p) ? "var(--magenta)" : "var(--accent)",
                boxShadow: hasPromo ? "0 0 0 1.5px color-mix(in srgb, var(--amber) 40%, transparent)" : undefined,
              }} />
          );
        })}
      </span>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3 rise">
        <div>
          <h1 className="font-display font-bold text-2xl flex items-center gap-2">
            Katalog Produk
            {!manage && <Badge color="var(--amber)">Mode lihat · kasir</Badge>}
          </h1>
          <p className="text-sm text-mute mt-0.5">
            {state.products.length} produk · {state.products.filter((p) => p.kind === "bundle").length} paket · {promoCount} promo aktif hari ini
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdmin && <Button variant="ghost" size="sm" onClick={() => exportCSV(false)}><IDownload size={14} /> CSV</Button>}
          {manage && (
            <>
              <Button variant="soft" onClick={() => setForm({ open: true, product: null, kind: "bundle" })}><ITag size={16} /> Paket Baru</Button>
              <Button onClick={() => setForm({ open: true, product: null, kind: "single" })}><IPlus size={16} /> Tambah Produk</Button>
            </>
          )}
        </div>
      </div>

      {/* SEARCH & FILTER */}
      <div className="card overflow-hidden rise" style={{ animationDelay: "50ms" }}>
        <div className="p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="grow min-w-[240px]">
              <SearchField
                value={q}
                onChange={setQ}
                size="lg"
                shortcut={form.open ? undefined : "/"}
                count={filtered.length}
                countLabel="produk"
                ariaLabel="Cari katalog produk"
                placeholder="Cari nama, SKU, kategori, atau deskripsi…"
                onEscape={() => setQ("")}
              />
            </div>
            <Select label="Urutkan" value={sort} onChange={setSort} className="w-full sm:w-52" options={SORTS} />
            <div className="inline-flex rounded-xl border border-line bg-bg2 p-1 gap-1">
              <IconBtn label="Tampilan kartu" className={`!border-0 !bg-transparent ${view === "grid" ? "!text-accent" : ""}`} onClick={() => { setView("grid"); sfx.tap(); }}><IBox size={16} /></IconBtn>
              <IconBtn label="Tampilan tabel" className={`!border-0 !bg-transparent ${view === "table" ? "!text-accent" : ""}`} onClick={() => { setView("table"); sfx.tap(); }}><IMenu size={16} /></IconBtn>
            </div>
            <Button variant={advanced ? "soft" : "ghost"} size="sm" onClick={() => setAdvanced((v) => !v)}>
              <IFilter size={14} /> Filter lanjutan
              {activeFilters.length > 0 && <span className="ml-1 rounded-full bg-accent text-accent-ink px-1.5 text-[10px]">{activeFilters.length}</span>}
            </Button>
            <div ref={viewsRef} className="relative">
              <Button variant="ghost" size="sm" onClick={() => setViewsOpen((v) => !v)}><IBookmark size={14} /> View <IChevronDown size={13} /></Button>
              {viewsOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 card p-2 z-30 anim-pop">
                  <p className="text-[10px] font-bold text-faint uppercase tracking-wider px-2 py-1">Tampilan tersimpan</p>
                  {state.views.map((v) => (
                    <div key={v.id} className="flex items-center gap-1 px-1">
                      <button onClick={() => applyView(v)} className="flex-1 text-left text-xs font-bold px-2 py-2 rounded-lg hover:bg-surface2 truncate">{v.name}</button>
                      {manage && <IconBtn label="Hapus view" className="!p-1" onClick={() => { dispatch({ type: "DELETE_VIEW", id: v.id }); sfx.remove(); }}><IX size={12} /></IconBtn>}
                    </div>
                  ))}
                  {state.views.length === 0 && <p className="text-xs text-faint px-2 py-2">Belum ada view.</p>}
                  {manage && (
                    <div className="border-t border-line mt-1 pt-2 flex gap-1 px-1">
                      <Input value={viewName} onChange={(e) => setViewName(e.target.value)} placeholder="Nama view baru…" className="py-1.5 text-xs"
                        onKeyDown={(e) => e.key === "Enter" && saveView()} />
                      <Button size="sm" onClick={saveView} disabled={!viewName.trim()}>Simpan</Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            <button onClick={() => setCats([])} className={`chip shrink-0 ${cats.length === 0 ? "chip-on" : ""}`}>
              Semua kategori <span className="opacity-60">{state.products.length}</span>
            </button>
            {CATEGORIES.map((c) => (
              <button key={c} onClick={() => setCats(cats.includes(c) ? cats.filter((x) => x !== c) : [...cats, c])}
                className={`chip shrink-0 ${cats.includes(c) ? "chip-on" : ""}`}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: cats.includes(c) ? "currentColor" : CATEGORY_COLORS[c] }} />
                {c} <span className="opacity-60">{countOf(c)}</span>
                {cats.includes(c) && <ICheck size={12} />}
              </button>
            ))}
            <span className="w-px shrink-0 bg-line mx-1" />
            {[
              { on: promoToday, set: () => setPromoToday(!promoToday), label: "Promo hari ini", icon: <IPercent size={12} /> },
              { on: kind === "bundle", set: () => setKind(kind === "bundle" ? "all" : "bundle"), label: "Paket", icon: <ITag size={12} /> },
              { on: today, set: () => setToday(!today), label: "Tersedia hari ini", icon: <ICalendar size={12} /> },
              { on: discOnly, set: () => setDiscOnly(!discOnly), label: "Punya promo", icon: <IPercent size={12} /> },
              { on: limitedOnly, set: () => setLimitedOnly(!limitedOnly), label: "Limited", icon: <ISparkle size={12} /> },
              { on: lowOnly, set: () => setLowOnly(!lowOnly), label: "Stok menipis", icon: <IBox size={12} /> },
            ].map((f) => (
              <button key={f.label} onClick={() => { f.set(); sfx.tap(); }} className={`chip shrink-0 ${f.on ? "chip-on" : ""}`}>
                {f.icon} {f.label}
              </button>
            ))}
          </div>

          {advanced && (
            <div className="rounded-2xl border border-line bg-surface p-3 grid sm:grid-cols-2 lg:grid-cols-4 gap-3 anim-pop">
              <Select label="Jenis" value={kind} onChange={setKind}
                options={[{ v: "all", l: "Semua jenis" }, { v: "single", l: "Satuan" }, { v: "bundle", l: "Paket bundling" }]} />
              <Select label="Status" value={status} onChange={setStatus}
                options={[{ v: "Semua", l: "Semua status" }, { v: "Aktif", l: "Aktif" }, { v: "Nonaktif", l: "Nonaktif" }]} />
              <div className="grid grid-cols-2 gap-2">
                <Input type="number" min={0} inputMode="numeric" placeholder="Harga min" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} />
                <Input type="number" min={0} inputMode="numeric" placeholder="Harga maks" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
              </div>
              <label className="flex items-center justify-between rounded-xl border border-line bg-bg2 px-3 text-xs font-bold">
                <span className="inline-flex items-center gap-1.5"><IImage size={14} /> Hanya punya foto</span>
                <Toggle small checked={photoOnly} label="Punya foto" onChange={setPhotoOnly} />
              </label>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-line">
            <span className="text-xs font-bold text-mute">
              <b className="text-accent">{filtered.length}</b> dari {state.products.length} produk
            </span>
            {activeFilters.map((f) => (
              <button key={f.key} onClick={f.clear}
                className="inline-flex items-center gap-1 rounded-full border border-line2 bg-surface2 px-2.5 py-1 text-[11px] font-bold hover:border-chili hover:text-chili transition-colors">
                {f.label} <IX size={11} />
              </button>
            ))}
            {activeFilters.length > 0 && (
              <button onClick={resetAll} className="text-[11px] font-bold text-faint hover:text-accent inline-flex items-center gap-1">
                <IRefresh size={12} /> Reset semua
              </button>
            )}
            {manage && sort === "manual" && <span className="ml-auto text-[11px] text-faint hidden sm:block">Drag kartu / baris untuk mengubah urutan kasir</span>}
            {!manage && <span className="ml-auto text-[11px] text-faint hidden sm:block">Harga & promo live · perubahan katalog hanya oleh admin</span>}
          </div>
        </div>
      </div>

      {/* GRID */}
      {view === "grid" && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-4">
          {filtered.map((p, i) => {
            const eff = effectivePrice(p);
            const st = stockOf(p, state.products);
            const out = st <= 0;
            const low = !out && st <= state.settings.lowStock;
            const avail = isAvailableToday(p);
            const promo = todayPromo(p);
            const scheduled = promoDays(p);
            return (
              <div key={p.id} {...dragProps(p)}
                className={`card overflow-hidden group relative transition-all hover:-translate-y-1 hover:border-line2 rise ${overId === p.id && dragId !== p.id ? "ring-2 ring-accent" : ""} ${dragId === p.id ? "opacity-40" : ""} ${!p.active ? "opacity-60" : ""}`}
                style={{ animationDelay: `${Math.min(i, 14) * 30}ms` }}>
                <div className="relative aspect-square">
                  <ProductThumb name={p.name} photo={p.photo} category={p.category} fill rounded={0} />
                  <div className="absolute inset-x-0 top-0 p-2 flex items-start justify-between gap-1">
                    {manage ? (
                      <input type="checkbox" aria-label={`Pilih ${p.name}`} checked={selected.has(p.id)} onChange={() => toggleOne(p.id)}
                        className="accent-[var(--accent)] w-4 h-4 rounded cursor-pointer" />
                    ) : <span />}
                    <div className="flex flex-col items-end gap-1">
                      {promo && <Badge color="var(--amber)"><IPercent size={10} /> {discountLabel(promo)} hari ini</Badge>}
                      {!promo && hasDiscount(p) && <Badge color="var(--amber)"><IPercent size={10} /> {discountLabel(p.discount)}</Badge>}
                      {!promo && scheduled.length > 0 && <Badge color="var(--violet)"><ICalendar size={10} /> Promo {scheduled.map((d) => DAY_SHORT[d]).join("/")}</Badge>}
                      {p.kind === "bundle" && <Badge color="var(--violet)"><ITag size={10} /> Paket</Badge>}
                      {isLimited(p) && <Badge color="var(--magenta)"><ISparkle size={10} /> Limited</Badge>}
                    </div>
                  </div>
                  {manage && sort === "manual" && (
                    <span className="absolute bottom-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab text-ink bg-overlay/80 rounded-lg p-1"><IGrip size={14} /></span>
                  )}
                  {(out || !avail) && (
                    <div className="absolute inset-0 grid place-items-center" style={{ background: "color-mix(in srgb, var(--bg) 62%, transparent)" }}>
                      <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-overlay border border-line2">
                        {out ? "Stok habis" : "Libur hari ini"}
                      </span>
                    </div>
                  )}
                </div>

                <div className="p-3">
                  <p className="text-[13px] font-bold leading-tight line-clamp-2 min-h-[2.4em]"><Highlight text={p.name} query={q} /></p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: CATEGORY_COLORS[p.category] }} />
                    <span className="text-[10px] text-faint font-mono truncate"><Highlight text={p.sku} query={q} /></span>
                  </div>
                  <div className="flex items-baseline gap-1.5 mt-2">
                    <span className="font-display font-bold text-accent">{rupiah(eff)}</span>
                    {hasDiscount(p) && <span className="text-[11px] text-faint line-through">{rupiah(p.price)}</span>}
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className={`text-[11px] font-bold ${out ? "text-chili" : low ? "text-amber" : "text-mute"}`}>
                      {p.kind === "bundle" ? `${num(st)} porsi` : `Stok ${num(st)}`}
                    </span>
                    <DayDots p={p} />
                  </div>
                  <div className="flex items-center gap-1 mt-3 pt-2 border-t border-line">
                    {manage ? (
                      <>
                        <Toggle small checked={p.active} label={`Aktifkan ${p.name}`} onChange={(v) => { dispatch({ type: "SET_ACTIVE", ids: [p.id], active: v }); sfx.tap(); }} />
                        <span className="text-[10px] text-faint ml-1">terjual {num(sold.get(p.id) ?? 0)}</span>
                        <span className="ml-auto flex gap-1">
                          <IconBtn label="Edit" className="!p-1.5" onClick={() => setForm({ open: true, product: p, kind: p.kind })}><IPen size={14} /></IconBtn>
                          <IconBtn label="Hapus" className="!p-1.5 hover:!text-chili" onClick={() => deleteProducts([p.id])}><ITrash size={14} /></IconBtn>
                        </span>
                      </>
                    ) : (
                      <>
                        <Badge color={p.active ? "var(--pandan)" : "var(--chili)"}>{p.active ? "Aktif" : "Nonaktif"}</Badge>
                        <span className="text-[10px] text-faint ml-auto">terjual {num(sold.get(p.id) ?? 0)}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TABEL */}
      {view === "table" && (
        <div className="card overflow-hidden rise" style={{ animationDelay: "80ms" }}>
          <div className="overflow-auto max-h-[64vh]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-surface2 text-left text-[11px] uppercase tracking-wider text-faint">
                <tr>
                  {manage && <th className="px-3 py-3 w-10"><input type="checkbox" aria-label="Pilih semua" className="accent-[var(--accent)]" checked={filtered.length > 0 && filtered.every((p) => selected.has(p.id))} onChange={toggleAll} /></th>}
                  {manage && <th className="w-8" />}
                  <th className="px-3 py-3">Produk</th>
                  <th className="px-3 py-3">Kategori</th>
                  <th className="px-3 py-3 text-right">Harga hari ini</th>
                  <th className="px-3 py-3 text-center">Stok</th>
                  <th className="px-3 py-3 text-center">Jadwal & promo</th>
                  <th className="px-3 py-3 text-right">Terjual</th>
                  <th className="px-3 py-3 text-center">Aktif</th>
                  {manage && <th className="px-3 py-3 text-right">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.map((p) => {
                  const eff = effectivePrice(p);
                  const st = stockOf(p, state.products);
                  const promo = todayPromo(p);
                  return (
                    <tr key={p.id} {...dragProps(p)}
                      className={`transition-colors hover:bg-surface2/60 ${overId === p.id && dragId !== p.id ? "ring-2 ring-accent" : ""} ${dragId === p.id ? "opacity-40" : ""}`}>
                      {manage && <td className="px-3 py-2.5"><input type="checkbox" aria-label={`Pilih ${p.name}`} className="accent-[var(--accent)]" checked={selected.has(p.id)} onChange={() => toggleOne(p.id)} /></td>}
                      {manage && <td className={sort === "manual" ? "cursor-grab text-faint" : "text-faint opacity-30"}><IGrip size={15} /></td>}
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <ProductThumb name={p.name} photo={p.photo} category={p.category} size={38} rounded={10} />
                          <div className="min-w-0">
                            <p className="font-bold text-[13px] truncate max-w-[220px]"><Highlight text={p.name} query={q} /></p>
                            <p className="text-[10px] text-faint font-mono flex items-center gap-1.5">
                              <Highlight text={p.sku} query={q} />
                              {p.kind === "bundle" && <Badge color="var(--violet)">Paket</Badge>}
                              {isLimited(p) && <Badge color="var(--magenta)">Limited</Badge>}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5"><Badge color={CATEGORY_COLORS[p.category]}>{p.category}</Badge></td>
                      <td className="px-3 py-2.5 text-right">
                        <p className="font-mono font-bold">{rupiah(eff)}</p>
                        {hasDiscount(p) && (
                          <p className="text-[10px] font-mono" style={{ color: promo ? "var(--amber)" : "var(--muted)" }}>
                            {discountLabel(activeDiscount(p))}{promo ? ` · promo ${DAY_SHORT[new Date().getDay()]}` : ""} · <span className="line-through text-faint">{rupiah(p.price)}</span>
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {p.kind === "bundle" || !manage ? (
                          <p className={`text-center font-mono font-bold ${p.kind === "bundle" ? "text-violet" : ""}`}>{num(st)}{p.kind === "bundle" ? " porsi" : ""}</p>
                        ) : (
                          <div className="flex items-center justify-center gap-1.5">
                            <IconBtn label="Kurangi stok" className="!p-0.5" onClick={() => { dispatch({ type: "ADJUST_STOCK", id: p.id, delta: -1 }); sfx.tap(); }}><IMinus size={11} /></IconBtn>
                            <span className={`font-mono font-bold w-8 text-center ${st === 0 ? "text-chili" : st <= state.settings.lowStock ? "text-amber" : ""}`}>{st}</span>
                            <IconBtn label="Tambah stok" className="!p-0.5" onClick={() => { dispatch({ type: "ADJUST_STOCK", id: p.id, delta: 1 }); sfx.tap(); }}><IPlus size={11} /></IconBtn>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center"><DayDots p={p} /></td>
                      <td className="px-3 py-2.5 text-right font-mono text-mute">{num(sold.get(p.id) ?? 0)}</td>
                      <td className="px-3 py-2.5 text-center">
                        {manage
                          ? <Toggle small checked={p.active} label={`Aktifkan ${p.name}`} onChange={(v) => { dispatch({ type: "SET_ACTIVE", ids: [p.id], active: v }); sfx.tap(); }} />
                          : <Badge color={p.active ? "var(--pandan)" : "var(--chili)"}>{p.active ? "Aktif" : "Off"}</Badge>}
                      </td>
                      {manage && (
                        <td className="px-3 py-2.5">
                          <div className="flex justify-end gap-1">
                            <IconBtn label="Naikkan" className="!p-1.5" onClick={() => dispatch({ type: "MOVE_PRODUCT", id: p.id, dir: -1 })}><IChevronUp size={13} /></IconBtn>
                            <IconBtn label="Turunkan" className="!p-1.5" onClick={() => dispatch({ type: "MOVE_PRODUCT", id: p.id, dir: 1 })}><IChevronDown size={13} /></IconBtn>
                            <IconBtn label="Edit" className="!p-1.5" onClick={() => setForm({ open: true, product: p, kind: p.kind })}><IPen size={14} /></IconBtn>
                            <IconBtn label="Hapus" className="!p-1.5 hover:!text-chili" onClick={() => deleteProducts([p.id])}><ITrash size={14} /></IconBtn>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {filtered.length === 0 && (
        <div className="card">
          <EmptyState emoji="🔍" title={state.products.length === 0 ? "Katalog masih kosong" : "Tidak ada produk yang cocok"}
            desc={state.products.length === 0 ? "Administrator bisa menambahkan produk atau mengacak ulang data demo." : "Coba longgarkan filter atau ubah kata kunci pencarian."}>
            <Button variant="ghost" size="sm" onClick={resetAll}>Reset Semua Filter</Button>
            {manage && <Button size="sm" onClick={() => setForm({ open: true, product: null, kind: "single" })}><IPlus size={14} /> Tambah Produk</Button>}
          </EmptyState>
        </div>
      )}

      {/* BULK */}
      {manage && selected.size > 0 && (
        <div className="fixed bottom-24 lg:bottom-8 left-1/2 -translate-x-1/2 z-40 card px-4 py-3 flex flex-wrap items-center justify-center gap-2 anim-pop max-w-[94vw]">
          <span className="text-xs font-bold text-accent">{selected.size} dipilih</span>
          <Button variant="soft" size="sm" onClick={() => { dispatch({ type: "SET_DISCOUNT", ids: [...selected], discount: { type: "pct", value: 10 } }); sfx.add(); push({ msg: `Diskon dasar 10% ke ${selected.size} produk`, type: "ok" }); setSelected(new Set()); }}>
            <IPercent size={13} /> Diskon 10%
          </Button>
          <Button variant="soft" size="sm" onClick={() => { dispatch({ type: "SET_DISCOUNT", ids: [...selected], discount: { type: "pct", value: 0 } }); sfx.tap(); push({ msg: "Diskon dasar dihapus", type: "ok" }); setSelected(new Set()); }}>Hapus diskon</Button>
          <Button variant="ghost" size="sm" onClick={() => { dispatch({ type: "SET_ACTIVE", ids: [...selected], active: true }); push({ msg: `${selected.size} produk diaktifkan`, type: "ok" }); setSelected(new Set()); }}>Aktifkan</Button>
          <Button variant="ghost" size="sm" onClick={() => { dispatch({ type: "SET_ACTIVE", ids: [...selected], active: false }); push({ msg: `${selected.size} produk dinonaktifkan`, type: "ok" }); setSelected(new Set()); }}>Nonaktifkan</Button>
          {isAdmin && <Button variant="ghost" size="sm" onClick={() => exportCSV(true)}><IDownload size={13} /> CSV</Button>}
          <Button variant="danger" size="sm" onClick={() => deleteProducts([...selected])}><ITrash size={13} /> Hapus</Button>
          <IconBtn label="Batal pilih" onClick={() => setSelected(new Set())}><IX size={14} /></IconBtn>
        </div>
      )}

      {manage && <ProductForm open={form.open} product={form.product} presetKind={form.kind} onClose={closeForm} />}
    </div>
  );
}