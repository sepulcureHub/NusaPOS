// lib/data/map.ts
import type { Product, Customer, DiningTable, Category, Discount } from "@/lib/types";

type Row = Record<string, unknown>;

/* ── Helpers ── */

const s = (r: Row, k: string): string => String(r[k] ?? "");
const n = (r: Row, k: string): number => Number(r[k] ?? 0);
const b = (r: Row, k: string): boolean => Boolean(r[k]);

/* Nullable string: DB null → null (field bertipe `string | null` di types) */
const ns = (r: Row, k: string): string | null =>
  r[k] == null ? null : String(r[k]);

/* Optional string: DB null → undefined (field bertipe `?: string` di types) */
const os = (r: Row, k: string): string | undefined =>
  r[k] == null ? undefined : String(r[k]);

/* Nullable number (timestamp ms): ISO string → Date.parse, null → null */
const nms = (r: Row, k: string): number | null => {
  if (r[k] == null) return null;
  const v = r[k];
  if (typeof v === "number") return v;
  const parsed = Date.parse(String(v));
  return Number.isNaN(parsed) ? null : parsed;
};

/* Optional number (timestamp ms): ISO string → Date.parse, null → undefined */
const on = (r: Row, k: string): number | undefined => {
  if (r[k] == null) return undefined;
  const v = r[k];
  if (typeof v === "number") return v;
  const parsed = Date.parse(String(v));
  return Number.isNaN(parsed) ? undefined : parsed;
};

/* ── Mappers ── */

export function mapProduct(r: Row): Product {
  const discRaw = r.discount as Discount | null | undefined;
  return {
    id: s(r, "id"),
    sku: s(r, "sku"),
    name: s(r, "name"),
    category: s(r, "category") as Category,
    price: n(r, "price"),
    cost: n(r, "cost"),
    stock: n(r, "stock"),
    emoji: s(r, "emoji"),
    active: b(r, "active"),
    desc: s(r, "description"),
    photo: ns(r, "photo_url"),
    discount: discRaw ?? { type: "pct", value: 0 },
    dayPromos: (r.day_promos as Product["dayPromos"]) ?? [],
    availableDays: (r.available_days as number[]) ?? [0, 1, 2, 3, 4, 5, 6],
    kind: s(r, "kind") as Product["kind"],
    bundleItems: (r.bundle_items as Product["bundleItems"]) ?? [],
    popularity: n(r, "popularity"),
    // sort_order TIDAK di-map ke Product type — ordering ditangani di query (.order("sort_order"))
  };
}

export function mapCustomer(r: Row): Customer {
  return {
    id: s(r, "id"),
    name: s(r, "name"),
    phone: s(r, "phone"),
    member: b(r, "member"),
    memberNo: os(r, "member_no"),
    username: os(r, "username"),
    email: os(r, "email"),
    points: n(r, "points"),
    visits: n(r, "visits"),
    spend: n(r, "spend"),
    notes: s(r, "notes"),
    memberActive: b(r, "member_active"),
    portal: b(r, "portal"),
    birthDate: os(r, "birth_date"),
    joinedAt: on(r, "joined_at"),
    pinHash: os(r, "pin_hash"),
  };
}

export function mapTable(r: Row): DiningTable {
  return {
    id: s(r, "id"),
    label: s(r, "label"),
    seats: n(r, "seats"),
    area: s(r, "area"),
    status: s(r, "status") as DiningTable["status"],
    active: b(r, "active"),
    txId: ns(r, "tx_id"),
    customerName: ns(r, "customer_name"),
    occupiedAt: nms(r, "occupied_at"),
    note: s(r, "note"),
  };
}