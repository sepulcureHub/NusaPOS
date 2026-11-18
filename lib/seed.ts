import type { Customer, PointReward, Product, SeedData, ShiftPlan, ShiftSession, Transaction, TxItem } from "./types";
import {
  DEMO_BEHAVIOR, DEMO_CUSTOMERS, DEMO_DEFAULT_DAYS, DEMO_HOUR_WEIGHTS, DEMO_PRODUCTS,
  DEMO_REWARDS, DEMO_SETTINGS, DEMO_SHIFT_TEMPLATE, DEMO_TABLES, DEMO_USERS, DEMO_VIEWS, OPERATING_HOURS, STORE_CLOSE,
} from "./demo-data";
import { calcTotals, clamp, startOfDay } from "./format";
import { isAvailableOn, toTxItem } from "./pricing";
import { computeAutoClose, toMinutes } from "./shift";
import { memberDiscountPct, pointsFor, tierOf } from "./member";

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DAY_MS = 86400000;
const B = DEMO_BEHAVIOR;

export function defaultShiftPlans(users: { id: string; username: string; role: string }[]): ShiftPlan[] {
  const kasir = users.filter((u) => u.role === "kasir");
  if (!kasir.length) return [];
  const out: ShiftPlan[] = [];
  DEMO_SHIFT_TEMPLATE.forEach((t, i) => {
    const u = kasir.find((x) => x.username === t.username) ?? kasir[i % kasir.length];
    const id = `plan-${u.id}-${t.day}-${t.start.replace(":", "")}`;
    if (out.some((p) => p.id === id)) return;
    out.push({ id, userId: u.id, day: t.day, start: t.start, end: t.end, note: t.note, active: true });
  });
  return out;
}

