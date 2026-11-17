import type { Category, ShiftPlan, ShiftSession, Transaction, User } from "./types";
import { METHOD_COLORS, METHODS } from "./types";
import type { DayPoint } from "./analytics";
import { HOURS } from "./analytics";
import { dateID, dayKey, startOfDay, uid } from "./format";

const DAY_MS = 86400000;
export const DAY_NAMES = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
export const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export const toMinutes = (t: string) => {
  const [h, m] = t.split(":").map((x) => parseInt(x, 10));
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
};
export const fromMinutes = (m: number) => {
  const x = ((m % 1440) + 1440) % 1440;
  return `${String(Math.floor(x / 60)).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`;
};
export const spanMinutes = (start: string, end: string) => {
  const a = toMinutes(start), b = toMinutes(end);
  return b > a ? b - a : b + 1440 - a;
};
export const fmtDuration = (min: number) => {
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}j ${m % 60}m` : `${m}m`;
};
export const overlaps = (aS: string, aE: string, bS: string, bE: string) => {
  const a1 = toMinutes(aS), a2 = a1 + spanMinutes(aS, aE);
  const b1 = toMinutes(bS), b2 = b1 + spanMinutes(bS, bE);
  return a1 < b2 && b1 < a2;
};

export const countdown = (ms: number) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}j ${String(m).padStart(2, "0")}m` : `${m}m ${String(s).padStart(2, "0")}d`;
};

export function sessionMinutes(s: ShiftSession, now = Date.now()) {
  return Math.max(0, ((s.closedAt ?? now) - s.openedAt) / 60000);
}

export function openSessionOf(sessions: ShiftSession[], userId: string) {
  return sessions.find((s) => s.userId === userId && s.closedAt === null) ?? null;
}

export function planForDay(plans: ShiftPlan[], userId: string, day: number) {
  return plans.filter((p) => p.userId === userId && p.day === day && p.active);
}

export function weekMinutes(plans: ShiftPlan[], userId: string) {
  return plans.filter((p) => p.userId === userId && p.active).reduce((a, p) => a + spanMinutes(p.start, p.end), 0);
}

/** Jam tutup otomatis: ikuti jam tutup jadwal hari ini, fallback jam tutup toko. */
export function computeAutoClose(plan: ShiftPlan | null, storeClose: string, now = Date.now()): number | null {
  const d = new Date(now);
  const base = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const endMin = plan ? toMinutes(plan.end) : toMinutes(storeClose);
  let ts = base + endMin * 60000;
  if (plan && toMinutes(plan.end) <= toMinutes(plan.start)) ts += DAY_MS;
  if (ts <= now) {
    const fallback = base + toMinutes(storeClose) * 60000;
    if (fallback > now) return fallback;
    return now + 4 * 3600000;
  }
  return ts;
}

export function coverageByDay(plans: ShiftPlan[], openMin: number, closeMin: number) {
  return DAY_ORDER.map((day) => {
    const list = plans.filter((p) => p.day === day && p.active);
    const covered = list.reduce((a, p) => a + spanMinutes(p.start, p.end), 0);
    const target = closeMin - openMin;
    const gaps: string[] = [];
    const sorted = [...list].sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
    let cursor = openMin;
    for (const p of sorted) {
      const s = toMinutes(p.start);
      if (s > cursor) gaps.push(`${fromMinutes(cursor)}–${fromMinutes(Math.min(s, closeMin))}`);
      cursor = Math.max(cursor, s + spanMinutes(p.start, p.end));
    }
    if (cursor < closeMin) gaps.push(`${fromMinutes(cursor)}–${fromMinutes(closeMin)}`);
    return { day, covered, target, gaps, count: list.length };
  });
}

export function cashInSession(session: ShiftSession, txs: Transaction[]) {
  const end = session.closedAt ?? Date.now();
  const mine = txs.filter((t) => t.shiftId === session.id && t.ts >= session.openedAt && t.ts <= end + 1000);
  const cash = mine.filter((t) => t.method === "Tunai");
  const sales = cash.filter((t) => t.status === "Selesai").reduce((a, t) => a + t.total, 0);
  const refunds = cash.filter((t) => t.status === "Refund").reduce((a, t) => a + t.total, 0);
  const revenue = mine.filter((t) => t.status === "Selesai").reduce((a, t) => a + t.total, 0);
  return { sales, refunds, revenue, count: mine.filter((t) => t.status === "Selesai").length, expected: session.openingCash + sales - refunds };
}

