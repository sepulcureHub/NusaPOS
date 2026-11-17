import type { Category, PayMethod, Transaction } from "./types";
import { CATEGORIES, CATEGORY_COLORS, METHODS, METHOD_COLORS } from "./types";
import { OPERATING_HOURS } from "./demo-data";
import { dateID, dayKey, startOfDay } from "./format";

const DAY_MS = 86400000;
export const HOURS = OPERATING_HOURS;
export const WEEKDAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

export interface DayPoint { label: string; full: string; value: number; count: number; items: number; }

export function windowTx(txs: Transaction[], days: number, prev = false) {
  const t0 = startOfDay(Date.now());
  const start = prev ? t0 - (2 * days - 1) * DAY_MS : t0 - (days - 1) * DAY_MS;
  const end = prev ? t0 - (days - 1) * DAY_MS : Date.now() + 1;
  return txs.filter((t) => t.status === "Selesai" && t.ts >= start && t.ts < end);
}

export function dailySeries(txs: Transaction[], days: number, prev = false): DayPoint[] {
  const t0 = startOfDay(Date.now());
  const map = new Map<string, DayPoint>();
  for (const t of txs) {
    const k = dayKey(t.ts);
    const p = map.get(k) ?? { label: "", full: "", value: 0, count: 0, items: 0 };
    p.value += t.total; p.count++; p.items += t.items.reduce((a, i) => a + i.qty, 0);
    map.set(k, p);
  }
  const out: DayPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const ts = prev ? t0 - (days + i) * DAY_MS : t0 - i * DAY_MS;
    const d = new Date(ts);
    const p = map.get(dayKey(ts)) ?? { label: "", full: "", value: 0, count: 0, items: 0 };
    p.label = days <= 7 ? d.toLocaleDateString("id-ID", { weekday: "short" }) : `${d.getDate()}/${d.getMonth() + 1}`;
    p.full = dateID(ts);
    out.push(p);
  }
  return out;
}

export function sumStats(txs: Transaction[]) {
  const revenue = txs.reduce((a, t) => a + t.total, 0);
  const items = txs.reduce((a, t) => a + t.items.reduce((b, i) => b + i.qty, 0), 0);
  return { revenue, count: txs.length, items, avg: txs.length ? revenue / txs.length : 0 };
}

export function delta(cur: number, prev: number) {
  return prev <= 0 ? (cur > 0 ? 100 : 0) : ((cur - prev) / prev) * 100;
}

export function byCategory(txs: Transaction[]) {
  const m = new Map<Category, number>();
  for (const t of txs) for (const i of t.items) m.set(i.category, (m.get(i.category) ?? 0) + i.price * i.qty);
  return CATEGORIES.map((c) => ({ label: c, value: m.get(c) ?? 0, color: CATEGORY_COLORS[c] })).filter((d) => d.value > 0);
}

export function byMethod(txs: Transaction[]) {
  return METHODS.map((m) => {
    const list = txs.filter((t) => t.method === m);
    return { method: m as PayMethod, value: list.reduce((a, t) => a + t.total, 0), count: list.length, color: METHOD_COLORS[m] };
  });
}

export function byHour(txs: Transaction[]) {
  return HOURS.map((h) => {
    const list = txs.filter((t) => new Date(t.ts).getHours() === h);
    return { label: String(h), value: list.length, revenue: list.reduce((a, t) => a + t.total, 0) };
  });
}

export function heatMatrix(txs: Transaction[]) {
  const m = WEEKDAYS.map(() => HOURS.map(() => 0));
  for (const t of txs) {
    const d = new Date(t.ts);
    const row = (d.getDay() + 6) % 7;
    const col = HOURS.indexOf(d.getHours());
    if (col >= 0) m[row][col]++;
  }
  return m;
}

export function topProducts(txs: Transaction[], n = 6) {
  const m = new Map<string, { name: string; emoji: string; category: Category; qty: number; revenue: number }>();
  for (const t of txs) for (const i of t.items) {
    const p = m.get(i.productId) ?? { name: i.name, emoji: i.emoji, category: i.category, qty: 0, revenue: 0 };
    p.qty += i.qty; p.revenue += i.price * i.qty;
    m.set(i.productId, p);
  }
  return [...m.values()].sort((a, b) => b.revenue - a.revenue).slice(0, n);
}

export function soldMap(txs: Transaction[]) {
  const m = new Map<string, number>();
  for (const t of txs) if (t.status === "Selesai") for (const i of t.items) m.set(i.productId, (m.get(i.productId) ?? 0) + i.qty);
  return m;
}