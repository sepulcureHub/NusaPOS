"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { useToast } from "@/components/Toasts";
import {
  byCategory, byHour, byMethod, dailySeries, delta, heatMatrix, sumStats, topProducts, windowTx,
} from "@/lib/analytics";
import { compactRp, download, num, rupiah, toCSV } from "@/lib/format";
import { Button, PageSkel, Segmented, StatCard, Toggle } from "@/components/ui";
import { AreaChart, Bars, Donut, HBarList, Heatmap, PaymentSplit } from "@/components/charts";
import { IBox, ICash, IDownload, IFlame, IReceipt, ISparkle, ITag, ITrendUp } from "@/components/icons";

export default function Analitik() {
  const { state } = useStore();
  const { push } = useToast();
  const [period, setPeriod] = useState("30");
  const [compare, setCompare] = useState(true);
  const days = Number(period);

  const d = useMemo(() => {
    if (!state.hydrated) return null;
    const cur = windowTx(state.transactions, days);
    const prev = windowTx(state.transactions, days, true);
    const series = dailySeries(cur, days);
    const cmp = dailySeries(prev, days);
    const s = sumStats(cur), sp = sumStats(prev);
    const cats = byCategory(cur);
    const hours = byHour(cur);
    const busiest = [...hours].sort((a, b) => b.value - a.value)[0];
    const topCat = [...cats].sort((a, b) => b.value - a.value)[0];
    const catTotal = cats.reduce((a, c) => a + c.value, 0);
    return {
      series, cmp, s, sp, cats, hours,
      methods: byMethod(cur), heat: heatMatrix(cur), top: topProducts(cur, 7),
      busiest, topCat, catShare: topCat && catTotal > 0 ? (topCat.value / catTotal) * 100 : 0,
      growth: delta(s.revenue, sp.revenue),
    };
  }, [state, days]);

  if (!state.hydrated || !d) return <PageSkel />;

  const exportReport = () => {
    const rows: (string | number)[][] = [["Tanggal", "Transaksi", "Item", "Pendapatan"]];
    d.series.forEach((p) => rows.push([p.full, p.count, p.items, p.value]));
    rows.push(["TOTAL", d.s.count, d.s.items, d.s.revenue]);
    download(`nusapos-laporan-${days}hari.csv`, toCSV(rows), "text/csv");
    push({ msg: `Laporan ${days} hari diekspor`, type: "ok" });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rise">
        <div>
          <h1 className="font-display font-bold text-2xl">Analitik</h1>
          <p className="text-sm text-mute mt-0.5">Performa penjualan {days} hari terakhir, live dari data transaksi.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Segmented value={period} onChange={setPeriod} options={[{ v: "7", l: "7 hari" }, { v: "30", l: "30 hari" }, { v: "90", l: "90 hari" }]} />
          <label className="flex items-center gap-2 text-xs font-bold text-mute cursor-pointer">
            <Toggle small checked={compare} onChange={setCompare} label="Bandingkan" /> Bandingkan
          </label>
          <Button variant="ghost" size="sm" onClick={exportReport}><IDownload size={14} /> Laporan CSV</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label={`Pendapatan ${days}h`} value={d.s.revenue} fmt={rupiah} delta={d.growth} deltaLabel="vs periode lalu" spark={d.series.map((p) => p.value)} color="var(--accent)" icon={<ICash size={17} />} />
        <StatCard label="Transaksi" value={d.s.count} fmt={num} delta={delta(d.s.count, d.sp.count)} deltaLabel="vs periode lalu" spark={d.series.map((p) => p.count)} color="var(--laut)" icon={<IReceipt size={17} />} delay={60} />
        <StatCard label="Item Terjual" value={d.s.items} fmt={num} delta={delta(d.s.items, d.sp.items)} deltaLabel="vs periode lalu" spark={d.series.map((p) => p.items)} color="var(--amber)" icon={<IBox size={17} />} delay={120} />
        <StatCard label="Rata-rata Keranjang" value={d.s.avg} fmt={rupiah} delta={delta(d.s.avg, d.sp.avg)} deltaLabel="vs periode lalu" spark={d.series.map((p) => (p.count ? p.value / p.count : 0))} color="var(--magenta)" icon={<ITrendUp size={17} />} delay={180} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="card p-5 lg:col-span-2 rise" style={{ animationDelay: "100ms" }}>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h2 className="font-display font-bold">Tren Pendapatan</h2>
            <div className="flex items-center gap-3 text-[11px] font-bold text-mute">
              <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-accent" /> Periode ini</span>
              {compare && <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-violet" /> Sebelumnya</span>}
            </div>
          </div>
          <AreaChart key={`${period}-${compare}`} data={d.series} compare={compare ? d.cmp : undefined} height={280} />
        </div>

        <div className="card p-5 rise" style={{ animationDelay: "160ms" }}>
          <h2 className="font-display font-bold mb-4">Pangsa Kategori</h2>
          <Donut key={period} data={d.cats} size={180} thick={24} centerTitle={`Omzet ${days}h`} />
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="card p-5 lg:col-span-2 rise" style={{ animationDelay: "120ms" }}>
          <h2 className="font-display font-bold mb-1">Jam Sibuk</h2>
          <p className="text-xs text-mute mb-4">Jumlah transaksi per jam operasional (07.00–22.00)</p>
          <Bars key={period} data={d.hours} height={230} />
        </div>
        <div className="card p-5 rise" style={{ animationDelay: "180ms" }}>
          <h2 className="font-display font-bold mb-4">Metode Pembayaran</h2>
          <PaymentSplit data={d.methods} />
        </div>
      </div>

      <div className="card p-5 rise" style={{ animationDelay: "140ms" }}>
        <h2 className="font-display font-bold mb-1">Peta Keramaian</h2>
        <p className="text-xs text-mute mb-4">Hari × jam — makin terang, makin ramai. Arahkan kursor ke sel untuk detail.</p>
        <Heatmap matrix={d.heat} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="card p-5 lg:col-span-2 rise" style={{ animationDelay: "160ms" }}>
          <h2 className="font-display font-bold mb-4">Produk Terlaris <span className="text-xs text-faint font-sans font-medium">• berdasarkan omzet</span></h2>
          <HBarList items={d.top} />
        </div>
        <div className="space-y-4">
          {[
            { icon: <IFlame size={17} />, color: "var(--chili)", title: "Jam Tersibuk", text: d.busiest && d.busiest.value > 0 ? `${d.busiest.label}.00–${Number(d.busiest.label) + 1}.00 dengan ${d.busiest.value} transaksi (${compactRp(d.busiest.revenue)}). Jadwalkan staf ekstra di jam ini.` : "Belum cukup data transaksi." },
            { icon: <ITag size={17} />, color: "var(--amber)", title: "Kategori Andalan", text: d.topCat ? `${d.topCat.label} menyumbang ${d.catShare.toFixed(0)}% pendapatan (${compactRp(d.topCat.value)}). Pertimbangkan bundle di kategori ini.` : "Belum ada penjualan kategori." },
            { icon: <ISparkle size={17} />, color: "var(--accent)", title: "Pertumbuhan", text: `Omzet ${d.growth >= 0 ? "naik" : "turun"} ${Math.abs(d.growth).toFixed(1)}% dibanding ${days} hari sebelumnya (${compactRp(d.sp.revenue)} → ${compactRp(d.s.revenue)}).` },
          ].map((c, i) => (
            <div key={c.title} className="card p-4 flex gap-3 rise" style={{ animationDelay: `${200 + i * 60}ms` }}>
              <span className="w-9 h-9 rounded-xl grid place-items-center shrink-0" style={{ color: c.color, background: `color-mix(in srgb, ${c.color} 14%, transparent)` }}>{c.icon}</span>
              <div>
                <p className="text-sm font-bold">{c.title}</p>
                <p className="text-xs text-mute mt-1 leading-relaxed">{c.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}