export function backfillSessions(txs: Transaction[], users: User[], openingCash: number): ShiftSession[] {
  const kasir = users.filter((u) => u.role === "kasir");
  const buckets = new Map<string, { user: User; day: number; first: number; last: number }>();
  for (const t of txs) {
    const u = kasir.find((x) => x.name === t.cashier);
    if (!u) continue;
    const k = `${u.id}|${dayKey(t.ts)}`;
    const b = buckets.get(k);
    if (b) { b.first = Math.min(b.first, t.ts); b.last = Math.max(b.last, t.ts); }
    else buckets.set(k, { user: u, day: startOfDay(t.ts), first: t.ts, last: t.ts });
  }
  return [...buckets.values()].map((b) => ({
    id: `auto-${b.user.id}-${b.day}`,
    userId: b.user.id, userName: b.user.name, planId: null,
    openedAt: b.first - 6 * 60000,
    closedAt: b.last + 8 * 60000,
    autoCloseAt: b.last + 8 * 60000,
    openingCash, closingCash: null,
    note: "Diperkirakan otomatis dari riwayat transaksi",
    source: "auto" as const, closedBy: "auto" as const,
  }));
}

export function attachShiftIds(txs: Transaction[], sessions: ShiftSession[]) {
  const byName = new Map<string, ShiftSession[]>();
  sessions.forEach((s) => {
    const arr = byName.get(s.userName) ?? [];
    arr.push(s);
    byName.set(s.userName, arr);
  });
  return txs.map((t) => {
    if (t.shiftId) return t;
    const list = byName.get(t.cashier) ?? [];
    const hit = list.find((s) => t.ts >= s.openedAt && t.ts <= (s.closedAt ?? Date.now()));
    return hit ? { ...t, shiftId: hit.id } : t;
  });
}

export interface CashierDay {
  key: string; label: string; full: string; ts: number;
  revenue: number; tx: number; items: number; avg: number;
  minutes: number; perHour: number | null; refund: number; discount: number;
  cash: number; variance: number; late: number; sessions: number; members: number; points: number;
}

export interface ScorePart { label: string; detail: string; score: number; weight: number }

