"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { BundleComponent, Category, DayPromo, Discount, Product, ProductKind } from "@/lib/types";
import { CATEGORIES } from "@/lib/types";
import { useStore } from "@/lib/store";
import { useToast } from "./Toasts";
import { sfx } from "@/lib/sound";
import { clamp, num, rupiah, uid } from "@/lib/format";
import { formatBytes } from "@/lib/brand";
import { PHOTO_LIMITS, processProductPhoto } from "@/lib/media";
import type { PhotoAspect, PhotoResult } from "@/lib/media";
import {
  ALL_DAYS, DAY_FULL, DAY_ORDER, DAY_SHORT, WEEKEND_DAYS, WORK_DAYS,
  activeDiscount, bundleBaseTotal, bundleStock, discountAmount, discountLabel, effectivePrice,
  fallbackEmoji, isAvailableToday, isLimited, makeSku, nextAvailableDay, productCost, productMargin, promoForDay,
} from "@/lib/pricing";
import { ProductThumb } from "./ProductThumb";
import { ProductAnalytics } from "./ProductAnalytics";
import { Highlight, SearchField } from "./SearchField";
import { Badge, Button, EmptyState, Field, IconBtn, Input, Modal, Segmented, Select, Textarea, Toggle } from "./ui";
import {
  IBox, ICalendar, IChart, ICheck, ICheckCircle, IImage, IInfo, IMinus, IPercent,
  IPlus, IRefresh, ISparkle, ITag, ITrash, IUpload, IX,
} from "./icons";

type Tab = "detail" | "foto" | "harga" | "paket" | "jadwal" | "analitik";

interface Draft {
  name: string;
  category: Category;
  kind: ProductKind;
  price: string;
  cost: string;
  stock: string;
  desc: string;
  active: boolean;
  photo: string | null;
  discType: Discount["type"];
  discValue: string;
  days: number[];
  promos: DayPromo[];
  bundleItems: BundleComponent[];
}

const emptyDraft = (kind: ProductKind): Draft => ({
  name: "", category: "Kopi", kind,
  price: "", cost: "", stock: "", desc: "", active: true, photo: null,
  discType: "pct", discValue: "", days: [...ALL_DAYS], promos: [], bundleItems: [],
});

