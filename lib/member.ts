import type { Customer, MemberTier, Settings, Transaction } from "./types";
import { clamp, num, rupiah } from "./format";

export const TIERS: MemberTier[] = ["Bronze", "Silver", "Gold", "Platinum"];

export const TIER_COLOR: Record<MemberTier, string> = {
  Bronze: "var(--amber)",
  Silver: "var(--muted)",
  Gold: "var(--amber)",
  Platinum: "var(--violet)",
};

/** Ambang tier dihitung dari TOTAL AKUMULASI BELANJA (Rp). */
export function tierThresholds(s: Settings) {
  const silver = Math.max(1, Math.round(s.memberTierSilver || 1500000));
  const gold = Math.max(silver + 1, Math.round(s.memberTierGold || 5000000));
  const platinum = Math.max(gold + 1, Math.round(s.memberTierPlatinum || 15000000));
  return { Bronze: 0, Silver: silver, Gold: gold, Platinum: platinum } as Record<MemberTier, number>;
}

/** Bonus diskon per tier — persis angka yang diatur admin (Bronze ikut bisa diatur). */
export function tierBonus(tier: MemberTier, s: Settings) {
  if (tier === "Bronze") return clamp(s.memberBonusBronze || 0, 0, 25);
  if (tier === "Silver") return clamp(s.memberBonusSilver || 0, 0, 25);
  if (tier === "Gold") return clamp(s.memberBonusGold || 0, 0, 25);
  if (tier === "Platinum") return clamp(s.memberBonusPlatinum || 0, 0, 25);
  return 0;
}

export function tierOf(spend: number, s: Settings): MemberTier {
  const p = Math.max(0, spend || 0);
  const t = tierThresholds(s);
  if (p >= t.Platinum) return "Platinum";
  if (p >= t.Gold) return "Gold";
  if (p >= t.Silver) return "Silver";
  return "Bronze";
}

export function nextTier(spend: number, s: Settings) {
  const current = tierOf(spend, s);
  const i = TIERS.indexOf(current);
  if (i >= TIERS.length - 1) return null;
  const next = TIERS[i + 1];
  return { tier: next, need: Math.max(0, tierThresholds(s)[next] - Math.max(0, spend || 0)) };
}

export function tierProgress(spend: number, s: Settings) {
  const t = tierThresholds(s);
  const current = tierOf(spend, s);
  const i = TIERS.indexOf(current);
  const floor = t[current];
  const ceil = i >= TIERS.length - 1 ? t.Platinum : t[TIERS[i + 1]];
  if (ceil <= floor) return 100;
  return clamp(((Math.max(0, spend || 0) - floor) / (ceil - floor)) * 100, 0, 100);
}

/** Total potongan riil di kasir (dasar + bonus tier). Dipakai untuk simulasi/preview, bukan penjelasan tier. */
export function totalTierPct(tier: MemberTier, s: Settings) {
  return clamp((s.memberDiscountPct || 0) + tierBonus(tier, s), 0, 40);
}

export function normalizePhone(v: string) {
  return (v || "").replace(/[^\d+]/g, "").replace(/^\+?62/, "0");
}

export function normalizeUsername(v: string) {
  return (v || "").trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");
}

export function makeMemberNo(existing: Customer[]) {
  const used = new Set(existing.map((c) => c.memberNo).filter(Boolean) as string[]);
  let n = existing.filter((c) => c.member && c.memberNo).length + 1;
  let no = `NUSA-${String(n).padStart(4, "0")}`;
  while (used.has(no)) { n++; no = `NUSA-${String(n).padStart(4, "0")}`; }
  return no;
}

export function makeMemberUsername(source: string, fallback: string, existing: Customer[], selfId?: string) {
  const base = normalizeUsername(source) || normalizeUsername(fallback) || "member";
  const root = base.length >= 3 ? base : `member${base.replace(/[^a-z0-9]/g, "") || "01"}`;
  const used = new Set(
    existing
      .filter((c) => c.member && c.id !== selfId)
      .map((c) => normalizeUsername(c.username ?? ""))
      .filter(Boolean)
  );

  let candidate = root.slice(0, 20);
  let n = 1;
  while (used.has(candidate)) {
    n++;
    const suffix = `-${n}`;
    candidate = `${root.slice(0, Math.max(1, 20 - suffix.length))}${suffix}`;
  }
  return candidate;
}

export function makePin() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function pointsFor(total: number, s: Settings) {
  if (!s.memberEnabled) return 0;
  const rate = Math.max(100, s.memberPointRate || 1000);
  return Math.floor(Math.max(0, total) / rate);
}

