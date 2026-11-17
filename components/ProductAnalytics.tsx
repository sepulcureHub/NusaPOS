"use client";

import { useMemo, useState } from "react";
import type { Product, Transaction } from "@/lib/types";
import { productPerf } from "@/lib/product-analytics";
import { compactRp, dateID, num, pctStr, rupiah, timeID } from "@/lib/format";
import { productMargin } from "@/lib/pricing";
import { AreaChart, Bars, Sparkline } from "./charts";
import { Badge, Button, EmptyState, Segmented } from "./ui";
import { IBox, IChart, IFlame, IPercent, IPlus, IReceipt, ISparkle, ITrendUp } from "./icons";

function Tile({ label, value, sub, color, icon, spark }: {
  label: string; value: string; sub?: string; color: string; icon: React.ReactNode; spark?: number[];
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-3.5">
      <div className="flex items-center gap-2">
        <span className="w-7 h-7 rounded-lg grid place-items-center shrink-0"
          style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}>{icon}</span>
        <span className="text-[11px] font-bold text-mute leading-tight">{label}</span>
      </div>
      <p className="font-display font-bold text-lg mt-2 tabular-nums truncate">{value}</p>
      <div className="flex items-end justify-between gap-2 mt-1">
        {sub ? <span className="text-[10px] text-faint">{sub}</span> : <span />}
        {spark && spark.length > 1 && <Sparkline data={spark} color={color} width={64} height={20} />}
      </div>
    </div>
  );
}

