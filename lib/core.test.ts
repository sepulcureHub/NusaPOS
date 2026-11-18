import { describe, expect, it } from "vitest";
import { calcTotals, toCSV } from "./format";
import { memberDiscountPct, normalizePhone, pointsFor, tierOf, validateMember } from "./member";
import { can, routeAllowed } from "./auth";
import { freeTables, makeTable, tableStats } from "./tables";
import { normalizeTables } from "./store";
import { clientKey, rateLimit } from "./rate-limit";
import { DEMO_SETTINGS } from "./demo-data";
import type { Customer, Settings, TxItem } from "./types";

const S: Settings = { ...DEMO_SETTINGS };

const item = (price: number, qty: number): TxItem => ({
  productId: "p1", name: "Kopi Susu", emoji: "☕", category: "Kopi", price, qty,
});

const member = (over: Partial<Customer> = {}): Customer => ({
  id: "c1", name: "Siti Rahma", phone: "081234567890", member: true,
  memberNo: "NUSA-0001", username: "siti", spend: 0, points: 0, visits: 0, ...over,
});

/* Tanggal lokal tanpa zona → aman di semua timezone. */
const now = new Date();
const birthdayToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}T00:00:00`;

describe("calcTotals — uang", () => {
  it("urutan: subtotal → diskon order → diskon member → pajak", () => {
    const t = calcTotals([item(25000, 2)], { type: "pct", value: 10 }, S, 8);
    expect(t.subtotal).toBe(50000);
    expect(t.discount).toBe(5000);
    expect(t.memberDiscount).toBe(3600);
    expect(t.tax).toBe(4554);
    expect(t.total).toBe(45954);
  });

  it("diskon nominal tidak melebihi subtotal", () => {
    const t = calcTotals([item(10000, 1)], { type: "rp", value: 999999 }, S, 0);
    expect(t.discount).toBe(10000);
    expect(t.total).toBe(0);
  });

  it("diskon member 100% menghanguskan basis pajak", () => {
    const t = calcTotals([item(20000, 1)], { type: "pct", value: 0 }, S, 100);
    expect(t.memberDiscount).toBe(20000);
    expect(t.tax).toBe(0);
    expect(t.total).toBe(0);
  });

  it("service charge ikut dihitung di atas basis setelah diskon", () => {
    const t = calcTotals([item(100000, 1)], { type: "pct", value: 0 }, { ...S, servicePct: 5 }, 0);
    expect(t.service).toBe(5000);
    expect(t.tax).toBe(11000);
    expect(t.total).toBe(116000);
  });
});

describe("member — tier & diskon", () => {
  it("tier naik dari akumulasi belanja, bukan poin", () => {
    expect(tierOf(0, S)).toBe("Bronze");
    expect(tierOf(1_500_000, S)).toBe("Silver");
    expect(tierOf(5_140_000, S)).toBe("Gold");
    expect(tierOf(15_000_000, S)).toBe("Platinum");
  });

  it("diskon = dasar + bonus tier", () => {
    expect(memberDiscountPct(member({ spend: 5_140_000 }), S)).toBe(8);
  });

  it("total diskon di-cap 40%", () => {
    const max: Settings = { ...S, memberDiscountPct: 25, memberBonusPlatinum: 25, memberBirthdayPct: 25 };
    expect(memberDiscountPct(member({ spend: 20_000_000, birthDate: birthdayToday }), max)).toBe(40);
  });

  it("member nonaktif / program mati = 0%", () => {
    expect(memberDiscountPct(member({ memberActive: false }), S)).toBe(0);
    expect(memberDiscountPct(member(), { ...S, memberEnabled: false })).toBe(0);
  });

  it("poin 1 per Rp1.000, dibulatkan ke bawah", () => {
    expect(pointsFor(45954, S)).toBe(45);
    expect(pointsFor(999, S)).toBe(0);
  });

  it("normalisasi HP +62 → 0 dan tolak duplikat", () => {
    expect(normalizePhone("+62 812-3456-7890")).toBe("081234567890");
    const errs = validateMember(
      { name: "Siti Rahma", phone: "081234567890", email: "", birthDate: "", username: "siti" },
      [member()]
    );
    expect(errs.phone).toBeTruthy();
    expect(errs.username).toBeTruthy();
  });
});

describe("toCSV — anti formula injection", () => {
  it("menetralkan = + - @ di awal sel teks", () => {
    const csv = toCSV([["Nama"], ["=1+1"], ["+cmd"], ["-2"], ["@SUM(A1)"]]);
    expect(csv).toContain("'=1+1");
    expect(csv).toContain("'+cmd");
    expect(csv).toContain("'-2");
    expect(csv).toContain("'@SUM(A1)");
  });

  it("angka negatif tetap angka", () => {
    const csv = toCSV([[-5000]]);
    expect(csv).toContain("-5000");
    expect(csv).not.toContain("'-5000");
  });

  it("koma & kutip di-escape, BOM tetap ada", () => {
    const csv = toCSV([['Kopi, Susu "enak"']]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain('"Kopi, Susu ""enak"""');
  });
});

describe("meja", () => {
  it("kursi dibatasi 1–20, meja baru selalu kosong", () => {
    expect(makeTable({ label: "T01", area: "Indoor", seats: 99 }).seats).toBe(20);
    expect(makeTable({ label: "T02", area: "Indoor", seats: 0 }).seats).toBe(1);
    expect(makeTable({ label: "T03", area: "Indoor" }).status).toBe("kosong");
  });

  it("statistik & daftar kosong hanya menghitung meja aktif", () => {
    const a = makeTable({ label: "A", area: "Indoor", seats: 4 });
    const b = { ...makeTable({ label: "B", area: "Indoor", seats: 2 }), status: "terisi" as const };
    const off = { ...makeTable({ label: "C", area: "VIP", seats: 6 }), active: false };
    expect(tableStats([a, b, off])).toMatchObject({ total: 2, free: 1, busy: 1, seats: 6, freeSeats: 4 });
    expect(freeTables([a, b, off]).map((t) => t.label)).toEqual(["A"]);
  });

  it("REGRESI: hapus semua meja tidak membangkitkan 13 meja demo", () => {
    expect(normalizeTables([])).toEqual([]);
  });

  it("REGRESI: data lama tanpa key tables tetap dapat meja demo", () => {
    expect(normalizeTables(undefined)).toHaveLength(13);
  });
});

describe("akses route", () => {
  it("REGRESI: kasir tidak boleh membuka /notifikasi", () => {
    expect(routeAllowed("/notifikasi", "kasir")).toBe(false);
    expect(routeAllowed("/notifikasi", "admin")).toBe(true);
  });

  it("REGRESI: /memberku tidak lagi terjepit prefix /member", () => {
    expect(routeAllowed("/memberku", "kasir")).toBe(true);
    expect(routeAllowed("/member", "kasir")).toBe(true);
    expect(routeAllowed("/produk", "kasir")).toBe(false);
  });

  it("refund & ekspor tetap khusus admin", () => {
    expect(can("kasir", "tx.refund")).toBe(false);
    expect(can("kasir", "tx.export")).toBe(false);
    expect(can("admin", "tx.refund")).toBe(true);
  });
});

describe("rate limit geocode", () => {
  it("memblokir setelah kuota habis dan reset saat window lewat", () => {
    const t0 = 1_000_000;
    expect(rateLimit("test-a", 2, 1000, t0).ok).toBe(true);
    expect(rateLimit("test-a", 2, 1000, t0 + 1).ok).toBe(true);
    const third = rateLimit("test-a", 2, 1000, t0 + 2);
    expect(third.ok).toBe(false);
    expect(third.remaining).toBe(0);
    expect(third.retryAfter).toBe(1);
    expect(rateLimit("test-a", 2, 1000, t0 + 1000).ok).toBe(true);
  });

  it("key berbeda punya kuota sendiri", () => {
    const t0 = 2_000_000;
    expect(rateLimit("test-b", 1, 1000, t0).ok).toBe(true);
    expect(rateLimit("test-b", 1, 1000, t0 + 1).ok).toBe(false);
    expect(rateLimit("test-c", 1, 1000, t0 + 1).ok).toBe(true);
  });

  it("ambil IP pertama dari x-forwarded-for", () => {
    expect(clientKey(new Headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" }))).toBe("1.2.3.4");
    expect(clientKey(new Headers())).toBe("local");
  });
});