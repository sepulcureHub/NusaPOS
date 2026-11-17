import type { Product, Transaction } from "./types";
import type { DayPoint } from "./analytics";
import { HOURS, WEEKDAYS } from "./analytics";
import { dateID, dayKey, startOfDay } from "./format";
import { productCost, stockOf } from "./pricing";

const DAY_MS = 86400000;

export interface ProductPerf {
  units: number;
  directUnits: number;
  bundleUnits: number;
  revenue: number;
  gross: number;
  orders: number;
  avgPerDay: number;
  discountGiven: number;
  lastSold: number | null;
  prevUnits: number;
  deltaUnits: number;
  series: DayPoint[];
  unitSeries: number[];
  hours: { label: string; value: number; revenue: number }[];
  weekday: { label: string; value: number }[];
  bestDay: { label: string; value: number } | null;
  bestHour: { label: string; value: number } | null;
  bundles: { name: string; units: number }[];
  recent: { id: string; ts: number; qty: number; total: number; method: string }[];
  stock: number;
  daysOfCover: number | null;
  suggestedRestock: number;
}

function window(txs: Transaction[], days: number, prev = false) {
  const t0 = startOfDay(Date.now());
  const start = prev ? t0 - (2 * days - 1) * DAY_MS : t0 - (days - 1) * DAY_MS;
  const end = prev ? t0 - (days - 1) * DAY_MS : Date.now() + 1;
  return txs.filter((t) => t.status === "Selesai" && t.ts >= start && t.ts < end);
}

export function productPerf(txs: Transaction[], product: Product, all: Product[], days: number): ProductPerf {
  const cur = window(txs, days);
  const prev = window(txs, days, true);
  const id = product.id;
  const t0 = startOfDay(Date.now());

  const buckets = new Map<string, { revenue: number; units: number; count: number }>();
  const hours = HOURS.map((h) => ({ label: String(h), value: 0, revenue: 0 }));
  const weekday = WEEKDAYS.map((w) => ({ label: w, value: 0 }));
  const bundles = new Map<string, number>();
  const recent: ProductPerf["recent"] = [];

  let directUnits = 0, bundleUnits = 0, revenue = 0, orders = 0, discountGiven = 0, lastSold: number | null = null;

  const countPrev = () => {
    let u = 0;
    for (const t of prev) for (const i of t.items) {
      if (i.productId === id) u += i.qty;
      else i.components?.forEach((c) => { if (c.productId === id) u += c.qty * i.qty; });
    }
    return u;
  };

  for (const t of cur) {
    for (const i of t.items) {
      const isDirect = i.productId === id;
      const comp = i.components?.find((c) => c.productId === id);
      if (!isDirect && !comp) continue;

      const k = dayKey(t.ts);
      const b = buckets.get(k) ?? { revenue: 0, units: 0, count: 0 };
      const d = new Date(t.ts);
      const row = (d.getDay() + 6) % 7;
      const hi = HOURS.indexOf(d.getHours());

      if (isDirect) {
        directUnits += i.qty;
        revenue += i.price * i.qty;
        discountGiven += Math.max(0, ((i.basePrice ?? i.price) - i.price) * i.qty);
        orders++;
        b.revenue += i.price * i.qty;
        b.units += i.qty;
        b.count++;
        weekday[row].value += i.qty;
        if (hi >= 0) { hours[hi].value += i.qty; hours[hi].revenue += i.price * i.qty; }
        recent.push({ id: t.id, ts: t.ts, qty: i.qty, total: i.price * i.qty, method: t.method });
      } else if (comp) {
        const u = comp.qty * i.qty;
        bundleUnits += u;
        b.units += u;
        weekday[row].value += u;
        if (hi >= 0) hours[hi].value += u;
        bundles.set(i.name, (bundles.get(i.name) ?? 0) + u);
      }
      buckets.set(k, b);
      lastSold = lastSold === null ? t.ts : Math.max(lastSold, t.ts);
    }
  }

  const series: DayPoint[] = [];
  const unitSeries: number[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const ts = t0 - i * DAY_MS;
    const d = new Date(ts);
    const b = buckets.get(dayKey(ts)) ?? { revenue: 0, units: 0, count: 0 };
    series.push({
      label: days <= 7 ? d.toLocaleDateString("id-ID", { weekday: "short" }) : `${d.getDate()}/${d.getMonth() + 1}`,
      full: dateID(ts), value: b.revenue, count: b.count, items: b.units,
    });
    unitSeries.push(b.units);
  }

  const units = directUnits + bundleUnits;
  const avgPerDay = units / days;
  const cost = productCost(product, all);
  const stock = stockOf(product, all);
  const prevUnits = countPrev();
  const bestDay = [...weekday].sort((a, b) => b.value - a.value)[0] ?? null;
  const bestHour = [...hours].sort((a, b) => b.value - a.value)[0] ?? null;

  return {
    units, directUnits, bundleUnits, revenue,
    gross: revenue - cost * directUnits,
    orders, avgPerDay, discountGiven, lastSold, prevUnits,
    deltaUnits: prevUnits <= 0 ? (units > 0 ? 100 : 0) : ((units - prevUnits) / prevUnits) * 100,
    series, unitSeries, hours, weekday,
    bestDay: bestDay && bestDay.value > 0 ? bestDay : null,
    bestHour: bestHour && bestHour.value > 0 ? bestHour : null,
    bundles: [...bundles.entries()].map(([name, u]) => ({ name, units: u })).sort((a, b) => b.units - a.units).slice(0, 4),
    recent: recent.sort((a, b) => b.ts - a.ts).slice(0, 6),
    stock,
    daysOfCover: avgPerDay > 0.05 ? stock / avgPerDay : null,
    suggestedRestock: Math.max(0, Math.ceil(avgPerDay * 14) - stock),
  };
}