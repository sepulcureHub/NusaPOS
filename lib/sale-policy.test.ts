import { describe, expect, it } from "vitest";
import {
  DEFAULT_MAX_KASIR_DISCOUNT_PCT, checkOrderDiscount, maxKasirDiscountPct, storeDow,
} from "@/lib/sale-policy";

describe("sale-policy — batas diskon kasir", () => {
  it("default 20% saat settings kosong", () => {
    expect(maxKasirDiscountPct({})).toBe(DEFAULT_MAX_KASIR_DISCOUNT_PCT);
  });
  it("clamp 0..100", () => {
    expect(maxKasirDiscountPct({ maxDiscountKasirPct: -5 })).toBe(0);
    expect(maxKasirDiscountPct({ maxDiscountKasirPct: 150 })).toBe(100);
  });
  it("kasir pct di bawah batas lolos", () => {
    expect(checkOrderDiscount("kasir", { type: "pct", value: 20 }, 100000, 20)).toBeNull();
  });
  it("kasir pct di atas batas ditolak", () => {
    expect(checkOrderDiscount("kasir", { type: "pct", value: 21 }, 100000, 20)).toMatch(/maksimal 20%/);
  });
  it("kasir rp setara batas lolos, lebih ditolak", () => {
    expect(checkOrderDiscount("kasir", { type: "rp", value: 20000 }, 100000, 20)).toBeNull();
    expect(checkOrderDiscount("kasir", { type: "rp", value: 20001 }, 100000, 20)).toMatch(/maksimal/);
  });
  it("admin bebas diskon (penjualannya diawasi flag adminSalesAsTest)", () => {
    expect(checkOrderDiscount("admin", { type: "pct", value: 100 }, 100000, 20)).toBeNull();
  });
  it("diskon negatif ditolak untuk semua role", () => {
    expect(checkOrderDiscount("admin", { type: "pct", value: -1 }, 100000, 20)).toMatch(/tidak valid/);
  });
});

describe("sale-policy — hari toko", () => {
  const t = new Date("2026-11-18T20:00:00Z"); // Rabu 20:00 UTC = Kamis 03:00 WIB
  it("Asia/Jakarta menentukan promo, bukan UTC", () => {
    expect(storeDow("Asia/Jakarta", t)).toBe(4);
    expect(storeDow("UTC", t)).toBe(3);
  });
  it("timezone ngawur fallback ke hari lokal", () => {
    expect(storeDow("Bukan/Timezone", t)).toBe(t.getDay());
  });
});