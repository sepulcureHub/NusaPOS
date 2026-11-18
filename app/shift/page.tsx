"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth, useStore } from "@/lib/store";
import { useToast } from "@/components/Toasts";
import { sfx } from "@/lib/sound";
import type { ShiftPlan, ShiftSession, User } from "@/lib/types";
import { STORE_CLOSE, STORE_OPEN } from "@/lib/demo-data";
import { dateID, download, num, rupiah, timeID, toCSV } from "@/lib/format";
import { shiftEligible } from "@/lib/auth";
import {
  DAY_NAMES, DAY_ORDER, cashInSession, cashierReport, computeAutoClose, countdown, coverageByDay,
  fmtDuration, newShiftId, openSessionOf, overlaps, sessionMinutes, spanMinutes, toMinutes, weekMinutes,
} from "@/lib/shift";
import type { CashierReport } from "@/lib/shift";
import { AreaChart, Bars, HBarList, PaymentSplit } from "@/components/charts";
import { Badge, Button, Confirm, EmptyState, Field, IconBtn, Input, Modal, PageSkel, Segmented, Select, Textarea, Toggle } from "@/components/ui";
import {
  IAlert, ICalendar, IChart, ICheck, ICheckCircle, IClock, IDownload, IHeart, IInfo, IPen,
  IPlay, IPlus, IRefresh, IShield, IStar, IStop, IUsers, IX,
} from "@/components/icons";

type Tab = "jadwal" | "performa" | "shift";

const PRESETS = [
  { label: "Pagi", start: "07:00", end: "15:00" },
  { label: "Sore", start: "15:00", end: "22:00" },
  { label: "Siang", start: "11:00", end: "19:00" },
  { label: "Full", start: "07:00", end: "22:00" },
];

export default function ShiftPage() {
  return (
    <Suspense fallback={<PageSkel />}>
      <Shift />
    </Suspense>
  );
}