export function isBirthday(c: Customer, now = Date.now()) {
  if (!c.birthDate) return false;
  const d = new Date(c.birthDate);
  if (Number.isNaN(d.getTime())) return false;
  const n = new Date(now);
  return d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

export function memberDiscountPct(c: Customer | null, s: Settings) {
  if (!c || !c.member || c.memberActive === false || !s.memberEnabled) return 0;
  const bonus = tierBonus(tierOf(c.spend ?? 0, s), s);
  const bday = isBirthday(c) ? clamp(s.memberBirthdayPct || 0, 0, 25) : 0;
  return clamp((s.memberDiscountPct || 0) + bonus + bday, 0, 40);
}

export function validateMember(
  draft: { name: string; phone: string; email: string; birthDate: string; username?: string },
  all: Customer[],
  selfId?: string
) {
  const e: Record<string, string> = {};
  if (draft.name.trim().length < 3) e.name = "Nama minimal 3 karakter";

  const phone = normalizePhone(draft.phone);
  if (phone.length < 8 || phone.length > 16) e.phone = "Nomor HP 8–16 digit";
  else if (all.some((c) => c.id !== selfId && c.phone !== "-" && normalizePhone(c.phone) === phone)) e.phone = "Nomor sudah terdaftar";

  const username = normalizeUsername(draft.username ?? "");
  if (username.length < 3) e.username = "Username minimal 3 karakter";
  else if (!/^[a-z0-9._-]{3,20}$/.test(username)) e.username = "Username 3–20 karakter: huruf, angka, titik, - atau _";
  else if (all.some((c) => c.id !== selfId && c.member && normalizeUsername(c.username ?? "") === username)) e.username = "Username sudah dipakai member lain";

  if (draft.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(draft.email.trim())) e.email = "Format email tidak valid";

  if (draft.birthDate) {
    const d = new Date(draft.birthDate);
    if (Number.isNaN(d.getTime())) e.birthDate = "Tanggal tidak valid";
    else if (d.getTime() > Date.now()) e.birthDate = "Tanggal lahir tidak boleh di masa depan";
  }

  return e;
}

export function memberStats(c: Customer, txs: Transaction[]) {
  const mine = txs.filter((t) => t.customerId === c.id && !t.isTest);
  const done = mine.filter((t) => t.status === "Selesai");
  const spend = done.reduce((a, t) => a + t.total, 0);
  const points = done.reduce((a, t) => a + (t.memberPoints ?? 0), 0);
  const last = done.length ? Math.max(...done.map((t) => t.ts)) : null;
  const avg = done.length ? spend / done.length : 0;
  const saved = done.reduce((a, t) => a + (t.memberDiscount ?? 0), 0);
  return { count: done.length, spend, points, last, avg, saved, refunds: mine.length - done.length };
}

export function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "MB";
}

export function memberDisplayName(c: Customer) {
  return c.username ? `@${c.username}` : c.memberNo ?? c.phone;
}

export interface BenefitItem {
  key: string;
  icon: "percent" | "star" | "heart" | "calendar" | "gift" | "shield";
  title: string;
  value: string;
  desc: string;
  color: string;
}

/** Daftar benefit nyata yang dibaca dari pengaturan admin. */
export function benefitItems(s: Settings): BenefitItem[] {
  const t = tierThresholds(s);
  return [
    {
      key: "base", icon: "percent", color: "var(--pandan)",
      title: "Potongan setiap belanja",
      value: s.memberEnabled ? `${s.memberDiscountPct}%` : "Program nonaktif",
      desc: "Langsung memotong total belanja di kasir, tanpa minimum transaksi dan tanpa kode kupon.",
    },
    {
      key: "tier", icon: "shield", color: "var(--amber)",
      title: "Bonus diskon tiap tier",
      value: `Bronze ${tierBonus("Bronze", s)}% · Silver ${tierBonus("Silver", s)}% · Gold ${tierBonus("Gold", s)}% · Platinum ${tierBonus("Platinum", s)}%`,
      desc: `Bonus di atas potongan dasar, naik otomatis dari akumulasi belanja. Ambang: Silver ${rupiah(t.Silver)} · Gold ${rupiah(t.Gold)} · Platinum ${rupiah(t.Platinum)}.`,
    },
    {
      key: "point", icon: "star", color: "var(--violet)",
      title: "Kumpulkan poin, tukar hadiah",
      value: s.memberEnabled ? `1 poin / ${rupiah(Math.max(100, s.memberPointRate))}` : "—",
      desc: "Poin masuk otomatis tiap transaksi dan bisa ditukar di katalog hadiah member.",
    },
    {
      key: "birthday", icon: "calendar", color: "var(--magenta)",
      title: "Bonus ulang tahun",
      value: `+${s.memberBirthdayPct}%`,
      desc: "Tambahan potongan pada hari ulang tahun, di atas potongan tier yang sedang aktif.",
    },
    {
      key: "welcome", icon: "gift", color: "var(--laut)",
      title: "Poin sambutan",
      value: `+${num(s.memberWelcomePoints)} poin`,
      desc: "Hadiah poin saat pertama kali mendaftar, langsung bisa dipakai untuk ditukar.",
    },
    {
      key: "history", icon: "heart", color: "var(--chili)",
      title: "Portal member mandiri",
      value: "Username + PIN",
      desc: "Login pakai username dan PIN yang dibuatkan kasir untuk cek poin, tier, riwayat, dan tukar hadiah.",
    },
  ];
}