export function ProductAnalytics({ product, products, transactions, onRestock }: {
  product: Product;
  products: Product[];
  transactions: Transaction[];
  onRestock?: (amount: number) => void;
}) {
  const [days, setDays] = useState("30");
  const d = useMemo(
    () => productPerf(transactions, product, products, Number(days)),
    [transactions, product, products, days]
  );
  const margin = productMargin(product, products);
  const maxWeek = Math.max(1, ...d.weekday.map((w) => w.value));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-bold">Performa {product.name}</p>
          <p className="text-[11px] text-faint">
            {d.lastSold ? `Terakhir terjual ${dateID(d.lastSold)} • ${timeID(d.lastSold)}` : "Belum pernah terjual"}
          </p>
        </div>
        <Segmented value={days} onChange={setDays} options={[{ v: "7", l: "7h" }, { v: "30", l: "30h" }, { v: "90", l: "90h" }]} />
      </div>

      {d.units === 0 ? (
        <EmptyState emoji="📈" title="Belum ada penjualan di periode ini"
          desc="Grafik akan terisi otomatis begitu produk ini terjual di kasir, termasuk lewat paket bundling." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Tile label="Unit terjual" value={num(d.units)} sub={`${d.directUnits} langsung • ${d.bundleUnits} via paket`}
              color="var(--accent)" icon={<IBox size={15} />} spark={d.unitSeries} />
            <Tile label="Omzet langsung" value={compactRp(d.revenue)} sub={`${num(d.orders)} transaksi`}
              color="var(--laut)" icon={<IReceipt size={15} />} spark={d.series.map((s) => s.value)} />
            <Tile label="Laba kotor" value={compactRp(d.gross)} sub={`Margin ${margin.pct.toFixed(0)}% • ${rupiah(margin.value)}/unit`}
              color="var(--pandan)" icon={<ITrendUp size={15} />} />
            <Tile label="Rata-rata / hari" value={`${d.avgPerDay.toFixed(1)} unit`}
              sub={`${pctStr(d.deltaUnits)} vs periode lalu`} color="var(--amber)" icon={<IChart size={15} />} />
          </div>

          <div className="rounded-2xl border border-line bg-surface p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold">Tren omzet harian</p>
              <span className="text-[11px] text-faint">Total {rupiah(d.revenue)}</span>
            </div>
            <AreaChart key={`rev-${days}`} data={d.series} height={190} />
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="rounded-2xl border border-line bg-surface p-4">
              <p className="text-xs font-bold mb-3">Penjualan per hari</p>
              <div className="flex items-end gap-1.5 h-24">
                {d.weekday.map((w) => (
                  <div key={w.label} className="flex-1 flex flex-col items-center gap-1.5 group" title={`${w.label}: ${w.value} unit`}>
                    <span className="text-[9px] font-bold text-faint opacity-0 group-hover:opacity-100 transition-opacity">{w.value}</span>
                    <div className="w-full rounded-t-md bar-grow"
                      style={{
                        height: `${Math.max(3, (w.value / maxWeek) * 100)}%`,
                        background: d.bestDay?.label === w.label ? "var(--amber)" : "var(--accent)",
                        opacity: d.bestDay?.label === w.label ? 1 : 0.75,
                      }} />
                    <span className="text-[9px] text-faint font-bold">{w.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-line bg-surface p-4 space-y-2.5">
              <p className="text-xs font-bold">Insight otomatis</p>
              <p className="text-[11px] text-mute flex gap-2">
                <IFlame size={14} className="text-chili shrink-0 mt-0.5" />
                {d.bestDay ? `Paling laris hari ${d.bestDay.label} (${d.bestDay.value} unit).` : "Pola hari belum terbaca."}
                {d.bestHour && ` Jam puncak ${d.bestHour.label}.00.`}
              </p>
              <p className="text-[11px] text-mute flex gap-2">
                <IPercent size={14} className="text-amber shrink-0 mt-0.5" />
                Diskon produk memberi potongan {rupiah(d.discountGiven)} di periode ini.
              </p>
              <p className="text-[11px] text-mute flex gap-2">
                <ISparkle size={14} className="text-magenta shrink-0 mt-0.5" />
                {d.bundleUnits > 0 ? `${d.bundleUnits} unit terjual lewat paket bundling.` : "Belum terjual lewat paket — coba buat bundling."}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-line bg-surface p-4">
            <p className="text-xs font-bold mb-2">Jam sibuk produk ini</p>
            <Bars key={`hr-${days}`} data={d.hours} height={170} color="var(--laut)" />
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="rounded-2xl border border-line bg-surface p-4">
              <p className="text-xs font-bold mb-2">Stok & proyeksi</p>
              <div className="flex items-baseline gap-2">
                <span className="font-display font-bold text-2xl">{num(d.stock)}</span>
                <span className="text-[11px] text-faint">unit tersedia</span>
              </div>
              <p className="text-[11px] text-mute mt-1">
                {d.daysOfCover !== null
                  ? `Cukup untuk ± ${d.daysOfCover.toFixed(1)} hari pada laju penjualan sekarang.`
                  : "Laju penjualan belum cukup untuk proyeksi."}
              </p>
              {d.suggestedRestock > 0 && onRestock && (
                <Button size="sm" variant="soft" className="mt-3" onClick={() => onRestock(d.suggestedRestock)}>
                  <IPlus size={13} /> Restok {d.suggestedRestock} unit (14 hari)
                </Button>
              )}
            </div>

            <div className="rounded-2xl border border-line bg-surface p-4">
              <p className="text-xs font-bold mb-2">Kontribusi paket</p>
              {d.bundles.length ? (
                <ul className="space-y-1.5">
                  {d.bundles.map((b) => (
                    <li key={b.name} className="flex items-center gap-2 text-[11px]">
                      <Badge color="var(--violet)">Paket</Badge>
                      <span className="font-bold flex-1 truncate">{b.name}</span>
                      <span className="font-mono text-mute">{b.units} unit</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-[11px] text-faint">Produk ini belum masuk paket mana pun yang terjual.</p>}
            </div>
          </div>

          <div className="rounded-2xl border border-line bg-surface p-4">
            <p className="text-xs font-bold mb-2">Transaksi terakhir</p>
            <ul className="divide-y divide-line">
              {d.recent.map((r) => (
                <li key={r.id + r.ts} className="flex items-center gap-2 py-2 text-[11px]">
                  <span className="font-mono font-bold flex-1 truncate">{r.id}</span>
                  <span className="text-faint">{dateID(r.ts)} {timeID(r.ts)}</span>
                  <Badge color="var(--laut)">{r.method}</Badge>
                  <span className="font-mono text-mute w-10 text-right">×{r.qty}</span>
                  <span className="font-mono font-bold w-20 text-right">{rupiah(r.total)}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}