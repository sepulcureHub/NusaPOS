import type { Discount, Role } from "./types";
import { clamp, rupiah } from "./format";

export const DEFAULT_MAX_KASIR_DISCOUNT_PCT = 20;

/** Batas diskon order untuk kasir, diatur admin via settings toko. */
export function maxKasirDiscountPct(s: { maxDiscountKasirPct?: number }): number {
  return clamp(Number(s.maxDiscountKasirPct ?? DEFAULT_MAX_KASIR_DISCOUNT_PCT), 0, 100);
}

/** null = lolos; string = alasan tolak. Dicerminkan di RPC record_sale (defense in depth). */
export function checkOrderDiscount(
  role: Role, d: Discount, subtotal: number, maxPct: number
): string | null {
  if (!(d.value >= 0)) return "Diskon tidak valid";
  if (role === "admin") return null;
  if (d.type === "pct") {
    return d.value > maxPct ? `Diskon kasir maksimal ${maxPct}%` : null;
  }
  const cap = Math.round((subtotal * maxPct) / 100);
  return d.value > cap ? `Diskon kasir maksimal ${rupiah(cap)} (${maxPct}% dari subtotal)` : null;
}

/** Indeks hari toko (0=Minggu). Server UTC tidak boleh menentukan promo harian. */
export function storeDow(timeZone: string, now: Date = new Date()): number {
  try {
    const w = now.toLocaleString("en-US", { timeZone, weekday: "short" }).slice(0, 3);
    const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return map[w] ?? now.getDay();
  } catch {
    return now.getDay();
  }
}