export interface CashierReport {
  user: User;
  txCount: number; revenue: number; items: number; avgBasket: number; itemsPerTx: number;
  refundCount: number; refundValue: number; discountGiven: number; promoTx: number;
  memberTx: number; memberRevenue: number; newMembers: number; pointsIssued: number;
  minutes: number; perHour: number | null; idleMinutes: number; longestGap: number;
  lateMinutes: number; lateCount: number; onTimeRate: number | null; outsideTx: number;
  autoClosed: number; uncounted: number;
  cashSales: number; cashExpected: number; cashCounted: number; cashVariance: number; countedSessions: number;
  sessionCount: number; open: ShiftSession | null;
  methods: { method: string; value: number; count: number; color: string }[];
  hours: { label: string; value: number; revenue: number }[];
  top: { name: string; emoji: string; category: Category; qty: number; revenue: number }[];
  days: CashierDay[];
  series: DayPoint[];
  peakHour: string | null;
  firstTx: number | null; lastTx: number | null;
  score: number;
  scoreParts: ScorePart[];
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export function cashierReport(
  user: User, allTx: Transaction[], allSessions: ShiftSession[], plans: ShiftPlan[], days: number,
  newMemberCount = 0
): CashierReport {
  const t0 = startOfDay(Date.now());
  const start = t0 - (days - 1) * DAY_MS;
  const now = Date.now();

  const sessions = allSessions.filter((s) => s.userId === user.id && (s.closedAt ?? now) >= start);
  const ids = new Set(sessions.map((s) => s.id));
  const txs = allTx.filter((t) => t.ts >= start && (t.cashier === user.name || (t.shiftId ? ids.has(t.shiftId) : false)));
  const done = txs.filter((t) => t.status === "Selesai");
  const refunds = txs.filter((t) => t.status === "Refund");

  const revenue = done.reduce((a, t) => a + t.total, 0);
  const items = done.reduce((a, t) => a + t.items.reduce((b, i) => b + i.qty, 0), 0);
  const discountGiven = done.reduce((a, t) => a + t.discount + (t.memberDiscount ?? 0) + t.items.reduce((b, i) => b + Math.max(0, ((i.basePrice ?? i.price) - i.price) * i.qty), 0), 0);
  const promoTx = done.filter((t) => t.discount > 0 || t.items.some((i) => (i.basePrice ?? i.price) > i.price)).length;
  const memberTx = done.filter((t) => !!t.memberNo).length;
  const memberRevenue = done.filter((t) => !!t.memberNo).reduce((a, t) => a + t.total, 0);
  const pointsIssued = done.reduce((a, t) => a + (t.memberPoints ?? 0), 0);

  const minutes = sessions.reduce((a, s) => a + sessionMinutes(s, now), 0);
  const perHour = minutes > 30 ? done.length / (minutes / 60) : null;

  let idleMinutes = 0, longestGap = 0, outsideTx = 0;
  for (const s of sessions) {
    const end = s.closedAt ?? now;
    const inside = done.filter((t) => t.ts >= s.openedAt && t.ts <= end).sort((a, b) => a.ts - b.ts);
    let prev = s.openedAt;
    for (const t of inside) {
      const gap = (t.ts - prev) / 60000;
      if (gap > 15) idleMinutes += gap;
      longestGap = Math.max(longestGap, gap);
      prev = t.ts;
    }
    const tail = (end - prev) / 60000;
    if (tail > 15) idleMinutes += tail;
    longestGap = Math.max(longestGap, tail);
  }
  for (const t of done) {
    if (!t.shiftId) continue;
    const s = sessions.find((x) => x.id === t.shiftId);
    if (!s) continue;
    if (t.ts < s.openedAt || t.ts > (s.closedAt ?? now)) outsideTx++;
  }

  let lateMinutes = 0, lateCount = 0, planned = 0;
  for (const s of sessions) {
    if (!s.planId) continue;
    const p = plans.find((x) => x.id === s.planId);
    if (!p) continue;
    planned++;
    const d = new Date(s.openedAt);
    const delay = d.getHours() * 60 + d.getMinutes() - toMinutes(p.start);
    if (delay > 5) { lateMinutes += delay; lateCount++; }
  }
  const onTimeRate = planned > 0 ? (planned - lateCount) / planned : null;
  const autoClosed = sessions.filter((s) => s.closedBy === "auto").length;
  const uncounted = sessions.filter((s) => s.closedAt !== null && s.closingCash === null).length;

  let cashSales = 0, cashExpected = 0, cashCounted = 0, countedSessions = 0, cashVariance = 0;
  for (const s of sessions) {
    const c = cashInSession(s, allTx);
    cashSales += c.sales;
    if (s.closedAt !== null && s.closingCash !== null) {
      cashExpected += c.expected;
      cashCounted += s.closingCash;
      cashVariance += s.closingCash - c.expected;
      countedSessions++;
    }
  }

  const methods = METHODS.map((m) => {
    const list = done.filter((t) => t.method === m);
    return { method: m as string, value: list.reduce((a, t) => a + t.total, 0), count: list.length, color: METHOD_COLORS[m] };
  });

  const hours = HOURS.map((h) => {
    const list = done.filter((t) => new Date(t.ts).getHours() === h);
    return { label: String(h), value: list.length, revenue: list.reduce((a, t) => a + t.total, 0) };
  });
  const peak = [...hours].sort((a, b) => b.value - a.value)[0];

  const topMap = new Map<string, { name: string; emoji: string; category: Category; qty: number; revenue: number }>();
  for (const t of done) for (const i of t.items) {
    const p = topMap.get(i.productId) ?? { name: i.name, emoji: i.emoji, category: i.category, qty: 0, revenue: 0 };
    p.qty += i.qty; p.revenue += i.price * i.qty;
    topMap.set(i.productId, p);
  }
  const top = [...topMap.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 6);

  const dayList: CashierDay[] = [];
  const series: DayPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const ts = t0 - i * DAY_MS;
    const k = dayKey(ts);
    const dtx = done.filter((t) => dayKey(t.ts) === k);
    const dref = refunds.filter((t) => dayKey(t.ts) === k);
    const dses = sessions.filter((s) => dayKey(s.openedAt) === k);
    const dmin = dses.reduce((a, s) => a + sessionMinutes(s, now), 0);
    const drev = dtx.reduce((a, t) => a + t.total, 0);
    const ditems = dtx.reduce((a, t) => a + t.items.reduce((b, x) => b + x.qty, 0), 0);
    const dlabel = days <= 7 ? new Date(ts).toLocaleDateString("id-ID", { weekday: "short" }) : `${new Date(ts).getDate()}/${new Date(ts).getMonth() + 1}`;
    let variance = 0, late = 0;
    for (const s of dses) {
      const c = cashInSession(s, allTx);
      if (s.closedAt !== null && s.closingCash !== null) variance += s.closingCash - c.expected;
      if (s.planId) {
        const p = plans.find((x) => x.id === s.planId);
        if (p) {
          const dd = new Date(s.openedAt);
          const delay = dd.getHours() * 60 + dd.getMinutes() - toMinutes(p.start);
          if (delay > 5) late += delay;
        }
      }
    }
    dayList.push({
      key: k, label: dlabel, full: dateID(ts), ts,
      revenue: drev, tx: dtx.length, items: ditems, avg: dtx.length ? drev / dtx.length : 0,
      minutes: dmin, perHour: dmin > 30 ? dtx.length / (dmin / 60) : null,
      refund: dref.length, discount: dtx.reduce((a, t) => a + t.discount + (t.memberDiscount ?? 0), 0),
      cash: dtx.filter((t) => t.method === "Tunai").reduce((a, t) => a + t.total, 0),
      variance, late, sessions: dses.length,
      members: dtx.filter((t) => !!t.memberNo).length,
      points: dtx.reduce((a, t) => a + (t.memberPoints ?? 0), 0),
    });
    series.push({ label: dlabel, full: dateID(ts), value: drev, count: dtx.length, items: ditems });
  }

