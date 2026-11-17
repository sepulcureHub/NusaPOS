"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { useToast } from "@/components/Toasts";
import { sfx } from "@/lib/sound";
import { dailySeries, sumStats, delta, byCategory, windowTx, topProducts } from "@/lib/analytics";
import { dateFull, rupiah, num, relTime, timeID, startOfDay } from "@/lib/format";
import { Badge, Button, EmptyState, PageSkel, StatCard } from "@/components/ui";
import { AreaChart, Donut, HBarList } from "@/components/charts";
import { ProductThumb } from "@/components/ProductThumb";
import {
  IArrowRight, IBox, ICalendar, ICard, IChart, ICash, ICheckCircle,
  IPause, IPlus, IQR, IReceipt, IRegister, ITrendUp,
} from "@/components/icons";
import { METHOD_COLORS } from "@/lib/types";

const methodIcon = (m: string) =>
  m === "Tunai" ? <ICash size={15} /> : m === "QRIS" ? <IQR size={15} /> : <ICard size={15} />;

export default function Dashboard() {
  const { state, dispatch } = useStore();
  const { push } = useToast();
  const router = useRouter();

  const data = useMemo(() => {
    if (!state.hydrated) return null;
    const txs = state.transactions;
    const t0 = startOfDay(Date.now());
    const today = txs.filter((t) => t.ts >= t0 && t.status === "Selesai");
    const yesterday = txs.filter((t) => t.ts >= t0 - 86400000 && t.ts < t0 && t.status === "Selesai");
    const sToday = sumStats(today), sYest = sumStats(yesterday);
    const spark = dailySeries(windowTx(txs, 7), 7);
    const series14 = dailySeries(windowTx(txs, 14), 14);
    const cats = byCategory(windowTx(txs, 30));
    const top = topProducts(windowTx(txs, 30), 4);
    const recent = [...txs].sort((a, b) => b.ts - a.ts).slice(0, 6);
    /* Paket bundling tidak punya stok sendiri —Availability-nya mengikuti isi paket,
       jadi dikecualikan dari alert stok menipis. */
    const low = state.products
      .filter((p) => p.active && p.kind === "single" && p.stock <= state.settings.lowStock)
      .sort((a, b) => a.stock - b.stock)
      .slice(0, 5);
    return { sToday, sYest, spark, series14, cats, top, recent, low };
  }, [state]);

  if (!state.hydrated || !data) return <PageSkel />;

  const h = new Date().getHours();
  const greet = h < 11 ? "Selamat pagi" : h < 15 ? "Selamat siang" : h < 18 ? "Selamat sore" : "Selamat malam";
  const { sToday, sYest, spark, series14, cats, top, recent, low } = data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 rise">
        <div>
          <h1 className="font-display font-bold text-2xl md:text-3xl">
            {greet}, <span className="text-grad">{state.settings.cashier}</span> 👋
          </h1>
          <p className="text-sm text-mute mt-1">
            Ringkasan <b className="text-ink">{state.settings.storeName}</b> hari ini.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-flex items-center gap-2 text-xs text-mute border border-line rounded-xl px-3 py-2 bg-surface">
            <ICalendar size={14} className="text-accent" /> {dateFull(Date.now())}
          </span>
          <Button onClick={() => router.push("/kasir")}><IRegister size={17} /> Buka Kasir</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Pendapatan Hari Ini" value={sToday.revenue} fmt={rupiah}
          delta={delta(sToday.revenue, sYest.revenue)} spark={spark.map((d) => d.value)}
          color="var(--accent)" icon={<ICash size={17} />} delay={0} />
        <StatCard label="Transaksi Hari Ini" value={sToday.count} fmt={num}
          delta={delta(sToday.count, sYest.count)} spark={spark.map((d) => d.count)}
          color="var(--laut)" icon={<IReceipt size={17} />} delay={60} />
        <StatCard label="Produk Terjual" value={sToday.items} fmt={num}
          delta={delta(sToday.items, sYest.items)} spark={spark.map((d) => d.items)}
          color="var(--amber)" icon={<IBox size={17} />} delay={120} />
        <StatCard label="Rata-rata / Transaksi" value={sToday.avg} fmt={rupiah}
          delta={delta(sToday.avg, sYest.avg)} spark={spark.map((d) => (d.count ? d.value / d.count : 0))}
          color="var(--magenta)" icon={<ITrendUp size={17} />} delay={180} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="card p-5 lg:col-span-2 rise" style={{ animationDelay: "120ms" }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display font-bold">Pendapatan 14 Hari</h2>
              <p className="text-xs text-mute mt-0.5">
                Total <b className="text-accent">{rupiah(series14.reduce((a, d) => a + d.value, 0))}</b>
              </p>
            </div>
            <Link href="/analitik" className="text-xs font-bold text-accent hover:underline inline-flex items-center gap-1">
              Analitik lengkap <IArrowRight size={13} />
            </Link>
          </div>
          <AreaChart data={series14} height={250} />
        </div>

        <div className="card p-5 rise" style={{ animationDelay: "180ms" }}>
          <h2 className="font-display font-bold mb-4">
            Kategori Terlaris <span className="text-xs text-faint font-sans font-medium">• 30 hari</span>
          </h2>
          <Donut data={cats} size={170} thick={22} centerTitle="Omzet 30h" />
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="card p-5 lg:col-span-2 rise" style={{ animationDelay: "220ms" }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-bold">Transaksi Terbaru</h2>
            <Link href="/transaksi" className="text-xs font-bold text-accent hover:underline inline-flex items-center gap-1">
              Semua <IArrowRight size={13} />
            </Link>
          </div>
          <ul className="divide-y divide-line">
            {recent.map((t) => (
              <li key={t.id}>
                <button
                  onClick={() => router.push(`/transaksi?open=${t.id}`)}
                  className="w-full flex items-center gap-3 py-3 px-2 -mx-2 rounded-xl hover:bg-surface2 text-left transition-colors"
                >
                  <span
                    className="w-9 h-9 rounded-xl grid place-items-center shrink-0"
                    style={{
                      color: METHOD_COLORS[t.method],
                      background: `color-mix(in srgb, ${METHOD_COLORS[t.method]} 14%, transparent)`,
                    }}
                  >
                    {methodIcon(t.method)}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-xs font-mono font-bold truncate">{t.id}</span>
                    <span className="block text-[11px] text-faint truncate">
                      {t.customerName} • {relTime(t.ts)} • {timeID(t.ts)}
                    </span>
                  </span>
                  {t.status === "Refund" && <Badge color="var(--chili)">Refund</Badge>}
                  <span className="font-mono font-bold text-sm">{rupiah(t.total)}</span>
                </button>
              </li>
            ))}
          </ul>
          {recent.length === 0 && (
            <EmptyState emoji="🧾" title="Belum ada transaksi" desc="Mulai jualan dari menu Kasir." />
          )}
        </div>

        <div className="space-y-6">
          <div className="card p-5 rise" style={{ animationDelay: "260ms" }}>
            <h2 className="font-display font-bold mb-3">Stok Menipis</h2>
            {low.length > 0 ? (
              <ul className="space-y-2.5">
                {low.map((p) => (
                  <li key={p.id} className="flex items-center gap-2.5">
                    <ProductThumb name={p.name} photo={p.photo} category={p.category} size={30} rounded={9} />
                    <span className="text-xs font-bold flex-1 truncate">{p.name}</span>
                    <Badge color={p.stock === 0 ? "var(--chili)" : "var(--amber)"}>
                      {p.stock === 0 ? "Habis" : `Sisa ${p.stock}`}
                    </Badge>
                    <Button
                      size="sm"
                      variant="soft"
                      onClick={() => {
                        dispatch({ type: "ADJUST_STOCK", id: p.id, delta: 10 });
                        sfx.tap();
                        push({ msg: `Stok ${p.name} +10`, type: "ok" });
                      }}
                    >
                      <IPlus size={12} /> 10
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-pandan inline-flex items-center gap-2 py-2">
                <ICheckCircle size={16} /> Semua stok aman
              </p>
            )}
            <Link href="/produk" className="mt-3 text-xs font-bold text-accent hover:underline inline-flex items-center gap-1">
              Kelola stok <IArrowRight size={13} />
            </Link>
          </div>

          <div className="card p-5 rise" style={{ animationDelay: "300ms" }}>
            <h2 className="font-display font-bold mb-3">Aksi Cepat</h2>
            <div className="space-y-2">
              <Button variant="ghost" className="w-full justify-start" onClick={() => router.push("/produk?new=1")}>
                <IPlus size={16} /> Tambah Produk
              </Button>
              <Button variant="ghost" className="w-full justify-start" onClick={() => router.push("/produk?new=bundle")}>
                <IBox size={16} /> Buat Paket Bundling
              </Button>
              <Button variant="ghost" className="w-full justify-start" onClick={() => router.push("/analitik")}>
                <IChart size={16} /> Laporan Lengkap
              </Button>
              <Button variant="ghost" className="w-full justify-start" onClick={() => router.push("/kasir?held=1")}>
                <IPause size={16} /> Order Ditahan
                <span className="ml-auto"><Badge color="var(--amber)">{state.held.length}</Badge></span>
              </Button>
            </div>
          </div>

          <div className="card p-5 rise" style={{ animationDelay: "340ms" }}>
            <h2 className="font-display font-bold mb-3">
              Produk Andalan <span className="text-xs text-faint font-sans font-medium">• 30h</span>
            </h2>
            <HBarList items={top} />
          </div>
        </div>
      </div>
    </div>
  );
}