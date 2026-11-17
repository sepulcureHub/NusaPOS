import type { BundleComponent, Category, DayPromo, Discount, Product, ProductKind, TxItem } from "./types";
import { CATEGORY_EMOJI } from "./types";
import { clamp, rupiah } from "./format";

export const DAY_SHORT = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
export const DAY_FULL = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
export const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
export const WORK_DAYS = [1, 2, 3, 4, 5];
export const WEEKEND_DAYS = [0, 6];

const SKU_PREFIX: Record<Category, string> = {
  Kopi: "KOP", "Non-Kopi": "NKP", Makanan: "MKN", Cemilan: "CML", Ritel: "RTL",
};

export function makeSku(category: Category, kind: ProductKind, taken: string[]) {
  const prefix = kind === "bundle" ? "PKT" : SKU_PREFIX[category];
  const used = new Set(taken.map((s) => s.toUpperCase()));
  let n = taken.filter((s) => s.toUpperCase().startsWith(prefix + "-")).length + 1;
  let sku = `${prefix}-${String(n).padStart(3, "0")}`;
  while (used.has(sku)) { n++; sku = `${prefix}-${String(n).padStart(3, "0")}`; }
  return sku;
}

export function discountAmount(price: number, d?: Discount | null) {
  if (!d || !(d.value > 0)) return 0;
  const raw = d.type === "pct" ? Math.round((price * clamp(d.value, 0, 100)) / 100) : d.value;
  return clamp(Math.round(raw), 0, price);
}

/* ---------- Promo terjadwal per hari ---------- */
export function promoForDay(p: Product, day: number): DayPromo | null {
  if (!Array.isArray(p.dayPromos)) return null;
  const hit = p.dayPromos.find((x) => x.day === day && x.value > 0);
  return hit ?? null;
}

export function todayPromo(p: Product) {
  return promoForDay(p, new Date().getDay());
}

/** Promo hari tertentu menimpa diskon dasar pada hari itu. */
export function activeDiscount(p: Product, day = new Date().getDay()): Discount {
  const promo = promoForDay(p, day);
  if (promo) return { type: promo.type, value: promo.value };
  return p.discount ?? { type: "pct", value: 0 };
}

export function effectivePrice(p: Product, day = new Date().getDay()) {
  return Math.max(0, p.price - discountAmount(p.price, activeDiscount(p, day)));
}

export function hasDiscount(p: Product, day = new Date().getDay()) {
  return discountAmount(p.price, activeDiscount(p, day)) > 0;
}

export function hasAnyPromo(p: Product) {
  return discountAmount(p.price, p.discount) > 0 || promoDays(p).length > 0;
}

export function promoDays(p: Product) {
  if (!Array.isArray(p.dayPromos)) return [];
  return [...new Set(p.dayPromos.filter((x) => x.value > 0).map((x) => x.day))];
}

export function nextPromoDay(p: Product, from = new Date().getDay()) {
  for (let i = 1; i <= 7; i++) {
    const d = (from + i) % 7;
    if (promoForDay(p, d) && isAvailableOn(p, d)) return d;
  }
  return null;
}

export function discountLabel(d: Discount) {
  return d.type === "pct" ? `${d.value}%` : rupiah(d.value);
}

export function promoLabel(p: Product, day = new Date().getDay()) {
  const promo = promoForDay(p, day);
  if (!promo) return null;
  return `${DAY_SHORT[day]} ${discountLabel(promo)}`;
}

/* ---------- Ketersediaan hari ---------- */
export function isAvailableOn(p: Product, dayIndex: number) {
  return Array.isArray(p.availableDays) && p.availableDays.includes(dayIndex);
}

export function isAvailableToday(p: Product) {
  return isAvailableOn(p, new Date().getDay());
}

export function isLimited(p: Product) {
  return Array.isArray(p.availableDays) && p.availableDays.length > 0 && p.availableDays.length < 7;
}

export function nextAvailableDay(p: Product, from = new Date().getDay()) {
  for (let i = 1; i <= 7; i++) {
    const d = (from + i) % 7;
    if (isAvailableOn(p, d)) return d;
  }
  return null;
}

export function daysLabel(p: Product) {
  if (!isLimited(p)) return "Setiap hari";
  return DAY_ORDER.filter((d) => p.availableDays.includes(d)).map((d) => DAY_SHORT[d]).join(" · ");
}

/* ---------- Paket bundling ---------- */
export function bundleComponents(p: Product, all: Product[]) {
  if (p.kind !== "bundle") return [];
  return p.bundleItems
    .map((c) => ({ comp: c, product: all.find((x) => x.id === c.productId) }))
    .filter((x): x is { comp: BundleComponent; product: Product } => !!x.product);
}

export function bundleStock(p: Product, all: Product[]) {
  const list = bundleComponents(p, all);
  if (!list.length) return 0;
  return Math.max(0, Math.min(...list.map(({ comp, product }) => Math.floor(product.stock / Math.max(1, comp.qty)))));
}

export function stockOf(p: Product, all: Product[]) {
  return p.kind === "bundle" ? bundleStock(p, all) : p.stock;
}

export function bundleBaseTotal(p: Product, all: Product[]) {
  return bundleComponents(p, all).reduce((a, { comp, product }) => a + effectivePrice(product) * comp.qty, 0);
}

export function bundleSavings(p: Product, all: Product[]) {
  return Math.max(0, bundleBaseTotal(p, all) - effectivePrice(p));
}

export function productCost(p: Product, all: Product[]) {
  if (p.kind !== "bundle") return p.cost;
  return bundleComponents(p, all).reduce((a, { comp, product }) => a + product.cost * comp.qty, 0);
}

export function productMargin(p: Product, all: Product[]) {
  const price = effectivePrice(p);
  const cost = productCost(p, all);
  const value = price - cost;
  return { value, pct: price > 0 ? (value / price) * 100 : 0 };
}

export function fallbackEmoji(p: Pick<Product, "category" | "kind">) {
  return p.kind === "bundle" ? "🎁" : CATEGORY_EMOJI[p.category];
}

export function toTxItem(p: Product, all: Product[], qty = 1, day = new Date().getDay()): TxItem {
  return {
    productId: p.id,
    name: p.name,
    emoji: p.emoji || fallbackEmoji(p),
    category: p.category,
    price: effectivePrice(p, day),
    basePrice: p.price,
    qty,
    photo: p.photo ?? null,
    kind: p.kind,
    components: p.kind === "bundle"
      ? bundleComponents(p, all).map(({ comp, product }) => ({ productId: product.id, name: product.name, qty: comp.qty }))
      : undefined,
  };
}

export function itemSavings(i: TxItem) {
  return Math.max(0, ((i.basePrice ?? i.price) - i.price) * i.qty);
}

export function cartSavings(items: TxItem[]) {
  return items.reduce((a, i) => a + itemSavings(i), 0);
}

export function stockNeed(i: TxItem) {
  const m = new Map<string, number>();
  if (i.components?.length) {
    for (const c of i.components) m.set(c.productId, (m.get(c.productId) ?? 0) + c.qty * i.qty);
  } else {
    m.set(i.productId, i.qty);
  }
  return m;
}

export function monogram(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "NP";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}