function Shift() {
  const { state, dispatch } = useStore();
  const { user, can, isAdmin } = useAuth();
  const { push } = useToast();
  const router = useRouter();
  const sp = useSearchParams();

  const [tab, setTab] = useState<Tab>(isAdmin ? "jadwal" : "shift");
  const [range, setRange] = useState("30");
  const [targetId, setTargetId] = useState("");
  const [editor, setEditor] = useState<{ open: boolean; plan: ShiftPlan | null; day: number; userId: string }>({ open: false, plan: null, day: 1, userId: "" });
  const [delPlan, setDelPlan] = useState<ShiftPlan | null>(null);
  const [openFor, setOpenFor] = useState<User | null>(null);
  const [closeFor, setCloseFor] = useState<ShiftSession | null>(null);
  const [reconcileFor, setReconcileFor] = useState<ShiftSession | null>(null);
  const [, force] = useState(0);

  useEffect(() => {
    const t = sp.get("tab");
    if (t === "shift" || t === "performa" || t === "jadwal") setTab(isAdmin ? t : t === "jadwal" ? "shift" : t);
  }, [sp, isAdmin]);

  useEffect(() => {
    const t = setInterval(() => force((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const staff = useMemo(() => state.users.filter((u) => shiftEligible(u) && u.active), [state.users]);

  useEffect(() => {
    if (!state.hydrated) return;
    if (!targetId || !staff.some((u) => u.id === targetId)) {
      setTargetId(isAdmin ? (staff[0]?.id ?? "") : (user?.id ?? ""));
    }
  }, [state.hydrated, staff, targetId, isAdmin, user]);

  const report: CashierReport | null = useMemo(() => {
    if (!state.hydrated) return null;
    const target = state.users.find((u) => u.id === (isAdmin ? targetId : user?.id));
    if (!target || !shiftEligible(target)) return null;
    const days = Number(range);
    const since = Date.now() - days * 86400000;
    const newMembers = state.customers.filter((c) => c.member && c.createdBy === target.id && (c.joinedAt ?? 0) >= since).length;
    return cashierReport(target, state.transactions, state.shiftSessions, state.shiftPlans, days, newMembers);
  }, [state.hydrated, state.users, state.customers, state.transactions, state.shiftSessions, state.shiftPlans, targetId, user, isAdmin, range]);

  if (!state.hydrated || !user) return <PageSkel />;

  const manage = can("shift.manage");
  const iAmKasir = shiftEligible(user);
  const myOpen = iAmKasir ? openSessionOf(state.shiftSessions, user.id) : null;
  const coverage = coverageByDay(state.shiftPlans, toMinutes(STORE_OPEN), toMinutes(STORE_CLOSE));
  const myPlans = state.shiftPlans.filter((p) => p.userId === user.id && p.active);
  const todayPlan = myPlans.filter((p) => p.day === new Date().getDay());

  const removePlan = (p: ShiftPlan) => {
    dispatch({ type: "DELETE_SHIFTS", ids: [p.id] });
    sfx.remove();
    push({ msg: "Shift dihapus dari jadwal", type: "info", actionLabel: "Urungkan", onAction: () => dispatch({ type: "RESTORE_SHIFTS", plans: [p] }) });
  };

  const copyDay = (fromDay: number) => {
    const src = state.shiftPlans.filter((p) => p.day === fromDay);
    if (!src.length) { push({ msg: "Tidak ada shift untuk disalin", type: "err" }); sfx.error(); return; }
    const created: ShiftPlan[] = [];
    DAY_ORDER.filter((d) => d !== fromDay).forEach((d) => {
      src.forEach((p) => {
        const clash = state.shiftPlans.some((x) => x.day === d && x.userId === p.userId && overlaps(x.start, x.end, p.start, p.end));
        if (!clash) created.push({ ...p, id: newShiftId(), day: d });
      });
    });
    if (!created.length) { push({ msg: "Semua hari sudah punya shift serupa", type: "info" }); return; }
    dispatch({ type: "RESTORE_SHIFTS", plans: created });
    sfx.success();
    push({ msg: `${created.length} shift disalin`, type: "ok", actionLabel: "Urungkan", onAction: () => dispatch({ type: "DELETE_SHIFTS", ids: created.map((c) => c.id) }) });
  };

  const exportPerf = () => {
    if (!report) return;
    const rows: (string | number)[][] = [["Tanggal", "Kasir", "Transaksi", "Item", "Omzet", "Rata-rata", "Jam kerja", "Trx/jam", "Refund", "Diskon", "Tunai", "Selisih kas", "Telat (menit)", "Trx member", "Poin diterbitkan"]];
    report.days.forEach((d) => rows.push([
      d.full, report.user.name, d.tx, d.items, d.revenue, Math.round(d.avg),
      (d.minutes / 60).toFixed(2), d.perHour ? d.perHour.toFixed(2) : "-", d.refund, d.discount, d.cash, d.variance, d.late, d.members, d.points,
    ]));
    download(`nusapos-performa-${report.user.username}-${range}hari.csv`, toCSV(rows), "text/csv");
    push({ msg: "Laporan performa diunduh", type: "ok" });
  };

  const tabs: { v: Tab; l: string; icon: React.ReactNode; show: boolean }[] = [
    { v: "jadwal", l: "Jadwal kasir", icon: <ICalendar size={14} />, show: manage },
    { v: "performa", l: isAdmin ? "Performa kasir" : "Performa saya", icon: <IChart size={14} />, show: iAmKasir || manage },
    { v: "shift", l: isAdmin ? "Buka / tutup shift" : "Shift saya", icon: <IClock size={14} />, show: true },
  ];

  const activeSessions = state.shiftSessions.filter((s) => s.closedAt === null);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3 rise">
        <div>
          <h1 className="font-display font-bold text-2xl flex items-center gap-2">
            Shift Kasir
            <Badge color={isAdmin ? "var(--accent)" : "var(--amber)"}>
              {isAdmin ? <IShield size={10} /> : <IUsers size={10} />} {isAdmin ? "Penjadwalan & kontrol penuh" : "Shift saya"}
            </Badge>
          </h1>
          <p className="text-sm text-mute mt-0.5">
            Shift hanya untuk akun kasir terdaftar. Admin menjadwalkan, membuka, dan menutup shift kasir — tutup otomatis mengikuti jam jadwal.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented value={range} onChange={setRange} options={[{ v: "7", l: "7 hari" }, { v: "30", l: "30 hari" }, { v: "90", l: "90 hari" }]} />
          {tab === "performa" && report && <Button variant="ghost" size="sm" onClick={exportPerf}><IDownload size={14} /> CSV</Button>}
          {manage && tab === "jadwal" && (
            <Button size="sm" disabled={!staff.length} onClick={() => setEditor({ open: true, plan: null, day: new Date().getDay(), userId: staff[0]?.id ?? "" })}>
              <IPlus size={15} /> Tambah Shift
            </Button>
          )}
        </div>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1 rise" style={{ animationDelay: "50ms" }}>
        {tabs.filter((t) => t.show).map((t) => (
          <button key={t.v} onClick={() => { setTab(t.v); sfx.tap(); router.replace(`/shift?tab=${t.v}`); }}
            className="chip shrink-0"
            style={tab === t.v ? { background: "var(--accent)", color: "var(--accent-ink)", borderColor: "transparent" } : undefined}>
            {t.icon} {t.l}
          </button>
        ))}
      </div>

      {/* JADWAL */}
      {tab === "jadwal" && manage && (
        <div className="space-y-4">
          {staff.length === 0 ? (
            <div className="card"><EmptyState emoji="🧑‍💼" title="Belum ada akun kasir aktif" desc="Tambahkan akun kasir di Pengaturan → Pengguna & Akses untuk mulai menjadwalkan shift." /></div>
          ) : (
            <>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {staff.map((u, i) => {
                  const mins = weekMinutes(state.shiftPlans, u.id);
                  const count = state.shiftPlans.filter((p) => p.userId === u.id && p.active).length;
                  const open = openSessionOf(state.shiftSessions, u.id);
                  return (
                    <div key={u.id} className="card p-4 rise" style={{ animationDelay: `${i * 50}ms` }}>
                      <div className="flex items-center gap-2.5">
                        <span className="w-9 h-9 rounded-xl grid place-items-center text-[11px] font-bold shrink-0 grad-accent text-accent-ink">
                          {u.name.split(" ").slice(0, 2).map((w: string) => w[0]).join("").toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-bold truncate">{u.name}</p>
                          <p className="text-[10px] text-faint">@{u.username}</p>
                        </div>
                        {open && <span className="ml-auto"><Badge color="var(--pandan)">on shift</Badge></span>}
                      </div>
                      <p className="font-display font-bold text-2xl mt-3">{fmtDuration(mins)}</p>
                      <p className="text-[11px] text-faint">{count} shift aktif / minggu</p>
                      <div className="flex gap-1.5 mt-3">
                        <Button size="sm" variant={open ? "danger" : "soft"} className="flex-1"
                          onClick={() => { if (open) setCloseFor(open); else setOpenFor(u); }}>
                          {open ? <><IStop size={12} /> Tutup</> : <><IPlay size={12} /> Buka</>}
                        </Button>
                        <IconBtn label="Tambah shift" className="!p-1.5" onClick={() => setEditor({ open: true, plan: null, day: new Date().getDay(), userId: u.id })}><IPlus size={14} /></IconBtn>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="card p-4 rise" style={{ animationDelay: "120ms" }}>
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <p className="text-sm font-bold">Cakupan jam operasional</p>
                  <span className="text-[11px] text-faint">Target {STORE_OPEN}–{STORE_CLOSE} · hanya kasir</span>
                  <span className="ml-auto text-[11px] text-faint">Klik + untuk menambah shift · ikon salin untuk duplikasi hari</span>
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {coverage.map((c) => {
                    const pct = Math.min(100, (c.covered / c.target) * 100);
                    const ok = c.gaps.length === 0;
                    return (
                      <div key={c.day} className="rounded-xl border p-2.5"
                        style={{ borderColor: ok ? "color-mix(in srgb, var(--pandan) 35%, transparent)" : "color-mix(in srgb, var(--amber) 40%, transparent)", background: "var(--surface)" }}>
                        <p className="text-[11px] font-bold">{DAY_NAMES[c.day].slice(0, 3)}</p>
                        <div className="h-1.5 rounded-full bg-surface2 mt-1.5 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: ok ? "var(--pandan)" : "var(--amber)" }} />
                        </div>
                        <p className="text-[10px] text-faint mt-1.5">{fmtDuration(c.covered)}</p>
                        {!ok && <p className="text-[9px] text-amber mt-1 leading-snug">Kosong: {c.gaps.join(", ")}</p>}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="card overflow-hidden rise" style={{ animationDelay: "160ms" }}>
                <div className="overflow-x-auto">
                  <div className="min-w-[900px]">
                    <div className="grid border-b border-line bg-surface2" style={{ gridTemplateColumns: "180px repeat(7, minmax(0,1fr))" }}>
                      <div className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-faint">Kasir</div>
                      {DAY_ORDER.map((d) => (
                        <div key={d} className="px-2 py-2.5 text-[10px] font-bold uppercase tracking-wider text-faint flex items-center gap-1.5">
                          {DAY_NAMES[d].slice(0, 3)}
                          <button onClick={() => copyDay(d)} title={`Salin shift ${DAY_NAMES[d]} ke hari lain`} className="text-faint hover:text-accent"><IRefresh size={11} /></button>
                        </div>
                      ))}
                    </div>
                    {staff.map((u) => (
                      <div key={u.id} className="grid border-b border-line last:border-0" style={{ gridTemplateColumns: "180px repeat(7, minmax(0,1fr))" }}>
                        <div className="px-3 py-3 flex items-center gap-2 border-r border-line">
                          <span className="w-7 h-7 rounded-lg grid place-items-center text-[10px] font-bold shrink-0 bg-accent-soft text-accent">
                            {u.name.split(" ").slice(0, 2).map((w: string) => w[0]).join("").toUpperCase()}
                          </span>
                          <span className="min-w-0">
                            <span className="block text-xs font-bold truncate">{u.name}</span>
                            <span className="block text-[9px] text-faint">{fmtDuration(weekMinutes(state.shiftPlans, u.id))}/minggu</span>
                          </span>
                        </div>
                        {DAY_ORDER.map((d) => {
                          const cell = state.shiftPlans.filter((p) => p.userId === u.id && p.day === d);
                          return (
                            <div key={d} className="p-1.5 border-r border-line last:border-0 min-h-[74px] space-y-1.5">
                              {cell.map((p) => (
                                <div key={p.id} className="group rounded-lg border px-2 py-1.5 relative"
                                  style={{ borderColor: p.active ? "color-mix(in srgb, var(--accent) 35%, transparent)" : "var(--line)", background: p.active ? "var(--accent-soft)" : "var(--bg2)", opacity: p.active ? 1 : 0.55 }}>
                                  <p className="text-[10px] font-mono font-bold" style={{ color: p.active ? "var(--accent)" : "var(--faint)" }}>{p.start}–{p.end}</p>
                                  <p className="text-[9px] text-faint truncate">{p.note || fmtDuration(spanMinutes(p.start, p.end))}</p>
                                  <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => setEditor({ open: true, plan: p, day: p.day, userId: p.userId })} aria-label="Edit shift" className="text-faint hover:text-accent"><IPen size={10} /></button>
                                    <button onClick={() => setDelPlan(p)} aria-label="Hapus shift" className="text-faint hover:text-chili"><IX size={10} /></button>
                                  </div>
                                </div>
                              ))}
                              <button onClick={() => setEditor({ open: true, plan: null, day: d, userId: u.id })}
                                className="w-full rounded-lg border border-dashed border-line2 py-1 text-[10px] font-bold text-faint hover:text-accent hover:border-accent transition-colors">
                                <IPlus size={10} className="inline" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* PERFORMA */}
      {tab === "performa" && (
        report ? (
          <div className="space-y-4">
            {isAdmin && (
              <div className="card p-3 flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-mute">Kasir:</span>
                {staff.map((u) => (
                  <button key={u.id} onClick={() => { setTargetId(u.id); sfx.tap(); }} className={`chip ${targetId === u.id ? "chip-on" : ""}`}>{u.name}</button>
                ))}
              </div>
            )}

            <div className="grid lg:grid-cols-[280px_1fr] gap-4">
              <div className="card p-5 rise">
                <p className="text-[10px] font-bold uppercase tracking-widest text-faint">Skor performa</p>
                <div className="flex items-end gap-2 mt-2">
                  <span className="font-display font-bold text-5xl" style={{ color: report.score >= 80 ? "var(--pandan)" : report.score >= 60 ? "var(--amber)" : "var(--chili)" }}>{report.score}</span>
                  <span className="text-sm text-faint mb-2">/100</span>
                </div>
                <div className="h-2 rounded-full bg-surface2 mt-3 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${report.score}%`, background: report.score >= 80 ? "var(--pandan)" : report.score >= 60 ? "var(--amber)" : "var(--chili)" }} />
                </div>
                <ul className="mt-4 space-y-2.5">
                  {report.scoreParts.map((p) => (
                    <li key={p.label}>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold">{p.label}</span>
                        <span className="font-mono text-mute">{Math.round(p.score)}</span>
                      </div>
                      <div className="h-1 rounded-full bg-surface2 mt-1 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${p.score}%`, background: "var(--accent)" }} />
                      </div>
                      <p className="text-[9.5px] text-faint mt-0.5">{p.detail}</p>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    { l: "Omzet", v: rupiah(report.revenue), s: `${num(report.txCount)} transaksi`, c: "var(--accent)" },
                    { l: "Rata-rata keranjang", v: rupiah(report.avgBasket), s: `${report.itemsPerTx.toFixed(1)} item/trx`, c: "var(--laut)" },
                    { l: "Kecepatan", v: report.perHour !== null ? `${report.perHour.toFixed(1)}/jam` : "—", s: `${fmtDuration(report.minutes)} kerja`, c: "var(--amber)" },
                    { l: "Selisih kas", v: rupiah(report.cashVariance), s: `${report.countedSessions} hitung kas`, c: Math.abs(report.cashVariance) > 20000 ? "var(--chili)" : "var(--pandan)" },
                  ].map((x, i) => (
                    <div key={x.l} className="card p-4 rise" style={{ animationDelay: `${i * 50}ms` }}>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-faint">{x.l}</p>
                      <p className="font-display font-bold text-lg mt-1.5 tabular-nums truncate" style={{ color: x.c }}>{x.v}</p>
                      <p className="text-[10px] text-faint mt-0.5">{x.s}</p>
                    </div>
                  ))}
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    { l: "Item terjual", v: num(report.items) },
                    { l: "Diskon diberikan", v: rupiah(report.discountGiven) },
                    { l: "Transaksi member", v: `${num(report.memberTx)} · ${rupiah(report.memberRevenue)}` },
                    { l: "Member baru dibuat", v: num(report.newMembers) },
                    { l: "Poin diterbitkan", v: num(report.pointsIssued) },
                    { l: "Tepat waktu", v: report.onTimeRate !== null ? `${Math.round(report.onTimeRate * 100)}%` : "tanpa acuan" },
                    { l: "Total telat", v: fmtDuration(report.lateMinutes) },
                    { l: "Tutup otomatis", v: `${report.autoClosed} shift` },
                    { l: "Kas belum dihitung", v: `${report.uncounted} shift` },
                    { l: "Idle > 15 menit", v: fmtDuration(report.idleMinutes) },
                    { l: "Refund", v: `${report.refundCount} · ${rupiah(report.refundValue)}` },
                    { l: "Trx di luar shift", v: num(report.outsideTx) },
                  ].map((x) => (
                    <div key={x.l} className="rounded-xl border border-line bg-surface p-3">
                      <p className="text-[10px] text-faint font-bold uppercase tracking-wider">{x.l}</p>
                      <p className="text-sm font-bold mt-1 tabular-nums truncate">{x.v}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-4">
              <div className="card p-5 lg:col-span-2">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-display font-bold">Omzet harian · {report.user.name}</h2>
                  <span className="text-[11px] text-faint">{range} hari terakhir</span>
                </div>
                <AreaChart key={`${report.user.id}-${range}`} data={report.series} height={240} />
              </div>
              <div className="card p-5">
                <h2 className="font-display font-bold mb-4">Metode pembayaran</h2>
                <PaymentSplit data={report.methods} />
                <div className="mt-4 pt-3 border-t border-line text-[11px] space-y-1.5">
                  <div className="flex justify-between"><span className="text-mute">Penjualan tunai</span><span className="font-mono font-bold">{rupiah(report.cashSales)}</span></div>
                  <div className="flex justify-between"><span className="text-mute">Kas diharapkan</span><span className="font-mono font-bold">{rupiah(report.cashExpected)}</span></div>
                  <div className="flex justify-between"><span className="text-mute">Kas dihitung</span><span className="font-mono font-bold">{rupiah(report.cashCounted)}</span></div>
                  <div className="flex justify-between font-bold" style={{ color: Math.abs(report.cashVariance) > 20000 ? "var(--chili)" : "var(--pandan)" }}>
                    <span>Selisih</span><span className="font-mono">{rupiah(report.cashVariance)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-4">
              <div className="card p-5 lg:col-span-2">
                <h2 className="font-display font-bold mb-1">Jam sibuk kasir ini</h2>
                <p className="text-[11px] text-faint mb-3">{report.peakHour ? `Puncak pukul ${report.peakHour}.00` : "Belum ada transaksi"} · pertama {report.firstTx ? timeID(report.firstTx) : "—"} · terakhir {report.lastTx ? timeID(report.lastTx) : "—"}</p>
                <Bars key={`h-${report.user.id}-${range}`} data={report.hours} height={200} color="var(--laut)" />
              </div>
              <div className="card p-5">
                <h2 className="font-display font-bold mb-4">Produk paling banyak dijual</h2>
                <HBarList items={report.top} />
              </div>
            </div>

            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-line flex items-center gap-2">
                <h2 className="font-display font-bold text-sm">Rincian per hari</h2>
                <span className="text-[11px] text-faint ml-auto">{report.days.length} baris</span>
              </div>
              <div className="overflow-auto max-h-[420px]">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-surface2 text-left text-[10px] uppercase tracking-wider text-faint">
                    <tr>
                      <th className="px-3 py-2.5">Tanggal</th><th className="px-3 py-2.5 text-right">Trx</th><th className="px-3 py-2.5 text-right">Item</th>
                      <th className="px-3 py-2.5 text-right">Omzet</th><th className="px-3 py-2.5 text-right">Rata²</th>
                      <th className="px-3 py-2.5 text-right">Jam</th><th className="px-3 py-2.5 text-right">Trx/jam</th>
                      <th className="px-3 py-2.5 text-right">Member</th><th className="px-3 py-2.5 text-right">Poin</th>
                      <th className="px-3 py-2.5 text-right">Selisih</th><th className="px-3 py-2.5 text-right">Telat</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {[...report.days].reverse().map((d) => (
                      <tr key={d.key} className="hover:bg-surface2/60">
                        <td className="px-3 py-2 font-bold">{d.full}</td>
                        <td className="px-3 py-2 text-right font-mono">{d.tx}</td>
                        <td className="px-3 py-2 text-right font-mono">{d.items}</td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-accent">{rupiah(d.revenue)}</td>
                        <td className="px-3 py-2 text-right font-mono">{rupiah(d.avg)}</td>
                        <td className="px-3 py-2 text-right font-mono">{d.minutes > 0 ? fmtDuration(d.minutes) : "—"}</td>
                        <td className="px-3 py-2 text-right font-mono">{d.perHour ? d.perHour.toFixed(1) : "—"}</td>
                        <td className="px-3 py-2 text-right font-mono">{d.members || "—"}</td>
                        <td className="px-3 py-2 text-right font-mono">{d.points || "—"}</td>
                        <td className="px-3 py-2 text-right font-mono" style={{ color: d.variance === 0 ? "var(--muted)" : Math.abs(d.variance) > 20000 ? "var(--chili)" : "var(--amber)" }}>{d.variance === 0 ? "—" : rupiah(d.variance)}</td>
                        <td className="px-3 py-2 text-right font-mono" style={{ color: d.late > 0 ? "var(--amber)" : "var(--muted)" }}>{d.late > 0 ? `${d.late}m` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="card"><EmptyState emoji="📊" title={isAdmin ? "Pilih kasir untuk melihat performa" : "Performa hanya untuk akun kasir"} desc={isAdmin ? "Administrator tidak memiliki shift sendiri." : "Admin mewarisi semua fitur tanpa shift; gunakan Analitik untuk performa toko."} /></div>
        )
      )}

      {/* SHIFT */}
      {tab === "shift" && (
        <div className="grid lg:grid-cols-[1fr_360px] gap-4">
          <div className="space-y-4">
            {isAdmin ? (
              <div className="card p-5">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <p className="font-display font-bold text-sm">Kontrol shift kasir</p>
                  <Badge color="var(--accent)">{activeSessions.length} berjalan</Badge>
                  <span className="ml-auto text-[11px] text-faint">Admin tidak memiliki shift sendiri</span>
                </div>
                {staff.length === 0 ? (
                  <EmptyState emoji="🧑‍💼" title="Belum ada kasir aktif" desc="Tambahkan akun kasir dulu di Pengaturan." />
                ) : (
                  <ul className="space-y-2">
                    {staff.map((u) => {
                      const open = openSessionOf(state.shiftSessions, u.id);
                      const st = open ? cashInSession(open, state.transactions) : null;
                      const plan = state.shiftPlans.filter((p) => p.userId === u.id && p.day === new Date().getDay() && p.active);
                      const remain = open?.autoCloseAt ? open.autoCloseAt - Date.now() : null;
                      return (
                        <li key={u.id} className="rounded-2xl border border-line bg-surface p-3.5">
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="w-10 h-10 rounded-xl grid place-items-center text-[11px] font-bold shrink-0 grad-accent text-accent-ink">
                              {u.name.split(" ").slice(0, 2).map((w: string) => w[0]).join("").toUpperCase()}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-bold truncate">{u.name}</p>
                              <p className="text-[11px] text-faint">
                                {open
                                  ? `Buka ${timeID(open.openedAt)} · ${fmtDuration(sessionMinutes(open))} · ${st?.count ?? 0} trx · ${rupiah(st?.revenue ?? 0)}`
                                  : plan.length ? `Jadwal hari ini ${plan.map((p) => `${p.start}–${p.end}`).join(", ")}` : "Tidak ada jadwal hari ini"}
                              </p>
                              {remain !== null && (
                                <p className="text-[10.5px] font-bold mt-0.5" style={{ color: remain < 900000 ? "var(--amber)" : "var(--muted)" }}>
                                  Tutup otomatis {timeID(open?.autoCloseAt as number)} · {countdown(remain)} lagi
                                </p>
                              )}
                            </div>
                            {open ? (
                              <div className="flex gap-1.5">
                                <Button size="sm" variant="ghost" onClick={() => { dispatch({ type: "EXTEND_SHIFT", id: open.id, minutes: 30 }); sfx.tap(); push({ msg: `Shift ${u.name} diperpanjang 30 menit`, type: "ok" }); }}>+30m</Button>
                                <Button size="sm" variant="danger" onClick={() => setCloseFor(open)}><IStop size={13} /> Tutup</Button>
                              </div>
                            ) : (
                              <Button size="sm" onClick={() => setOpenFor(u)}><IPlay size={13} /> Buka shift</Button>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ) : (
              <div className="card p-5 rise"
                style={{ borderColor: myOpen ? "color-mix(in srgb, var(--pandan) 35%, transparent)" : "color-mix(in srgb, var(--amber) 35%, transparent)" }}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="w-10 h-10 rounded-xl grid place-items-center"
                    style={{ color: myOpen ? "var(--pandan)" : "var(--amber)", background: `color-mix(in srgb, ${myOpen ? "var(--pandan)" : "var(--amber)"} 14%, transparent)` }}>
                    <IClock size={19} />
                  </span>
                  <div>
                    <p className="font-display font-bold text-lg leading-none">{myOpen ? "Shift sedang berjalan" : "Belum ada shift berjalan"}</p>
                    <p className="text-[11px] text-faint mt-1">
                      {myOpen
                        ? `Dibuka ${timeID(myOpen.openedAt)} · ${fmtDuration(sessionMinutes(myOpen))}${myOpen.autoCloseAt ? ` · tutup otomatis ${timeID(myOpen.autoCloseAt)} (${countdown(myOpen.autoCloseAt - Date.now())} lagi)` : ""}`
                        : todayPlan.length ? `Jadwal hari ini: ${todayPlan.map((p) => `${p.start}–${p.end}`).join(", ")}` : `Tidak ada jadwal hari ini · tutup otomatis ${STORE_CLOSE}`}
                    </p>
                  </div>
                  <div className="ml-auto">
                    {myOpen
                      ? <Button variant="danger" onClick={() => setCloseFor(myOpen)}><IStop size={15} /> Tutup Shift</Button>
                      : <Button onClick={() => setOpenFor(user)}><IPlay size={15} /> Buka Shift</Button>}
                  </div>
                </div>
                {myOpen && (() => {
                  const st = cashInSession(myOpen, state.transactions);
                  return (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                      {[
                        { l: "Transaksi", v: num(st.count) },
                        { l: "Omzet shift", v: rupiah(st.revenue) },
                        { l: "Modal awal", v: rupiah(myOpen.openingCash) },
                        { l: "Kas diharapkan", v: rupiah(st.expected) },
                      ].map((x) => (
                        <div key={x.l} className="rounded-xl border border-line bg-surface p-3">
                          <p className="text-[10px] text-faint font-bold uppercase tracking-wider">{x.l}</p>
                          <p className="font-display font-bold text-base mt-1 tabular-nums">{x.v}</p>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}

            {!isAdmin && (
              <div className="card p-5">
                <h2 className="font-display font-bold text-sm mb-3">Jadwal saya minggu ini</h2>
                <div className="grid grid-cols-7 gap-1.5">
                  {DAY_ORDER.map((d) => {
                    const list = myPlans.filter((p) => p.day === d);
                    const isToday = d === new Date().getDay();
                    return (
                      <div key={d} className="rounded-xl border p-2 min-h-[86px]"
                        style={{ borderColor: isToday ? "var(--accent)" : "var(--line)", background: isToday ? "var(--accent-soft)" : "var(--surface)" }}>
                        <p className="text-[10px] font-bold" style={{ color: isToday ? "var(--accent)" : "var(--text)" }}>{DAY_NAMES[d].slice(0, 3)}</p>
                        {list.length === 0 ? <p className="text-[9px] text-faint mt-2">Libur</p> : list.map((p) => (
                          <div key={p.id} className="mt-1.5">
                            <p className="text-[9.5px] font-mono font-bold">{p.start}</p>
                            <p className="text-[9.5px] font-mono text-faint">{p.end}</p>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
                <p className="text-[11px] text-faint mt-3">Total {fmtDuration(weekMinutes(state.shiftPlans, user.id))} terjadwal · {myPlans.length} shift.</p>
              </div>
            )}

            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-line flex items-center gap-2">
                <h2 className="font-display font-bold text-sm">Riwayat shift {isAdmin ? "semua kasir" : "saya"}</h2>
                <span className="text-[11px] text-faint ml-auto">
                  {state.shiftSessions.filter((s) => (isAdmin ? true : s.userId === user.id)).length} sesi
                </span>
              </div>
              <ul className="divide-y divide-line max-h-[380px] overflow-y-auto">
                {[...state.shiftSessions]
                  .filter((s) => (isAdmin ? true : s.userId === user.id))
                  .sort((a, b) => b.openedAt - a.openedAt)
                  .slice(0, 50)
                  .map((s) => {
                    const st = cashInSession(s, state.transactions);
                    const variance = s.closingCash !== null ? s.closingCash - st.expected : null;
                    return (
                      <li key={s.id} className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-bold">{s.userName}</span>
                          <span className="text-[11px] text-mute">{dateID(s.openedAt)}</span>
                          <span className="text-[11px] font-mono text-mute">{timeID(s.openedAt)}–{s.closedAt ? timeID(s.closedAt) : "sekarang"}</span>
                          <Badge color={s.closedAt ? (s.closedBy === "auto" ? "var(--laut)" : "var(--muted)") : "var(--pandan)"}>
                            {s.closedAt ? (s.closedBy === "auto" ? "tutup otomatis" : s.closedBy === "admin" ? "ditutup admin" : "selesai") : "berjalan"}
                          </Badge>
                          {s.source === "auto" && <Badge color="var(--violet)">estimasi</Badge>}
                          <span className="ml-auto text-[11px] font-mono">{fmtDuration(sessionMinutes(s))}</span>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-[10.5px] text-faint">
                          <span>{st.count} trx · {rupiah(st.revenue)}</span>
                          <span>Modal awal {rupiah(s.openingCash)}</span>
                          <span>Kas diharapkan {rupiah(st.expected)}</span>
                          {s.closingCash !== null ? <span>Kas dihitung {rupiah(s.closingCash)}</span> : s.closedAt !== null && <span className="text-amber">kas belum dihitung</span>}
                          {variance !== null && (
                            <span style={{ color: variance === 0 ? "var(--pandan)" : Math.abs(variance) > 20000 ? "var(--chili)" : "var(--amber)" }}>
                              Selisih {rupiah(variance)}
                            </span>
                          )}
                        </div>
                        {s.closeNote && <p className="text-[10px] text-faint mt-1 italic">{s.closeNote}</p>}
                        {s.closedAt !== null && s.closingCash === null && (isAdmin || s.userId === user.id) && (
                          <Button size="sm" variant="soft" className="mt-2" onClick={() => setReconcileFor(s)}><IStar size={12} /> Hitung kas sekarang</Button>
                        )}
                      </li>
                    );
                  })}
              </ul>
              {state.shiftSessions.filter((s) => (isAdmin ? true : s.userId === user.id)).length === 0 && (
                <EmptyState emoji="🕒" title="Belum ada riwayat shift" desc="Buka shift pertama untuk mulai mencatat jam kerja dan kas." />
              )}
            </div>
          </div>

          <div className="space-y-4">
            {report && (
              <div className="card p-5">
                <h2 className="font-display font-bold text-sm mb-3">Performa {range} hari</h2>
                <div className="space-y-2.5">
                  {[
                    { l: "Skor", v: `${report.score}/100` },
                    { l: "Omzet", v: rupiah(report.revenue) },
                    { l: "Transaksi", v: num(report.txCount) },
                    { l: "Jam kerja", v: fmtDuration(report.minutes) },
                    { l: "Tepat waktu", v: report.onTimeRate !== null ? `${Math.round(report.onTimeRate * 100)}%` : "—" },
                    { l: "Member baru", v: num(report.newMembers) },
                    { l: "Selisih kas", v: rupiah(report.cashVariance) },
                  ].map((x) => (
                    <div key={x.l} className="flex items-center justify-between text-[11px]">
                      <span className="text-mute">{x.l}</span>
                      <span className="font-mono font-bold">{x.v}</span>
                    </div>
                  ))}
                </div>
                <Button variant="ghost" size="sm" className="w-full mt-4" onClick={() => { setTab("performa"); router.replace("/shift?tab=performa"); }}>
                  <IChart size={14} /> Analitik lengkap
                </Button>
              </div>
            )}
            <div className="card p-5">
              <p className="text-xs font-bold flex items-center gap-1.5"><IInfo size={14} className="text-accent" /> Aturan shift</p>
              <ul className="mt-2.5 space-y-2 text-[11px] text-mute leading-relaxed">
                <li className="flex gap-2"><ICheckCircle size={13} className="text-pandan shrink-0 mt-0.5" /> Shift hanya untuk akun kasir terdaftar. Admin tidak punya shift.</li>
                <li className="flex gap-2"><ICheckCircle size={13} className="text-pandan shrink-0 mt-0.5" /> Buka shift dengan menghitung modal kas awal di laci.</li>
                <li className="flex gap-2"><ICheckCircle size={13} className="text-pandan shrink-0 mt-0.5" /> Jam tutup mengikuti jadwal shift; sistem menutup otomatis tepat waktu.</li>
                <li className="flex gap-2"><ICheckCircle size={13} className="text-pandan shrink-0 mt-0.5" /> Setelah tutup otomatis, kas fisik bisa dihitung menyusul lewat “Hitung kas sekarang”.</li>
                <li className="flex gap-2"><IAlert size={13} className="text-amber shrink-0 mt-0.5" /> Datang lebih dari 5 menit dari jadwal dihitung terlambat.</li>
                <li className="flex gap-2"><IHeart size={13} className="text-chili shrink-0 mt-0.5" /> Pendaftaran member oleh kasir menambah skor akuisisi.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      <ShiftEditor state={editor} staff={staff} plans={state.shiftPlans}
        onClose={() => setEditor({ open: false, plan: null, day: 1, userId: "" })}
        onSave={(plans) => {
          plans.forEach((p) => dispatch({ type: editor.plan ? "UPDATE_SHIFT" : "ADD_SHIFT", plan: p }));
          sfx.success();
          push({ msg: editor.plan ? "Shift diperbarui" : `${plans.length} shift ditambahkan`, type: "ok" });
          setEditor({ open: false, plan: null, day: 1, userId: "" });
        }} />

      <Confirm open={!!delPlan} onClose={() => setDelPlan(null)} onConfirm={() => delPlan && removePlan(delPlan)}
        title="Hapus shift ini?" confirmLabel="Ya, Hapus"
        desc={delPlan ? `${DAY_NAMES[delPlan.day]} ${delPlan.start}–${delPlan.end} akan dihapus dari jadwal. Bisa diurungkan lewat notifikasi.` : ""} />

      <OpenShiftModal target={openFor} onClose={() => setOpenFor(null)}
        plans={state.shiftPlans}
        onOpen={(target, cash, note, endOverride) => {
          const plan = state.shiftPlans.find((p) => p.userId === target.id && p.day === new Date().getDay() && p.active) ?? null;
          const autoCloseAt = endOverride ? computeAutoClose({ id: "x", userId: target.id, day: new Date().getDay(), start: "00:00", end: endOverride, note: "", active: true }, STORE_CLOSE) : computeAutoClose(plan, STORE_CLOSE);
          const session: ShiftSession = {
            id: newShiftId(), userId: target.id, userName: target.name, planId: plan?.id ?? null,
            openedAt: Date.now(), closedAt: null, autoCloseAt,
            openingCash: cash, closingCash: null, note, source: "manual",
            openedBy: user.id, closedBy: null,
          };
          dispatch({ type: "OPEN_SHIFT", session });
          sfx.success();
          push({ msg: `Shift ${target.name} dibuka · modal ${rupiah(cash)} · tutup otomatis ${autoCloseAt ? timeID(autoCloseAt) : "—"}`, type: "ok", dur: 5000 });
          setOpenFor(null);
        }} />

      <CloseShiftModal session={closeFor} expected={closeFor ? cashInSession(closeFor, state.transactions).expected : 0}
        onClose={() => setCloseFor(null)}
        onCloseShift={(s, cash, note) => {
          dispatch({ type: "CLOSE_SHIFT", id: s.id, closingCash: cash, note, by: isAdmin && s.userId !== user.id ? "admin" : "manual" });
          sfx.cash();
          const exp = cashInSession(s, state.transactions).expected;
          const diff = cash === null ? 0 : cash - exp;
          push({
            msg: cash === null ? `Shift ${s.userName} ditutup · kas belum dihitung` : `Shift ditutup · selisih ${rupiah(diff)}`,
            type: cash !== null && Math.abs(diff) > 20000 ? "err" : "ok", dur: 6000,
          });
          setCloseFor(null);
        }} />

      <ReconcileModal session={reconcileFor} expected={reconcileFor ? cashInSession(reconcileFor, state.transactions).expected : 0}
        onClose={() => setReconcileFor(null)}
        onSave={(s, cash, note) => {
          dispatch({ type: "RECONCILE_SHIFT", id: s.id, closingCash: cash, note });
          sfx.cash();
          push({ msg: `Kas shift ${s.userName} dihitung · selisih ${rupiah(cash - cashInSession(s, state.transactions).expected)}`, type: "ok" });
          setReconcileFor(null);
        }} />
    </div>
  );
}

function ShiftEditor({ state, staff, plans, onClose, onSave }: {
  state: { open: boolean; plan: ShiftPlan | null; day: number; userId: string };
  staff: User[]; plans: ShiftPlan[]; onClose: () => void; onSave: (plans: ShiftPlan[]) => void;
}) {
  const [userId, setUserId] = useState("");
  const [days, setDays] = useState<number[]>([]);
  const [start, setStart] = useState("07:00");
  const [end, setEnd] = useState("15:00");
  const [note, setNote] = useState("");
  const [active, setActive] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!state.open) return;
    setUserId(state.plan?.userId ?? state.userId);
    setDays([state.plan?.day ?? state.day]);
    setStart(state.plan?.start ?? "07:00");
    setEnd(state.plan?.end ?? "15:00");
    setNote(state.plan?.note ?? "");
    setActive(state.plan?.active ?? true);
    setErr("");
  }, [state]);

  const clash = days.some((d) => plans.some((p) => p.userId === userId && p.day === d && p.id !== state.plan?.id && overlaps(p.start, p.end, start, end)));

  const save = () => {
    if (!userId) { setErr("Pilih kasir terlebih dahulu"); sfx.error(); return; }
    if (!days.length) { setErr("Pilih minimal satu hari"); sfx.error(); return; }
    if (start === end) { setErr("Jam buka dan tutup tidak boleh sama"); sfx.error(); return; }
    const base: ShiftPlan = { id: state.plan?.id ?? newShiftId(), userId, day: days[0], start, end, note: note.trim(), active };
    onSave(state.plan ? [base] : days.map((d) => ({ ...base, id: newShiftId(), day: d })));
  };

  return (
    <Modal open={state.open} onClose={onClose} title={state.plan ? "Edit shift kasir" : "Tambah shift kasir"}
      footer={<div className="flex gap-2 justify-end"><Button variant="ghost" onClick={onClose}>Batal</Button><Button onClick={save}>{state.plan ? "Simpan" : `Tambah ${days.length} shift`}</Button></div>}>
      <div className="space-y-4">
        <Field label="Kasir" hint="Hanya akun kasir terdaftar yang bisa dijadwalkan">
          <Select value={userId} onChange={setUserId} options={staff.map((u) => ({ v: u.id, l: `${u.name} · @${u.username}` }))} />
        </Field>
        <Field label="Hari" hint={state.plan ? "Edit berlaku untuk shift ini" : "Bisa pilih beberapa hari sekaligus"}>
          <div className="grid grid-cols-7 gap-1.5">
            {DAY_ORDER.map((d) => {
              const on = days.includes(d);
              return (
                <button key={d} onClick={() => setDays((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d])}
                  className="rounded-xl border py-2.5 text-[11px] font-bold transition-all active:scale-95"
                  style={on ? { background: "linear-gradient(135deg,var(--accent),var(--accent2))", color: "var(--accent-ink)", borderColor: "transparent" } : { borderColor: "var(--line)", background: "var(--bg2)", color: "var(--faint)" }}>
                  {DAY_NAMES[d].slice(0, 3)}
                </button>
              );
            })}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Jam buka shift"><Input type="time" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
          <Field label="Jam tutup shift" hint="Shift tutup otomatis pada jam ini"><Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button key={p.label} onClick={() => { setStart(p.start); setEnd(p.end); sfx.tap(); }}
              className={`chip ${start === p.start && end === p.end ? "chip-on" : ""}`}>{p.label} {p.start}–{p.end}</button>
          ))}
        </div>
        <div className="rounded-xl border border-line bg-surface p-3 flex items-center gap-2 text-[11px]">
          <IClock size={14} className="text-accent" />
          <span className="text-mute">Durasi shift</span>
          <span className="font-bold ml-auto">{fmtDuration(spanMinutes(start, end))}</span>
          {spanMinutes(start, end) > 600 && <Badge color="var(--amber)">lebih dari 10 jam</Badge>}
        </div>
        {clash && <p className="text-[11px] text-amber flex gap-1.5"><IAlert size={13} className="shrink-0 mt-0.5" /> Bertabrakan dengan shift lain milik kasir ini.</p>}
        <Field label="Catatan shift"><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Buka toko, siapkan bar, rekap kas…" /></Field>
        <div className="flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-3">
          <div>
            <p className="text-sm font-bold">Shift aktif</p>
            <p className="text-[11px] text-faint">Shift nonaktif tidak dihitung pada cakupan jam buka</p>
          </div>
          <Toggle checked={active} onChange={setActive} label="Aktif" />
        </div>
        {err && <p className="text-[11px] text-chili">{err}</p>}
      </div>
    </Modal>
  );
}

function OpenShiftModal({ target, plans, onClose, onOpen }: {
  target: User | null; plans: ShiftPlan[]; onClose: () => void;
  onOpen: (target: User, cash: number, note: string, endOverride: string | null) => void;
}) {
  const [cash, setCash] = useState("150000");
  const [note, setNote] = useState("");
  const [override, setOverride] = useState(false);
  const [endTime, setEndTime] = useState(STORE_CLOSE);

  const plan = target ? plans.find((p) => p.userId === target.id && p.day === new Date().getDay() && p.active) ?? null : null;

  useEffect(() => {
    if (!target) return;
    setCash("150000");
    setNote(plan?.note ?? "");
    setOverride(false);
    setEndTime(plan?.end ?? STORE_CLOSE);
  }, [target, plan]);

  const value = Math.max(0, Number(cash) || 0);
  const autoAt = computeAutoClose(override ? { id: "x", userId: target?.id ?? "", day: new Date().getDay(), start: "00:00", end: endTime, note: "", active: true } : plan, STORE_CLOSE);

  return (
    <Modal open={!!target} onClose={onClose} title={`Buka shift · ${target?.name ?? ""}`}
      footer={<div className="flex gap-2 justify-end"><Button variant="ghost" onClick={onClose}>Batal</Button>
        <Button onClick={() => target && onOpen(target, value, note.trim(), override ? endTime : null)}><IPlay size={15} /> Buka Shift</Button></div>}>
      <div className="space-y-4">
        <div className="rounded-2xl border p-4" style={{ borderColor: "color-mix(in srgb, var(--accent) 30%, transparent)", background: "var(--accent-soft)" }}>
          <p className="text-xs font-bold">{target?.name} · @{target?.username}</p>
          <p className="text-[11px] text-mute mt-1">
            {plan ? `Jadwal hari ini ${plan.start}–${plan.end} · ${plan.note || "tanpa catatan"}` : "Tidak ada jadwal hari ini — shift di luar jadwal, tutup mengikuti jam tutup toko."}
          </p>
          <p className="text-[11px] font-bold mt-2 text-accent">Tutup otomatis: {autoAt ? timeID(autoAt) : "—"}</p>
        </div>
        <Field label="Modal kas awal di laci (Rp)" hint="Hitung uang fisik sebelum mulai melayani">
          <Input type="number" min={0} inputMode="numeric" value={cash} onChange={(e) => setCash(e.target.value)} autoFocus />
        </Field>
        <div className="flex flex-wrap gap-1.5">
          {[100000, 150000, 200000, 300000, 500000].map((v) => (
            <button key={v} onClick={() => setCash(String(v))} className={`chip ${value === v ? "chip-on" : ""}`}>{rupiah(v)}</button>
          ))}
        </div>
        <div className="flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-3">
          <div>
            <p className="text-sm font-bold">Ubah jam tutup manual</p>
            <p className="text-[11px] text-faint">Aktifkan bila shift hari ini harus pulang lebih cepat/lambat</p>
          </div>
          <Toggle checked={override} onChange={setOverride} label="Ubah jam tutup" />
        </div>
        {override && <Field label="Jam tutup shift"><Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} /></Field>}
        <Field label="Catatan pembukaan"><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Kondisi bar, stok habis, dsb." /></Field>
      </div>
    </Modal>
  );
}

function CloseShiftModal({ session, expected, onClose, onCloseShift }: {
  session: ShiftSession | null; expected: number; onClose: () => void;
  onCloseShift: (s: ShiftSession, cash: number | null, note: string) => void;
}) {
  const [cash, setCash] = useState("");
  const [note, setNote] = useState("");
  const [skip, setSkip] = useState(false);

  useEffect(() => {
    if (!session) return;
    setCash(String(expected));
    setNote("");
    setSkip(false);
  }, [session, expected]);

  const value = Math.max(0, Number(cash) || 0);
  const diff = value - expected;

  return (
    <Modal open={!!session} onClose={onClose} title={`Tutup shift · ${session?.userName ?? ""}`}
      footer={<div className="flex gap-2 justify-end"><Button variant="ghost" onClick={onClose}>Batal</Button>
        <Button variant="danger" onClick={() => session && onCloseShift(session, skip ? null : value, note.trim())}><IStop size={15} /> Tutup Shift</Button></div>}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-[11px]">
          <div className="rounded-xl border border-line bg-surface p-3"><p className="text-faint text-[10px] uppercase font-bold">Buka</p><p className="font-bold mt-0.5">{session ? timeID(session.openedAt) : "—"}</p></div>
          <div className="rounded-xl border border-line bg-surface p-3"><p className="text-faint text-[10px] uppercase font-bold">Durasi</p><p className="font-bold mt-0.5">{session ? fmtDuration(sessionMinutes(session)) : "—"}</p></div>
          <div className="rounded-xl border border-line bg-surface p-3"><p className="text-faint text-[10px] uppercase font-bold">Modal awal</p><p className="font-bold mt-0.5">{rupiah(session?.openingCash ?? 0)}</p></div>
          <div className="rounded-xl border border-line bg-surface p-3"><p className="text-faint text-[10px] uppercase font-bold">Kas diharapkan</p><p className="font-bold mt-0.5 text-accent">{rupiah(expected)}</p></div>
        </div>
        {!skip && (
          <>
            <Field label="Uang fisik dihitung (Rp)" hint="Hitung seluruh uang tunai di laci sekarang">
              <Input type="number" min={0} inputMode="numeric" value={cash} onChange={(e) => setCash(e.target.value)} autoFocus />
            </Field>
            <div className="rounded-xl border p-3 flex items-center gap-2"
              style={{
                borderColor: diff === 0 ? "color-mix(in srgb, var(--pandan) 40%, transparent)" : Math.abs(diff) > 20000 ? "color-mix(in srgb, var(--chili) 40%, transparent)" : "color-mix(in srgb, var(--amber) 40%, transparent)",
                background: diff === 0 ? "color-mix(in srgb, var(--pandan) 8%, transparent)" : Math.abs(diff) > 20000 ? "color-mix(in srgb, var(--chili) 8%, transparent)" : "color-mix(in srgb, var(--amber) 8%, transparent)",
              }}>
              {diff === 0 ? <ICheckCircle size={16} className="text-pandan" /> : <IAlert size={16} style={{ color: Math.abs(diff) > 20000 ? "var(--chili)" : "var(--amber)" }} />}
              <span className="text-xs font-bold">Selisih kas</span>
              <span className="ml-auto font-display font-bold text-lg" style={{ color: diff === 0 ? "var(--pandan)" : Math.abs(diff) > 20000 ? "var(--chili)" : "var(--amber)" }}>{rupiah(diff)}</span>
            </div>
          </>
        )}
        <div className="flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-3">
          <div>
            <p className="text-sm font-bold">Tutup tanpa hitung kas</p>
            <p className="text-[11px] text-faint">Kas bisa dihitung menyusul lewat “Hitung kas sekarang”</p>
          </div>
          <Toggle checked={skip} onChange={setSkip} label="Lewati hitung kas" />
        </div>
        <Field label="Catatan penutupan"><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Penjelasan selisih, serah terima, kondisi toko…" /></Field>
      </div>
    </Modal>
  );
}

function ReconcileModal({ session, expected, onClose, onSave }: {
  session: ShiftSession | null; expected: number; onClose: () => void;
  onSave: (s: ShiftSession, cash: number, note: string) => void;
}) {
  const [cash, setCash] = useState("");
  const [note, setNote] = useState("");
  useEffect(() => { if (session) { setCash(String(expected)); setNote(""); } }, [session, expected]);
  const value = Math.max(0, Number(cash) || 0);
  const diff = value - expected;

  return (
    <Modal open={!!session} onClose={onClose} title={`Hitung kas · ${session?.userName ?? ""}`}
      footer={<div className="flex gap-2 justify-end"><Button variant="ghost" onClick={onClose}>Batal</Button>
        <Button onClick={() => session && onSave(session, value, note.trim())}><ICheck size={15} /> Simpan hitungan</Button></div>}>
      <div className="space-y-4">
        <div className="rounded-xl border border-line bg-surface p-3 text-[11px] text-mute">
          Shift {session ? `${dateID(session.openedAt)} ${timeID(session.openedAt)}–${session.closedAt ? timeID(session.closedAt) : ""}` : ""} · kas diharapkan <b className="text-accent">{rupiah(expected)}</b>
        </div>
        <Field label="Uang fisik dihitung (Rp)"><Input type="number" min={0} inputMode="numeric" value={cash} onChange={(e) => setCash(e.target.value)} autoFocus /></Field>
        <div className="rounded-xl border border-line bg-surface p-3 flex items-center gap-2 text-xs">
          <span className="font-bold">Selisih</span>
          <span className="ml-auto font-display font-bold text-lg" style={{ color: diff === 0 ? "var(--pandan)" : Math.abs(diff) > 20000 ? "var(--chili)" : "var(--amber)" }}>{rupiah(diff)}</span>
        </div>
        <Field label="Catatan"><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Penjelasan selisih…" /></Field>
      </div>
    </Modal>
  );
}