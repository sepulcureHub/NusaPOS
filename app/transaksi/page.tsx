"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth, useStore } from "@/lib/store";
import { useToast } from "@/components/Toasts";
import { sfx } from "@/lib/sound";
import { METHOD_COLORS } from "@/lib/types";
import type { Transaction } from "@/lib/types";
import { dateID, download, rupiah, startOfDay, timeID, toCSV } from "@/lib/format";
import { ProductThumb } from "@/components/ProductThumb";
import { Highlight, SearchField } from "@/components/SearchField";
import { Badge, Button, Confirm, Drawer, EmptyState, PageSkel, Segmented, Select } from "@/components/ui";
import { Receipt } from "@/components/Receipt";
import { IChevronLeft, IChevronRight, IDownload, IHeart, IPrint, IShield, IUndo } from "@/components/icons";

const PAGE_SIZE = 12;

export default function TransaksiPage() {
  return (
    <Suspense fallback={<PageSkel />}>
      <Transaksi />
    </Suspense>
  );
}

function Transaksi() {
  const { state } = useStore();
  const { can, user } = useAuth();
  const router = useRouter();
  const sp = useSearchParams();
  const [preset, setPreset] = useState("today");
  const [method, setMethod] = useState("Semua");
  const [status, setStatus] = useState("Semua");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);

  const seeAll = can("tx.all");
  const mySessionIds = useMemo(
    () => new Set(state.shiftSessions.filter((s) => s.userId === user?.id).map((s) => s.id)),
    [state.shiftSessions, user]
  );

  useEffect(() => { const o = sp.get("open"); if (o && state.hydrated) setOpenId(o); }, [sp, state.hydrated]);
  useEffect(() => { setPage(0); }, [preset, method, status, q]);

  const scoped = useMemo(
    () => (seeAll ? state.transactions : state.transactions.filter((t) => t.cashier === user?.name || (t.shiftId ? mySessionIds.has(t.shiftId) : false))),
    [state.transactions, seeAll, user, mySessionIds]
  );

  const filtered = useMemo(() => {
    const t0 = startOfDay(Date.now());
    const start = preset === "today" ? t0 : preset === "7" ? t0 - 6 * 86400000 : preset === "30" ? t0 - 29 * 86400000 : 0;
    const s = q.trim().toLowerCase();
    return [...scoped]
      .filter((t) =>
        t.ts >= start &&
        (method === "Semua" || t.method === method) &&
        (status === "Semua" || t.status === status) &&
        (!s || t.id.toLowerCase().includes(s) || t.customerName.toLowerCase().includes(s) || t.cashier.toLowerCase().includes(s) || (t.memberNo ?? "").toLowerCase().includes(s) || t.items.some((i) => i.name.toLowerCase().includes(s))))
      .sort((a, b) => b.ts - a.ts);
  }, [scoped, preset, method, status, q]);

  if (!state.hydrated) return <PageSkel />;

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const list = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const done = filtered.filter((t) => t.status === "Selesai");
  const total = done.reduce((a, t) => a + t.total, 0);
  const avg = done.length ? total / done.length : 0;
  const memberTx = done.filter((t) => !!t.memberNo).length;

  const exportCSV = () => {
    const rows: (string | number)[][] = [["ID", "Tanggal", "Jam", "Kasir", "Pelanggan", "Member", "Metode", "Status", "Subtotal", "Diskon", "Potongan member", "Pajak", "Total", "Poin", "Item"]];
    filtered.forEach((t) => rows.push([t.id, new Date(t.ts).toLocaleDateString("id-ID"), timeID(t.ts), t.cashier, t.customerName, t.memberNo ?? "-", t.method, t.status, t.subtotal, t.discount, t.memberDiscount ?? 0, t.tax + t.service, t.total, t.memberPoints ?? 0, t.items.map((i) => `${i.qty}x ${i.name}`).join("; ")]));
    download(`nusapos-transaksi-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(rows), "text/csv");
  };

  const closeDrawer = () => { setOpenId(null); if (sp.get("open")) router.replace("/transaksi"); };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rise">
        <div>
          <h1 className="font-display font-bold text-2xl flex items-center gap-2">
            {seeAll ? "Transaksi" : "Transaksi Saya"}
            {!seeAll && <Badge color="var(--amber)"><IShield size={10} /> hanya milik {user?.name.split(" ")[0]}</Badge>}
          </h1>
          <p className="text-sm text-mute mt-0.5">
            {seeAll ? "Riwayat semua kasir, detail struk, dan refund." : "Riwayat transaksimu sendiri + cetak ulang struk. Refund dilakukan administrator."}
          </p>
        </div>
        {can("tx.export")
          ? <Button variant="ghost" size="sm" onClick={exportCSV}><IDownload size={14} /> Ekspor CSV ({filtered.length})</Button>
          : <Badge color="var(--amber)"><IShield size={11} /> Refund & ekspor khusus admin</Badge>}
      </div>

      <div className="card p-3 space-y-2.5 rise" style={{ animationDelay: "60ms" }}>
        <SearchField value={q} onChange={setQ} size="md" shortcut={openId ? undefined : "/"}
          count={filtered.length} countLabel="transaksi" ariaLabel="Cari transaksi"
          placeholder="Cari ID, pelanggan, No. member, kasir, atau item…" onEscape={() => setQ("")} />
        <div className="flex flex-wrap items-center gap-2">
          <Segmented value={preset} onChange={setPreset} options={[{ v: "today", l: "Hari ini" }, { v: "7", l: "7 hari" }, { v: "30", l: "30 hari" }, { v: "all", l: "Semua" }]} />
          <Select label="Metode" value={method} onChange={setMethod} className="w-32" options={[{ v: "Semua", l: "Semua metode" }, { v: "Tunai", l: "Tunai" }, { v: "QRIS", l: "QRIS" }, { v: "Kartu", l: "Kartu" }]} />
          <Select label="Status" value={status} onChange={setStatus} className="w-32" options={[{ v: "Semua", l: "Semua status" }, { v: "Selesai", l: "Selesai" }, { v: "Refund", l: "Refund" }]} />
          <div className="flex flex-wrap gap-2 ml-auto">
            <Badge color="var(--accent)">{filtered.length} transaksi</Badge>
            <Badge color="var(--amber)">Omzet {rupiah(total)}</Badge>
            <Badge color="var(--laut)">Rata-rata {rupiah(avg)}</Badge>
            <Badge color="var(--violet)"><IHeart size={10} /> {memberTx} member</Badge>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden rise" style={{ animationDelay: "120ms" }}>
        <table className="w-full text-sm hidden md:table">
          <thead className="bg-surface2 text-left text-[11px] uppercase tracking-wider text-faint">
            <tr>
              <th className="px-4 py-3">ID</th><th className="px-4 py-3">Waktu</th>
              {seeAll && <th className="px-4 py-3">Kasir</th>}
              <th className="px-4 py-3">Pelanggan</th><th className="px-4 py-3">Item</th><th className="px-4 py-3">Metode</th>
              <th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3">Status</th><th className="w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {list.map((t) => (
              <tr key={t.id} onClick={() => setOpenId(t.id)} className="cursor-pointer hover:bg-surface2/60 transition-colors">
                <td className="px-4 py-3 font-mono text-xs font-bold"><Highlight text={t.id} query={q} /></td>
                <td className="px-4 py-3 text-xs text-mute">{dateID(t.ts)} · {timeID(t.ts)}</td>
                {seeAll && <td className="px-4 py-3 text-xs"><Highlight text={t.cashier} query={q} /></td>}
                <td className="px-4 py-3 text-xs">
                  <p className="font-bold"><Highlight text={t.customerName} query={q} /></p>
                  {t.memberNo && <p className="text-[10px] font-mono" style={{ color: "var(--violet)" }}>{t.memberNo}</p>}
                </td>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-1">
                    {t.items.slice(0, 3).map((i) => <ProductThumb key={i.productId} name={i.name} photo={i.photo} category={i.category} size={22} rounded={7} />)}
                    <span className="text-[10px] text-faint ml-1">{t.items.reduce((a, i) => a + i.qty, 0)}×</span>
                  </span>
                </td>
                <td className="px-4 py-3"><Badge color={METHOD_COLORS[t.method]}>{t.method}</Badge></td>
                <td className="px-4 py-3 text-right font-mono font-bold">{rupiah(t.total)}</td>
                <td className="px-4 py-3"><Badge color={t.status === "Selesai" ? "var(--pandan)" : "var(--chili)"}>{t.status}</Badge></td>
                <td className="px-2 text-faint"><IChevronRight size={15} /></td>
              </tr>
            ))}
          </tbody>
        </table>

        <ul className="md:hidden divide-y divide-line">
          {list.map((t) => (
            <li key={t.id}>
              <button onClick={() => setOpenId(t.id)} className="w-full text-left px-4 py-3.5 hover:bg-surface2/60">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-bold"><Highlight text={t.id} query={q} /></span>
                  <span className="font-mono font-bold text-sm">{rupiah(t.total)}</span>
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-[11px] text-faint truncate"><Highlight text={t.customerName} query={q} /> · {dateID(t.ts)} {timeID(t.ts)}</span>
                  <span className="flex gap-1.5 shrink-0">
                    {t.memberNo && <Badge color="var(--violet)"><IHeart size={9} /></Badge>}
                    <Badge color={METHOD_COLORS[t.method]}>{t.method}</Badge>
                    {t.status === "Refund" && <Badge color="var(--chili)">Refund</Badge>}
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>

        {filtered.length === 0 && <EmptyState emoji="🧾" title="Tidak ada transaksi" desc={seeAll ? "Ubah filter atau kata kunci." : "Belum ada transaksi milikmu pada periode ini. Mulai jualan dari Kasir."} />}

        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-line">
            <Button variant="ghost" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}><IChevronLeft size={14} /> Sebelumnya</Button>
            <span className="text-xs text-mute font-bold">Hal {page + 1} / {pages}</span>
            <Button variant="ghost" size="sm" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>Berikutnya <IChevronRight size={14} /></Button>
          </div>
        )}
      </div>

      <TxDrawer id={openId} onClose={closeDrawer} />
    </div>
  );
}

function TxDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { state, dispatch } = useStore();
  const { can } = useAuth();
  const { push } = useToast();
  const [confirm, setConfirm] = useState(false);
  const tx: Transaction | undefined = state.transactions.find((t) => t.id === id);
  const member = tx ? state.customers.find((c) => c.id === tx.customerId) ?? null : null;
  const allowRefund = can("tx.refund");

  const refund = () => {
    if (!tx || !allowRefund) return;
    dispatch({ type: "SET_TX_STATUS", id: tx.id, status: "Refund" });
    sfx.remove();
    push({
      msg: `${tx.id} di-refund · stok & poin dikembalikan`, type: "info", actionLabel: "Urungkan",
      onAction: () => dispatch({ type: "SET_TX_STATUS", id: tx.id, status: "Selesai" }),
    });
  };

  return (
    <>
      <Drawer open={!!id && !!tx} onClose={onClose} title={<span className="font-mono">{tx?.id ?? "Transaksi"}</span>}
        footer={tx && (
          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={() => window.print()}><IPrint size={16} /> Cetak Struk</Button>
            {allowRefund ? (
              tx.status === "Selesai"
                ? <Button variant="danger" className="flex-1" onClick={() => setConfirm(true)}><IUndo size={16} /> Refund</Button>
                : <Button variant="soft" className="flex-1" onClick={() => { dispatch({ type: "SET_TX_STATUS", id: tx.id, status: "Selesai" }); push({ msg: "Refund dibatalkan", type: "ok" }); sfx.tap(); }}>Batalkan Refund</Button>
            ) : (
              <Button variant="ghost" className="flex-1" disabled><IShield size={16} /> Refund: admin</Button>
            )}
          </div>
        )}>
        {tx && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge color={tx.status === "Selesai" ? "var(--pandan)" : "var(--chili)"}>{tx.status}</Badge>
              <Badge color={METHOD_COLORS[tx.method]}>{tx.method}</Badge>
              {tx.discount > 0 && <Badge color="var(--amber)">Diskon {rupiah(tx.discount)}</Badge>}
              {tx.memberNo && <Badge color="var(--violet)"><IHeart size={10} /> {tx.memberNo}</Badge>}
              {(tx.memberPoints ?? 0) > 0 && <Badge color="var(--violet)">+{tx.memberPoints} poin</Badge>}
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl border border-line bg-surface p-3"><p className="text-faint text-[10px] font-bold uppercase">Waktu</p><p className="font-bold mt-0.5">{dateID(tx.ts)} · {timeID(tx.ts)}</p></div>
              <div className="rounded-xl border border-line bg-surface p-3"><p className="text-faint text-[10px] font-bold uppercase">Kasir</p><p className="font-bold mt-0.5">{tx.cashier}</p></div>
              <div className="rounded-xl border border-line bg-surface p-3"><p className="text-faint text-[10px] font-bold uppercase">Pelanggan</p><p className="font-bold mt-0.5 truncate">{tx.customerName}</p></div>
              <div className="rounded-xl border border-line bg-surface p-3"><p className="text-faint text-[10px] font-bold uppercase">Total</p><p className="font-bold mt-0.5 text-accent">{rupiah(tx.total)}</p></div>
            </div>
            <Receipt tx={tx} settings={state.settings} member={member} />
            {tx.status === "Refund" && <p className="text-[11px] text-amber text-center">Transaksi ini di-refund — stok, poin, dan kunjungan member sudah dikembalikan.</p>}
          </div>
        )}
      </Drawer>
      <Confirm open={confirm} onClose={() => setConfirm(false)} onConfirm={refund}
        title="Refund transaksi ini?" confirmLabel="Ya, Refund"
        desc={`${tx?.id ?? ""} senilai ${tx ? rupiah(tx.total) : ""} akan ditandai refund. Stok item, poin member, dan kunjungan dikembalikan otomatis dan bisa diurungkan lewat notifikasi.`} />
    </>
  );
}