  const avgBasket = done.length ? revenue / done.length : 0;
  const itemsPerTx = done.length ? items / done.length : 0;
  const refundRate = txs.length ? refunds.length / txs.length : 0;

  const scoreParts: ScorePart[] = [
    { label: "Kecepatan layanan", detail: perHour !== null ? `${perHour.toFixed(1)} trx/jam (target 8)` : "Belum ada jam kerja tercatat", score: perHour !== null ? clamp01(perHour / 8) * 100 : 60, weight: 20 },
    { label: "Nilai keranjang", detail: `Rata-rata ${Math.round(avgBasket).toLocaleString("id-ID")} (target 45.000)`, score: clamp01(avgBasket / 45000) * 100, weight: 20 },
    { label: "Ketepatan shift", detail: onTimeRate !== null ? `${Math.round(onTimeRate * 100)}% tepat waktu · ${lateCount}x telat` : "Shift tanpa jadwal acuan", score: onTimeRate !== null ? onTimeRate * 100 : 70, weight: 15 },
    { label: "Akurasi kas", detail: countedSessions ? `Selisih ${Math.round(cashVariance).toLocaleString("id-ID")} dari ${countedSessions} hitung kas` : `${uncounted} shift belum dihitung`, score: countedSessions ? clamp01(1 - Math.abs(cashVariance) / 50000) * 100 : 65, weight: 20 },
    { label: "Kualitas transaksi", detail: `${refunds.length} refund dari ${txs.length} transaksi`, score: clamp01(1 - refundRate / 0.05) * 100, weight: 15 },
    { label: "Akuisisi member", detail: `${newMemberCount} member baru · ${memberTx} transaksi member`, score: clamp01((newMemberCount * 12 + memberTx * 2) / 40) * 100, weight: 10 },
  ];
  const totalWeight = scoreParts.reduce((a, p) => a + p.weight, 0);
  const score = Math.round(scoreParts.reduce((a, p) => a + p.score * p.weight, 0) / totalWeight);

  const sorted = [...done].sort((a, b) => a.ts - b.ts);

  return {
    user,
    txCount: done.length, revenue, items, avgBasket, itemsPerTx,
    refundCount: refunds.length, refundValue: refunds.reduce((a, t) => a + t.total, 0),
    discountGiven, promoTx, memberTx, memberRevenue, newMembers: newMemberCount, pointsIssued,
    minutes, perHour, idleMinutes, longestGap,
    lateMinutes, lateCount, onTimeRate, outsideTx, autoClosed, uncounted,
    cashSales, cashExpected, cashCounted, cashVariance, countedSessions,
    sessionCount: sessions.length, open: sessions.find((s) => s.closedAt === null) ?? null,
    methods, hours, top, days: dayList, series,
    peakHour: peak && peak.value > 0 ? peak.label : null,
    firstTx: sorted[0]?.ts ?? null, lastTx: sorted[sorted.length - 1]?.ts ?? null,
    score, scoreParts,
  };
}

export const newShiftId = () => `sh-${uid()}`;