export function buildSeed(seed: number): SeedData {
  const r = rng(seed);

  const products: Product[] = DEMO_PRODUCTS.map((d, i) => ({
    id: `p${i + 1}`, name: d.name, sku: d.sku, category: d.category, price: d.price, cost: d.cost,
    emoji: d.emoji, popularity: d.popularity,
    stock: d.kind === "bundle" ? 0 : (i % B.lowStockEvery === B.lowStockOffset ? Math.floor(r() * 8) + 2 : Math.floor(r() * 60) + (d.popularity > 6 ? 30 : 12)),
    active: true, desc: d.desc ?? "", photo: null,
    discount: d.discount ?? { type: "pct", value: 0 },
    dayPromos: (d.promos ?? []).map((x) => ({ ...x })),
    availableDays: [...(d.days ?? DEMO_DEFAULT_DAYS)],
    kind: d.kind ?? "single",
    bundleItems: (d.bundle ?? []).map((c) => ({ productId: `p${DEMO_PRODUCTS.findIndex((x) => x.sku === c.sku) + 1}`, qty: c.qty })),
  }));

  const rewards: PointReward[] = DEMO_REWARDS.map((rw, i) => ({
    id: `rw${i + 1}`, name: rw.name, emoji: rw.emoji, desc: rw.desc,
    cost: rw.cost, active: rw.active, createdAt: Date.now() - i * DAY_MS,
  }));

  const users = DEMO_USERS.map((u) => ({ ...u }));
  const kasirUsers = users.filter((u) => u.role === "kasir");
  const owner = users.find((u) => u.role === "admin")!;
  const shiftPlans = defaultShiftPlans(users);
  const customers: Customer[] = DEMO_CUSTOMERS.map((c) => ({ ...c }));
  const members = customers.filter((c) => c.member);

  const totalHW = DEMO_HOUR_WEIGHTS.reduce((a, b) => a + b, 0);
  const pickHour = () => {
    let x = r() * totalHW;
    for (let i = 0; i < OPERATING_HOURS.length; i++) { x -= DEMO_HOUR_WEIGHTS[i]; if (x <= 0) return OPERATING_HOURS[i]; }
    return OPERATING_HOURS[Math.floor(OPERATING_HOURS.length / 2)];
  };

  const now = Date.now();
  const today = startOfDay(now);
  const nowH = new Date().getHours();
  const nowM = new Date().getMinutes();
  const openH = OPERATING_HOURS[0];
  const spanH = OPERATING_HOURS[OPERATING_HOURS.length - 1] - openH;
  const txs: Transaction[] = [];
  const shiftSessions: ShiftSession[] = [];

  for (let d = B.days - 1; d >= 0; d--) {
    const dayStart = today - d * DAY_MS;
    const dt = new Date(dayStart);
    const wd = dt.getDay();
    const weekend = wd === 0 || wd === 6;
    const pool = products.filter((p) => isAvailableOn(p, wd));
    const totalPop = pool.reduce((a, p) => a + p.popularity, 0);
    const pick = () => {
      let x = r() * totalPop;
      for (const p of pool) { x -= p.popularity; if (x <= 0) return p; }
      return pool[0];
    };

    const dayPlans = shiftPlans.filter((p) => p.day === wd && p.active);
    const daySessions: ShiftSession[] = dayPlans.map((p) => {
      const u = kasirUsers.find((x) => x.id === p.userId)!;
      const late = Math.floor(r() * 22) - 6;
      const early = Math.floor(r() * 18) - 4;
      const openedAt = dayStart + (toMinutes(p.start) + late) * 60000;
      const autoCloseAt = dayStart + toMinutes(p.end) * 60000;
      const isToday = d === 0;
      const stillOpen = isToday && now < autoCloseAt && now >= openedAt;
      const closedAt = stillOpen ? null : Math.max(openedAt + 3600000, Math.min(dayStart + (toMinutes(p.end) + early) * 60000, isToday ? now : dayStart + (toMinutes(p.end) + early) * 60000));
      return {
        id: `ses-${p.id}-${dayStart}`, userId: u.id, userName: u.name, planId: p.id,
        openedAt, closedAt, autoCloseAt, openingCash: B.openingCash, closingCash: null,
        note: p.note, source: "manual" as const, openedBy: u.id, closedBy: stillOpen ? null : ("auto" as const),
      };
    }).filter((s) => s.openedAt < now);
    shiftSessions.push(...daySessions);

    let count = Math.floor(B.baseOrders + r() * B.orderVariance + (weekend ? B.weekendBoost : 0));
    if (d === 0) count = Math.max(3, Math.floor(count * clamp((nowH * 60 + nowM - openH * 60) / (spanH * 60), 0.08, 1)));
    const dateKeyStr = `${String(dt.getFullYear()).slice(2)}${String(dt.getMonth() + 1).padStart(2, "0")}${String(dt.getDate()).padStart(2, "0")}`;

    const dayTx: Transaction[] = [];
    for (let k = 0; k < count; k++) {
      let hour = pickHour();
      if (d === 0) hour = Math.min(hour, Math.max(openH, nowH));
      let ts = dayStart + hour * 3600000 + Math.floor(r() * 60) * 60000;
      if (d === 0) ts = clamp(ts, dayStart, now - 60000);

      const n = 1 + Math.floor(r() * B.maxItems) + (r() < B.extraItemChance ? 1 : 0);
      const items: TxItem[] = [];
      for (let j = 0; j < n; j++) {
        const p = pick();
        if (!p) continue;
        const qty = 1 + (r() < B.doubleQtyChance ? 1 : 0) + (r() < B.tripleQtyChance ? 1 : 0);
        const ex = items.find((it) => it.productId === p.id);
        if (ex) ex.qty += qty; else items.push(toTxItem(p, products, qty, wd));
      }
      if (!items.length) continue;

      const ses = daySessions.find((s) => ts >= s.openedAt && ts <= (s.closedAt ?? now)) ?? null;
      const cashier = ses?.userName ?? owner.name;
      const isMember = r() < B.memberChance;
      const cust = isMember ? members[Math.floor(r() * members.length)] : (r() < B.walkInChance ? customers[0] : customers[1 + Math.floor(r() * (customers.length - 1))]);
      const mPct = cust.member ? memberDiscountPct(cust, DEMO_SETTINGS) : 0;
      const orderDisc = r() < B.orderDiscountChance ? (r() < 0.5 ? B.orderDiscountFlat : 0) : 0;
      const t = calcTotals(items, { type: "rp", value: orderDisc }, DEMO_SETTINGS, mPct);
      const mr = r();
      const method = mr < B.qrisThreshold ? "QRIS" : mr < B.tunaiThreshold ? "Tunai" : "Kartu";
      const tendered = method === "Tunai" ? Math.ceil(t.total / B.cashRoundTo) * B.cashRoundTo + (r() < B.cashExtraChance ? B.cashExtra : 0) : t.total;

      dayTx.push({
        id: `NP-${dateKeyStr}-${String(k + 1).padStart(3, "0")}`,
        ts, items, subtotal: t.subtotal, discount: t.discount, memberDiscount: t.memberDiscount,
        memberPoints: cust.member ? pointsFor(t.total, DEMO_SETTINGS) : 0,
        memberNo: cust.memberNo,
        memberTier: cust.member ? tierOf(cust.spend ?? 0, DEMO_SETTINGS) : undefined,
        tax: t.tax, service: t.service, total: t.total,
        method, tendered, change: tendered - t.total,
        customerId: cust.id, customerName: cust.name, cashier,
        status: r() < B.refundChance ? "Refund" : "Selesai",
        shiftId: ses?.id,
        orderType: "takeaway",
        tableId: null,
        tableLabel: null,
      });
    }

    for (const s of daySessions) {
      if (s.closedAt === null) continue;
      const cash = dayTx.filter((t) => t.shiftId === s.id && t.method === "Tunai");
      const sales = cash.filter((t) => t.status === "Selesai").reduce((a, t) => a + t.total, 0);
      const ref = cash.filter((t) => t.status === "Refund").reduce((a, t) => a + t.total, 0);
      const drift = r() < 0.2 ? Math.round((r() - 0.5) * 24) * 500 : 0;
      s.closingCash = r() < 0.12 ? null : Math.max(0, s.openingCash + sales - ref + drift);
    }

    txs.push(...dayTx);
  }
  txs.sort((a, b) => a.ts - b.ts);

  return {
    products, transactions: txs, customers, held: [],
    views: DEMO_VIEWS.map((v) => ({ ...v })), settings: { ...DEMO_SETTINGS },
    users, session: null, shiftPlans, shiftSessions,
    rewards, redemptions: [], notifications: [], notifReadAt: 0, memberSession: null,
    tables: DEMO_TABLES.map((t) => ({ ...t })),
  };
}

export { computeAutoClose, STORE_CLOSE };