export function ProductForm({ open, product, presetKind = "single", onClose }: {
  open: boolean; product: Product | null; presetKind?: ProductKind; onClose: () => void;
}) {
  const { state, dispatch } = useStore();
  const { push } = useToast();
  const [tab, setTab] = useState<Tab>("detail");
  const [draft, setDraft] = useState<Draft>(emptyDraft(presetKind));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [aspect, setAspect] = useState<PhotoAspect>("square");
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [photoInfo, setPhotoInfo] = useState<PhotoResult | null>(null);
  const [bundleQuery, setBundleQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setErrors({}); setTab("detail"); setPhotoInfo(null); setBundleQuery(""); setCopied(false);
    setDraft(product ? {
      name: product.name, category: product.category, kind: product.kind,
      price: String(product.price), cost: String(product.cost), stock: String(product.stock),
      desc: product.desc, active: product.active, photo: product.photo,
      discType: product.discount.type, discValue: product.discount.value ? String(product.discount.value) : "",
      days: [...product.availableDays],
      promos: product.dayPromos.map((x) => ({ ...x })),
      bundleItems: product.bundleItems.map((c) => ({ ...c })),
    } : emptyDraft(presetKind));
  }, [open, product, presetKind]);

  const skus = state.products.filter((p) => p.id !== product?.id).map((p) => p.sku);
  const previewSku = product?.sku ?? makeSku(draft.category, draft.kind, skus);

  const live: Product = useMemo(() => ({
    id: product?.id ?? "draft",
    name: draft.name.trim() || "Produk baru",
    sku: previewSku,
    category: draft.category,
    price: Math.max(0, Number(draft.price) || 0),
    cost: Math.max(0, Number(draft.cost) || 0),
    stock: Math.max(0, Number(draft.stock) || 0),
    emoji: product?.emoji ?? fallbackEmoji({ category: draft.category, kind: draft.kind }),
    active: draft.active,
    desc: draft.desc,
    popularity: product?.popularity ?? 5,
    photo: draft.photo,
    discount: { type: draft.discType, value: Math.max(0, Number(draft.discValue) || 0) },
    dayPromos: draft.promos,
    availableDays: draft.days,
    kind: draft.kind,
    bundleItems: draft.bundleItems,
  }), [draft, product, previewSku]);

  const today = new Date().getDay();
  const eff = effectivePrice(live);
  const cut = discountAmount(live.price, activeDiscount(live));
  const activeToday = activeDiscount(live);
  const promoToday = promoForDay(live, today);
  const baseTotal = bundleBaseTotal(live, state.products);
  const bStock = bundleStock(live, state.products);
  const margin = productMargin(live, state.products);
  const cost = productCost(live, state.products);
  const saved = product ? state.products.find((p) => p.id === product.id) ?? product : null;

  const candidates = useMemo(() => {
    const q = bundleQuery.trim().toLowerCase();
    return state.products.filter((p) =>
      p.kind === "single" && p.id !== product?.id &&
      !draft.bundleItems.some((c) => c.productId === p.id) &&
      (!q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.category.toLowerCase().includes(q))
    ).slice(0, 8);
  }, [state.products, bundleQuery, draft.bundleItems, product?.id]);

  const setQty = (id: string, delta: number) => {
    setDraft((d) => ({
      ...d,
      bundleItems: d.bundleItems
        .map((c) => (c.productId === id ? { ...c, qty: clamp(c.qty + delta, 0, 99) } : c))
        .filter((c) => c.qty > 0),
    }));
    sfx.tap();
  };

  const addComponent = (id: string) => {
    setDraft((d) => ({ ...d, bundleItems: [...d.bundleItems, { productId: id, qty: 1 }] }));
    sfx.add();
  };

  const handlePhoto = async (file?: File | null) => {
    if (!file) return;
    setBusy(true);
    try {
      const res = await processProductPhoto(file, aspect);
      setDraft((d) => ({ ...d, photo: res.dataUrl }));
      setPhotoInfo(res);
      sfx.success();
      push({ msg: `Foto produk terpasang • ${res.width}×${res.height} • ${formatBytes(res.bytes)}`, type: res.lowRes ? "info" : "ok" });
    } catch (e) {
      sfx.error();
      push({ msg: e instanceof Error ? e.message : "Gagal memproses gambar", type: "err" });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const toggleDay = (d: number) => {
    setDraft((prev) => ({
      ...prev,
      days: prev.days.includes(d) ? prev.days.filter((x) => x !== d) : [...prev.days, d].sort((a, b) => a - b),
      promos: prev.days.includes(d) ? prev.promos.filter((x) => x.day !== d) : prev.promos,
    }));
    sfx.tap();
  };

  const setDays = (days: number[]) => {
    setDraft((prev) => ({ ...prev, days: [...days].sort((a, b) => a - b), promos: prev.promos.filter((x) => days.includes(x.day)) }));
    sfx.tap();
  };

  const promoOf = (day: number) => draft.promos.find((x) => x.day === day) ?? null;

  const togglePromo = (day: number) => {
    setDraft((prev) => ({
      ...prev,
      promos: prev.promos.some((x) => x.day === day)
        ? prev.promos.filter((x) => x.day !== day)
        : [...prev.promos, { day, type: "pct", value: 10 }],
    }));
    sfx.tap();
  };

  const patchPromo = (day: number, patch: Partial<DayPromo>) => {
    setDraft((prev) => ({ ...prev, promos: prev.promos.map((x) => (x.day === day ? { ...x, ...patch } : x)) }));
  };

  const applyPromoAll = (type: Discount["type"], value: number) => {
    setDraft((prev) => ({ ...prev, promos: prev.days.map((day) => ({ day, type, value })) }));
    sfx.add();
    push({ msg: `Promo ${type === "pct" ? `${value}%` : rupiah(value)} diterapkan ke semua hari aktif`, type: "ok" });
  };

  const clearPromos = () => {
    setDraft((prev) => ({ ...prev, promos: [] }));
    sfx.remove();
  };

  const save = () => {
    const e: Record<string, string> = {};
    if (!draft.name.trim()) e.name = "Nama produk wajib diisi";
    if (!(Number(draft.price) > 0)) e.price = "Harga jual harus lebih dari 0";
    if (draft.kind === "single" && Number(draft.stock) < 0) e.stock = "Stok tidak boleh negatif";
    if (!draft.days.length) e.days = "Pilih minimal satu hari ketersediaan";
    if (draft.kind === "bundle" && draft.bundleItems.length < 2) e.bundle = "Paket butuh minimal 2 produk berbeda";
    setErrors(e);
    if (Object.keys(e).length) {
      sfx.error();
      setTab(e.price ? "harga" : e.days ? "jadwal" : e.bundle ? "paket" : "detail");
      push({ msg: Object.values(e)[0], type: "err" });
      return;
    }

    const p: Product = {
      ...live,
      id: product?.id ?? uid(),
      name: draft.name.trim(),
      sku: previewSku,
      desc: draft.desc.trim(),
      stock: draft.kind === "bundle" ? 0 : Math.max(0, Number(draft.stock) || 0),
      cost: draft.kind === "bundle" ? 0 : Math.max(0, Number(draft.cost) || 0),
      availableDays: [...draft.days].sort((a, b) => a - b),
      dayPromos: draft.promos
        .filter((x) => draft.days.includes(x.day) && x.value > 0)
        .map((x) => ({ day: x.day, type: x.type, value: x.type === "pct" ? clamp(x.value, 0, 100) : Math.round(x.value) })),
      bundleItems: draft.kind === "bundle" ? draft.bundleItems : [],
      discount: { type: draft.discType, value: Math.max(0, Number(draft.discValue) || 0) },
    };
    dispatch({ type: product ? "UPDATE_PRODUCT" : "ADD_PRODUCT", product: p });
    sfx.success();
    push({ msg: product ? `${p.name} diperbarui` : `${p.name} ditambahkan • SKU ${p.sku}`, type: "ok" });
    onClose();
  };

  const copySku = async () => {
    try {
      await navigator.clipboard.writeText(previewSku);
      setCopied(true);
      sfx.tap();
      setTimeout(() => setCopied(false), 1600);
    } catch {
      push({ msg: `SKU: ${previewSku}`, type: "info" });
    }
  };

  const tabs: { v: Tab; l: string; icon: React.ReactNode; badge?: number }[] = [
    { v: "detail", l: "Detail", icon: <IBox size={14} /> },
    { v: "foto", l: "Foto", icon: <IImage size={14} /> },
    { v: "harga", l: "Harga & Diskon", icon: <IPercent size={14} /> },
    ...(draft.kind === "bundle" ? [{ v: "paket" as Tab, l: "Isi Paket", icon: <ITag size={14} />, badge: draft.bundleItems.length }] : []),
    { v: "jadwal", l: "Jadwal & Promo", icon: <ICalendar size={14} />, badge: draft.promos.filter((x) => x.value > 0).length },
    ...(saved ? [{ v: "analitik" as Tab, l: "Analitik", icon: <IChart size={14} /> }] : []),
  ];

  return (
    <Modal open={open} onClose={onClose} wide
      title={
        <span className="flex items-center gap-2.5 min-w-0">
          <ProductThumb name={live.name} photo={draft.photo} category={draft.category} size={30} rounded={9} />
          <span className="truncate">{product ? "Edit Produk" : draft.kind === "bundle" ? "Paket Baru" : "Produk Baru"}</span>
        </span>
      }
      footer={
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-faint hidden sm:block">
            Harga hari ini <b className="text-accent">{rupiah(eff)}</b>
            {isLimited(live) && " · limited"}
            {draft.promos.filter((x) => x.value > 0).length > 0 && ` · ${draft.promos.filter((x) => x.value > 0).length} promo terjadwal`}
          </span>
          <div className="flex gap-2 ml-auto">
            <Button variant="ghost" onClick={onClose}>Batal</Button>
            <Button onClick={save}>{product ? "Simpan Perubahan" : "Simpan Produk"}</Button>
          </div>
        </div>
      }>
      <div className="-mx-5 -mt-4">
        <div className="sticky top-0 z-10 bg-bg2 border-b border-line px-5 pt-3 pb-2 flex gap-1.5 overflow-x-auto">
          {tabs.map((t) => (
            <button key={t.v} onClick={() => { setTab(t.v); sfx.tap(); }}
              className="chip shrink-0"
              style={tab === t.v ? { background: "var(--accent)", color: "var(--accent-ink)", borderColor: "transparent" } : undefined}>
              {t.icon} {t.l}
              {!!t.badge && <span className="ml-0.5 rounded-full px-1.5 text-[9px]" style={{ background: tab === t.v ? "rgba(0,0,0,.2)" : "var(--accent-soft)" }}>{t.badge}</span>}
            </button>
          ))}
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* DETAIL */}
          {tab === "detail" && (
            <>
              <Field label="Nama Produk *" error={errors.name}>
                <Input value={draft.name} autoFocus placeholder="cth. Kopi Susu Pandan"
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </Field>

              <Field label="Jenis Produk">
                <Segmented className="w-full" value={draft.kind}
                  onChange={(v) => setDraft({ ...draft, kind: v as ProductKind })}
                  options={[{ v: "single", l: <><IBox size={14} /> Satuan</> }, { v: "bundle", l: <><ITag size={14} /> Paket bundling</> }]} />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Kategori">
                  <Select value={draft.category} onChange={(v) => setDraft({ ...draft, category: v as Category })}
                    options={CATEGORIES.map((c) => ({ v: c, l: c }))} />
                </Field>
                <Field label="SKU otomatis" hint="Dibuat sistem, tidak perlu diisi">
                  <div className="input flex items-center justify-between gap-2 py-2">
                    <span className="font-mono font-bold text-accent">{previewSku}</span>
                    <button onClick={copySku} className="text-[10px] font-bold text-faint hover:text-accent inline-flex items-center gap-1">
                      {copied ? <><ICheck size={12} /> Tersalin</> : "Salin"}
                    </button>
                  </div>
                </Field>
              </div>

              {draft.kind === "single" ? (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Stok" error={errors.stock}>
                    <Input type="number" min={0} inputMode="numeric" value={draft.stock} placeholder="50"
                      onChange={(e) => setDraft({ ...draft, stock: e.target.value })} />
                  </Field>
                  <Field label="Harga Modal / unit">
                    <Input type="number" min={0} inputMode="numeric" value={draft.cost} placeholder="11000"
                      onChange={(e) => setDraft({ ...draft, cost: e.target.value })} />
                  </Field>
                </div>
              ) : (
                <div className="rounded-2xl border border-line bg-surface p-4 text-[11px] text-mute space-y-1">
                  <p className="text-xs font-bold text-ink flex items-center gap-1.5"><ITag size={14} className="text-violet" /> Paket bundling</p>
                  <p>Stok & modal paket dihitung otomatis dari isi paket. Atur komponennya di tab <b>Isi Paket</b>.</p>
                  <p>Stok paket saat ini: <b className="text-accent">{num(bStock)}</b> · modal gabungan <b className="text-ink">{rupiah(cost)}</b></p>
                </div>
              )}

              <Field label="Deskripsi">
                <Textarea rows={3} value={draft.desc} placeholder="Catatan rasa, bahan, ukuran, atau promo…"
                  onChange={(e) => setDraft({ ...draft, desc: e.target.value })} />
              </Field>

              <div className="flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-3">
                <div>
                  <p className="text-sm font-bold">Tampil di Kasir</p>
                  <p className="text-[11px] text-faint">Produk nonaktif disembunyikan dari grid kasir</p>
                </div>
                <Toggle checked={draft.active} label="Aktif" onChange={(v) => setDraft({ ...draft, active: v })} />
              </div>
            </>
          )}

          {/* FOTO */}
          {tab === "foto" && (
            <>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); void handlePhoto(e.dataTransfer.files?.[0]); }}
                className={`rounded-2xl border-2 border-dashed p-5 text-center transition-all ${dragOver ? "border-accent bg-accent-soft" : "border-line2 bg-surface"}`}>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => void handlePhoto(e.target.files?.[0])} />
                <div className="flex justify-center mb-2">
                  <span className="w-11 h-11 rounded-xl grid place-items-center bg-accent-soft text-accent">
                    {busy ? <IRefresh size={20} className="spin" /> : <IUpload size={20} />}
                  </span>
                </div>
                <p className="text-sm font-bold">{busy ? "Memproses foto…" : "Unggah foto produk dari galeri / laptop"}</p>
                <p className="text-[11px] text-faint mt-1">
                  Tarik & lepas atau pilih file · PNG / JPG / WebP · maks {formatBytes(PHOTO_LIMITS.maxInputBytes)}
                </p>
                <div className="flex flex-wrap justify-center items-center gap-2 mt-3">
                  <Button size="sm" disabled={busy} onClick={() => fileRef.current?.click()}><IUpload size={14} /> Pilih Foto</Button>
                  {draft.photo && (
                    <Button size="sm" variant="danger" onClick={() => { setDraft({ ...draft, photo: null }); setPhotoInfo(null); sfx.remove(); push({ msg: "Foto produk dihapus", type: "info" }); }}>
                      <ITrash size={14} /> Hapus Foto
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Pemotongan">
                  <Select value={aspect} onChange={(v) => setAspect(v as PhotoAspect)}
                    options={[{ v: "square", l: "Persegi (disarankan)" }, { v: "original", l: "Rasio asli" }]} />
                </Field>
                <div className="flex items-end">
                  <p className="text-[11px] text-faint">
                    Otomatis dipertajam ke maks {PHOTO_LIMITS.maxSide}px dan dikompres ≤ {formatBytes(PHOTO_LIMITS.targetBytes)}. Di kasir, ukuran kartu bisa diatur (S/M/L) dan foto bisa mode potong atau pas.
                  </p>
                </div>
              </div>

              {photoInfo && (
                <div className="rounded-xl border border-line bg-surface p-3 text-[11px] space-y-1">
                  <p className="font-bold text-xs flex items-center gap-1.5"><ICheckCircle size={13} className="text-pandan" /> Hasil pemrosesan</p>
                  <p className="text-mute">Asli: {photoInfo.source.width}×{photoInfo.source.height} · {formatBytes(photoInfo.source.bytes)} · {photoInfo.source.type}</p>
                  <p className="text-mute">Dipakai: <b className="text-ink">{photoInfo.width}×{photoInfo.height}</b> · <b className="text-ink">{formatBytes(photoInfo.bytes)}</b> · {photoInfo.format}</p>
                  {photoInfo.lowRes && <p className="text-amber">Resolusi asli kecil — disarankan unggah versi lebih besar.</p>}
                </div>
              )}

              <div className="rounded-2xl border border-line bg-surface p-4">
                <p className="text-xs font-bold mb-3">Pratinjau di aplikasi</p>
                <div className="flex flex-wrap items-end gap-5">
                  <div className="text-center">
                    <div className="w-28 h-[84px]"><ProductThumb name={live.name} photo={draft.photo} category={draft.category} fill rounded={14} /></div>
                    <p className="text-[10px] text-faint mt-1.5">Kartu kasir</p>
                  </div>
                  <div className="text-center">
                    <div className="w-20 h-20"><ProductThumb name={live.name} photo={draft.photo} category={draft.category} fill rounded={12} fit="contain" /></div>
                    <p className="text-[10px] text-faint mt-1.5">Mode pas</p>
                  </div>
                  <div className="text-center">
                    <ProductThumb name={live.name} photo={draft.photo} category={draft.category} size={40} rounded={11} />
                    <p className="text-[10px] text-faint mt-1.5">Keranjang</p>
                  </div>
                  <div className="text-center">
                    <ProductThumb name={live.name} photo={draft.photo} category={draft.category} size={36} rounded={10} />
                    <p className="text-[10px] text-faint mt-1.5">Tabel</p>
                  </div>
                </div>
                {!draft.photo && <p className="text-[11px] text-faint mt-3">Belum ada foto — sistem menampilkan inisial produk sebagai pengganti.</p>}
              </div>
            </>
          )}

          {/* HARGA */}
          {tab === "harga" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label={draft.kind === "bundle" ? "Harga Paket *" : "Harga Jual *"} error={errors.price}>
                  <Input type="number" min={0} inputMode="numeric" value={draft.price} placeholder="22000"
                    onChange={(e) => setDraft({ ...draft, price: e.target.value })} />
                </Field>
                <Field label={draft.kind === "bundle" ? "Modal (otomatis)" : "Harga Modal"}>
                  <div className="input flex items-center py-2 font-mono text-mute">
                    {draft.kind === "bundle" ? rupiah(cost) : (
                      <input type="number" min={0} inputMode="numeric" value={draft.cost} placeholder="11000"
                        className="w-full bg-transparent outline-none"
                        onChange={(e) => setDraft({ ...draft, cost: e.target.value })} />
                    )}
                  </div>
                </Field>
              </div>

              <div className="rounded-2xl border border-line bg-surface p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold flex items-center gap-1.5"><IPercent size={14} className="text-amber" /> Diskon dasar (setiap hari)</p>
                  {promoToday && <Badge color="var(--magenta)">Hari ini ditimpa promo {DAY_SHORT[today]}</Badge>}
                </div>
                <div className="flex gap-2">
                  <Segmented value={draft.discType} onChange={(v) => setDraft({ ...draft, discType: v as Discount["type"], discValue: "" })}
                    options={[{ v: "pct", l: "Persen %" }, { v: "rp", l: "Nominal Rp" }]} />
                  <Input type="number" min={0} inputMode="numeric" className="flex-1"
                    placeholder={draft.discType === "pct" ? "10" : "2000"} value={draft.discValue}
                    onChange={(e) => setDraft({ ...draft, discValue: e.target.value })} />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(draft.discType === "pct" ? [0, 5, 10, 15, 20, 25, 50] : [0, 1000, 2000, 5000, 10000]).map((v) => (
                    <button key={v} onClick={() => { setDraft({ ...draft, discValue: v ? String(v) : "" }); sfx.tap(); }}
                      className={`chip ${(Number(draft.discValue) || 0) === v ? "chip-on" : ""}`}>
                      {v === 0 ? "Tanpa diskon" : draft.discType === "pct" ? `${v}%` : rupiah(v)}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-faint flex gap-1.5">
                  <IInfo size={13} className="shrink-0 mt-0.5" />
                  Hari yang punya promo terjadwal memakai promo itu, bukan diskon dasar. Atur di tab <b>Jadwal & Promo</b>.
                </p>
              </div>

              {draft.kind === "bundle" && baseTotal > 0 && (
                <div className="rounded-2xl border border-line bg-surface p-4">
                  <p className="text-xs font-bold mb-2">Harga paket cepat</p>
                  <div className="flex flex-wrap gap-1.5">
                    {[5, 10, 15, 20].map((pc) => (
                      <button key={pc} className="chip"
                        onClick={() => { setDraft({ ...draft, price: String(Math.round(baseTotal * (1 - pc / 100))) }); sfx.tap(); }}>
                        Hemat {pc}% · {rupiah(Math.round(baseTotal * (1 - pc / 100)))}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-faint mt-2">Harga normal isi paket: <b className="text-ink">{rupiah(baseTotal)}</b></p>
                </div>
              )}

              <div className="rounded-2xl border p-4" style={{ borderColor: "color-mix(in srgb, var(--accent) 32%, transparent)", background: "var(--accent-soft)" }}>
                <p className="text-[11px] font-bold uppercase tracking-wider text-faint">
                  Harga kasir hari ini · {DAY_FULL[today]} · sumber: {promoToday ? `promo ${DAY_SHORT[today]}` : "diskon dasar"}
                </p>
                <div className="flex items-end gap-3 mt-1.5 flex-wrap">
                  <span className="font-display font-bold text-3xl text-accent tabular-nums">{rupiah(eff)}</span>
                  {cut > 0 && <span className="text-sm text-faint line-through">{rupiah(live.price)}</span>}
                  {cut > 0 && <Badge color="var(--amber)">Hemat {rupiah(cut)} · {discountLabel(activeToday)}</Badge>}
                </div>
                <div className="grid grid-cols-3 gap-2 mt-3 text-[11px]">
                  <div><p className="text-faint">Modal</p><p className="font-mono font-bold">{rupiah(cost)}</p></div>
                  <div><p className="text-faint">Laba / unit</p><p className="font-mono font-bold" style={{ color: margin.value >= 0 ? "var(--pandan)" : "var(--chili)" }}>{rupiah(margin.value)}</p></div>
                  <div><p className="text-faint">Margin</p><p className="font-mono font-bold" style={{ color: margin.pct >= 0 ? "var(--pandan)" : "var(--chili)" }}>{margin.pct.toFixed(1)}%</p></div>
                </div>
                <p className="text-[11px] text-mute mt-2">
                  Dengan PPN {state.settings.taxPct}% pelanggan membayar ≈ <b className="text-ink">{rupiah(Math.round(eff * (1 + state.settings.taxPct / 100)))}</b>
                </p>
                {margin.value < 0 && <p className="text-[11px] text-chili mt-1.5">Harga akhir di bawah modal — periksa lagi diskonnya.</p>}
              </div>
            </>
          )}

          {/* PAKET */}
          {tab === "paket" && (
            <>
              {errors.bundle && <p className="text-[11px] text-chili">{errors.bundle}</p>}

              <SearchField
                value={bundleQuery}
                onChange={setBundleQuery}
                size="md"
                count={candidates.length}
                countLabel="kandidat"
                ariaLabel="Cari produk untuk isi paket"
                placeholder="Cari produk untuk ditambahkan ke paket…"
                onEnter={() => { if (candidates[0]) addComponent(candidates[0].id); }}
                onEscape={() => setBundleQuery("")}
              />

              {candidates.length > 0 ? (
                <div className="rounded-2xl border border-line bg-surface p-2 max-h-52 overflow-y-auto">
                  {candidates.map((p) => (
                    <button key={p.id} onClick={() => addComponent(p.id)}
                      className="w-full flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-surface2 text-left">
                      <ProductThumb name={p.name} photo={p.photo} category={p.category} size={32} rounded={9} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-bold truncate"><Highlight text={p.name} query={bundleQuery} /></span>
                        <span className="block text-[10px] text-faint font-mono"><Highlight text={p.sku} query={bundleQuery} /> · stok {p.stock}</span>
                      </span>
                      <span className="text-xs font-mono text-accent">{rupiah(effectivePrice(p))}</span>
                      <IPlus size={15} className="text-faint" />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-faint text-center py-3">Tidak ada produk cocok untuk ditambahkan.</p>
              )}

              <div className="rounded-2xl border border-line bg-surface p-3">
                <p className="text-xs font-bold mb-2">Isi paket ({draft.bundleItems.length} produk)</p>
                {draft.bundleItems.length === 0 ? (
                  <p className="text-[11px] text-faint py-4 text-center">Belum ada isi paket. Cari produk di atas lalu klik untuk menambahkan.</p>
                ) : (
                  <ul className="space-y-2">
                    {draft.bundleItems.map((c) => {
                      const p = state.products.find((x) => x.id === c.productId);
                      if (!p) return null;
                      return (
                        <li key={c.productId} className="flex items-center gap-2.5">
                          <ProductThumb name={p.name} photo={p.photo} category={p.category} size={34} rounded={9} />
                          <span className="min-w-0 flex-1">
                            <span className="block text-xs font-bold truncate">{p.name}</span>
                            <span className="block text-[10px] text-faint font-mono">{rupiah(effectivePrice(p))} × {c.qty} = {rupiah(effectivePrice(p) * c.qty)}</span>
                          </span>
                          <div className="flex items-center gap-1">
                            <IconBtn label="Kurangi" className="!p-1" onClick={() => setQty(c.productId, -1)}><IMinus size={12} /></IconBtn>
                            <span className="w-6 text-center font-mono font-bold text-sm">{c.qty}</span>
                            <IconBtn label="Tambah" className="!p-1" onClick={() => setQty(c.productId, 1)}><IPlus size={12} /></IconBtn>
                          </div>
                          <IconBtn label="Keluarkan" className="!p-1.5 hover:!text-chili" onClick={() => setQty(c.productId, -99)}><IX size={13} /></IconBtn>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { l: "Harga normal", v: rupiah(baseTotal), c: "var(--muted)" },
                  { l: "Harga paket", v: rupiah(eff), c: "var(--accent)" },
                  { l: "Pelanggan hemat", v: rupiah(Math.max(0, baseTotal - eff)), c: "var(--amber)" },
                  { l: "Stok paket", v: `${num(bStock)} porsi`, c: bStock > 0 ? "var(--pandan)" : "var(--chili)" },
                ].map((x) => (
                  <div key={x.l} className="rounded-xl border border-line bg-surface p-3">
                    <p className="text-[10px] text-faint font-bold uppercase tracking-wider">{x.l}</p>
                    <p className="font-display font-bold text-sm mt-1" style={{ color: x.c }}>{x.v}</p>
                  </div>
                ))}
              </div>

              {baseTotal > 0 && eff > baseTotal && (
                <p className="text-[11px] text-amber flex gap-1.5"><IInfo size={13} className="shrink-0 mt-0.5" /> Harga paket lebih mahal dari beli satuan — pelanggan tidak dapat keuntungan.</p>
              )}
            </>
          )}

          {/* JADWAL & PROMO */}
          {tab === "jadwal" && (
            <>
              <div className="rounded-2xl border border-line bg-surface p-4">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <p className="text-xs font-bold flex items-center gap-1.5"><ICalendar size={14} className="text-accent" /> Hari ketersediaan</p>
                  {isLimited(live)
                    ? <Badge color="var(--magenta)"><ISparkle size={11} /> Limited edition</Badge>
                    : <Badge color="var(--pandan)">Setiap hari</Badge>}
                </div>
                <div className="grid grid-cols-7 gap-1.5">
                  {DAY_ORDER.map((d) => {
                    const on = draft.days.includes(d);
                    return (
                      <button key={d} onClick={() => toggleDay(d)} title={DAY_FULL[d]}
                        className={`rounded-xl border py-3 text-center transition-all active:scale-95 ${on ? "border-transparent" : "border-line bg-bg2"}`}
                        style={on ? { background: "linear-gradient(135deg, var(--accent), var(--accent2))", color: "var(--accent-ink)" } : { color: "var(--faint)" }}>
                        <span className="block text-[11px] font-bold">{DAY_SHORT[d]}</span>
                        <span className="block mt-1">{on ? <ICheck size={13} className="mx-auto" /> : <IX size={13} className="mx-auto opacity-50" />}</span>
                      </button>
                    );
                  })}
                </div>
                {errors.days && <p className="text-[11px] text-chili mt-2">{errors.days}</p>}
                <div className="flex flex-wrap gap-1.5 mt-3">
                  <button className="chip" onClick={() => setDays(ALL_DAYS)}>Setiap hari</button>
                  <button className="chip" onClick={() => setDays(WORK_DAYS)}>Hari kerja</button>
                  <button className="chip" onClick={() => setDays(WEEKEND_DAYS)}>Akhir pekan</button>
                  <button className="chip" onClick={() => setDays([today])}>Hanya hari ini</button>
                </div>
              </div>

              <div className="rounded-2xl border p-4" style={{ borderColor: "color-mix(in srgb, var(--amber) 32%, transparent)", background: "color-mix(in srgb, var(--amber) 6%, transparent)" }}>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                  <p className="text-xs font-bold flex items-center gap-1.5"><IPercent size={14} className="text-amber" /> Promo diskon per hari</p>
                  <Badge color="var(--amber)">{draft.promos.filter((x) => x.value > 0).length} hari promo</Badge>
                </div>
                <p className="text-[11px] text-mute mb-3">
                  Promo hari tertentu <b className="text-ink">menimpa diskon dasar</b> pada hari itu. Harga langsung dipakai kasir & struk.
                </p>

                <div className="flex flex-wrap gap-1.5 mb-3">
                  <button className="chip" onClick={() => applyPromoAll("pct", 10)}>10% semua hari aktif</button>
                  <button className="chip" onClick={() => applyPromoAll("pct", 20)}>20% semua hari aktif</button>
                  <button className="chip" onClick={() => applyPromoAll("rp", 5000)}>Rp 5.000 semua hari</button>
                  <button className="chip hover:!text-chili" onClick={clearPromos}><ITrash size={11} /> Hapus semua promo</button>
                </div>

                <ul className="space-y-2">
                  {DAY_ORDER.map((d) => {
                    const available = draft.days.includes(d);
                    const promo = promoOf(d);
                    const dayPrice = Math.max(0, live.price - discountAmount(live.price, promo ?? live.discount));
                    const dayCut = live.price - dayPrice;
                    return (
                      <li key={d} className={`rounded-xl border p-2.5 transition-all ${available ? "border-line bg-surface" : "border-line bg-bg2 opacity-55"}`}>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="w-11 shrink-0">
                            <span className="block text-xs font-bold">{DAY_SHORT[d]}</span>
                            <span className="block text-[9px] text-faint">{d === today ? "hari ini" : available ? "jual" : "libur"}</span>
                          </span>
                          {available ? (
                            <>
                              <Toggle small checked={!!promo} label={`Promo ${DAY_FULL[d]}`} onChange={() => togglePromo(d)} />
                              {promo ? (
                                <>
                                  <div className="inline-flex bg-bg2 border border-line rounded-lg p-0.5 gap-0.5">
                                    {(["pct", "rp"] as const).map((t) => (
                                      <button key={t} onClick={() => { patchPromo(d, { type: t, value: t === "pct" ? 10 : 2000 }); sfx.tap(); }}
                                        className="px-2 py-0.5 text-[10px] font-bold rounded-md"
                                        style={promo.type === t ? { background: "var(--amber)", color: "var(--amber-ink)" } : { color: "var(--muted)" }}>
                                        {t === "pct" ? "%" : "Rp"}
                                      </button>
                                    ))}
                                  </div>
                                  <Input type="number" min={0} inputMode="numeric" value={promo.value || ""}
                                    onChange={(e) => patchPromo(d, { value: Math.max(0, Number(e.target.value) || 0) })}
                                    className="!w-24 !py-1.5 !text-xs" placeholder={promo.type === "pct" ? "10" : "2000"} />
                                  <span className="ml-auto text-right">
                                    <span className="block font-mono font-bold text-xs text-accent">{rupiah(dayPrice)}</span>
                                    {dayCut > 0 && <span className="block text-[9px] text-amber">hemat {rupiah(dayCut)}</span>}
                                  </span>
                                </>
                              ) : (
                                <span className="text-[11px] text-faint flex-1">
                                  Pakai diskon dasar{discountAmount(live.price, live.discount) > 0 ? ` (${discountLabel(live.discount)})` : " (tanpa diskon)"}
                                  <span className="ml-2 font-mono font-bold text-mute">{rupiah(dayPrice)}</span>
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-[11px] text-faint flex-1">Tidak dijual hari ini — aktifkan dulu untuk memberi promo.</span>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="rounded-2xl border p-4" style={{ borderColor: "color-mix(in srgb, var(--magenta) 30%, transparent)", background: "color-mix(in srgb, var(--magenta) 7%, transparent)" }}>
                <p className="text-xs font-bold mb-1.5">Efek di kasir</p>
                <p className="text-[11px] text-mute">
                  Tersedia <b className="text-ink">{draft.days.length} hari/minggu</b>: {DAY_ORDER.filter((d) => draft.days.includes(d)).map((d) => DAY_FULL[d]).join(", ") || "belum ada hari dipilih"}.
                </p>
                <p className="text-[11px] text-mute mt-1.5">
                  {isAvailableToday(live)
                    ? `Hari ini bisa dijual dengan harga ${rupiah(eff)}${promoToday ? ` (promo ${DAY_SHORT[today]} ${discountLabel(promoToday)})` : ""}.`
                    : `Hari ini otomatis dikunci di kasir${nextAvailableDay(live) !== null ? `, kembali hari ${DAY_FULL[nextAvailableDay(live) as number]}` : ""}.`}
                </p>
                {isLimited(live) && (
                  <p className="text-[11px] text-mute mt-1.5 flex gap-1.5">
                    <ISparkle size={13} className="text-magenta shrink-0 mt-0.5" />
                    Label “Limited” otomatis muncul di kartu produk supaya terasa eksklusif.
                  </p>
                )}
              </div>
            </>
          )}

          {/* ANALITIK */}
          {tab === "analitik" && saved && (
            <ProductAnalytics product={saved} products={state.products} transactions={state.transactions}
              onRestock={(n) => {
                if (saved.kind === "bundle") { push({ msg: "Stok paket mengikuti stok isi paket", type: "info" }); return; }
                setDraft((d) => ({ ...d, stock: String((Number(d.stock) || 0) + n) }));
                sfx.add();
                push({ msg: `Rencana restok +${n} unit — klik Simpan untuk menerapkan`, type: "ok" });
              }} />
          )}

          {tab === "analitik" && !saved && (
            <EmptyState emoji="📊" title="Analitik muncul setelah disimpan" desc="Simpan produk dulu, lalu buka tab ini untuk memantau performa." />
          )}
        </div>
      </div>
    </Modal>
  );
}