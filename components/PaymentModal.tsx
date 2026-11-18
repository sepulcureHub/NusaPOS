"use client";

import { useEffect, useRef, useState } from "react";
import type { PayMethod, Settings, Transaction, TxItem } from "@/lib/types";
import { DEMO_EDC } from "@/lib/demo-data";
import { hashStr, rupiah } from "@/lib/format";
import { rng } from "@/lib/seed";
import { Badge, Button, Modal, Segmented } from "./ui";
import { Receipt } from "./Receipt";
import { ICard, ICash, ICheck, IPrint, IQR, IX } from "./icons";

type Totals = { subtotal: number; discount: number; tax: number; service: number; total: number };

function FakeQR({ seed }: { seed: string }) {
  const r = rng(hashStr(seed));
  const n = 25, c = 4, m = 8;
  const grid: boolean[][] = Array.from({ length: n }, () => Array.from({ length: n }, () => r() < 0.44));
  const finder = (fx: number, fy: number) => {
    for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) {
      const ring = x === 0 || x === 6 || y === 0 || y === 6;
      const core = x >= 2 && x <= 4 && y >= 2 && y <= 4;
      grid[fy + y][fx + x] = ring || core;
    }
    for (let y = -1; y <= 7; y++) for (let x = -1; x <= 7; x++) {
      const gy = fy + y, gx = fx + x;
      if (gy >= 0 && gy < n && gx >= 0 && gx < n && (x === -1 || x === 7 || y === -1 || y === 7)) grid[gy][gx] = false;
    }
  };
  finder(0, 0); finder(n - 7, 0); finder(0, n - 7);
  return (
    <svg viewBox={`0 0 ${n * c + m * 2} ${n * c + m * 2}`} className="w-44 h-44 rounded-xl bg-white p-0 shadow-lg" aria-label="QRIS simulasi">
      <rect width="100%" height="100%" fill="#fff" />
      {grid.map((row, y) => row.map((v, x) => v ? <rect key={`${x}-${y}`} x={m + x * c} y={m + y * c} width={c} height={c} fill="#111" /> : null))}
      <rect x={m + 10 * c} y={m + 10 * c} width={5 * c} height={5 * c} rx="3" fill="var(--accent2)" />
      <text x={m + 12.5 * c} y={m + 13.6 * c} textAnchor="middle" fontSize="11" fontWeight="bold" fill="#fff">N</text>
    </svg>
  );
}

const PARTICLE_COLORS = ["var(--accent)", "var(--amber)", "var(--chili)", "var(--laut)", "var(--magenta)", "var(--pandan)"];

export function PaymentModal({ open, onClose, items, totals, customerName, settings, lastTx, onConfirm }: {
  open: boolean; onClose: () => void; items: TxItem[]; totals: Totals; customerName: string;
  settings: Settings; lastTx: Transaction | null;
  onConfirm: (method: PayMethod, tendered: number) => void;
}) {
  const [method, setMethod] = useState<PayMethod>("Tunai");
  const [amount, setAmount] = useState("");
  const [processing, setProcessing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const done = !!lastTx;
  const tendered = parseInt(amount || "0", 10) || 0;
  const change = tendered - totals.total;

  useEffect(() => {
    if (open) { setAmount(""); setProcessing(false); }
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [open]);

  const simulate = (m: PayMethod) => {
    setProcessing(true);
    timer.current = setTimeout(() => { setProcessing(false); onConfirm(m, totals.total); }, 1200);
  };

  useEffect(() => {
    if (!open || done || method !== "Tunai") return;
    const h = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) setAmount((a) => (a + e.key).slice(0, 9));
      else if (e.key === "Backspace") setAmount((a) => a.slice(0, -1));
      else if (e.key === "Enter" && tendered >= totals.total) onConfirm("Tunai", tendered);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, done, method, tendered, totals.total, onConfirm]);

  const quick = [...new Set([totals.total, Math.ceil(totals.total / 5000) * 5000, 20000, 50000, 100000])].filter((v) => v > 0);
  const itemCount = items.reduce((a, i) => a + i.qty, 0);

  return (
    <Modal open={open} onClose={onClose} wide title={done ? "Pembayaran Berhasil" : "Pembayaran"}
      footer={done ? (
        <div className="flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={() => window.print()}><IPrint size={16} /> Cetak Struk</Button>
          <Button className="flex-1" onClick={onClose}><ICheck size={16} /> Transaksi Baru</Button>
        </div>
      ) : method === "Tunai" ? (
        <Button className="w-full" disabled={tendered < totals.total} onClick={() => onConfirm("Tunai", tendered)}>
          <ICash size={17} /> Konfirmasi Bayar {change >= 0 && amount ? `• Kembali ${rupiah(change)}` : ""}
        </Button>
      ) : (
        <p className="text-center text-xs text-faint">{processing ? "Memproses pembayaran…" : "Selesaikan pembayaran di atas"}</p>
      )}>
      {done && lastTx ? (
        <div className="space-y-4">
          <div className="text-center relative py-2">
            <div className="relative inline-grid place-items-center w-16 h-16 rounded-full check-pop"
              style={{ background: "color-mix(in srgb, var(--pandan) 18%, transparent)", color: "var(--pandan)" }}>
              <ICheck size={30} strokeWidth={2.4} />
              {Array.from({ length: 14 }).map((_, i) => {
                const a = (i / 14) * Math.PI * 2;
                const dist = 58 + (i % 3) * 22;
                return <i key={i} className="particle" style={{
                  ["--dx" as string]: `${Math.cos(a) * dist}px`, ["--dy" as string]: `${Math.sin(a) * dist}px`,
                  ["--c" as string]: PARTICLE_COLORS[i % 6], animationDelay: `${i * 18}ms`,
                }} />;
              })}
            </div>
            <p className="font-display font-bold text-lg mt-3">{rupiah(lastTx.total)} diterima</p>
            <p className="text-xs text-mute">{lastTx.method} • {lastTx.id} • {lastTx.customerName}</p>
            {lastTx.method === "Tunai" && lastTx.change > 0 && (
              <p className="mt-2 inline-block rounded-xl px-4 py-2 font-display font-bold text-amber" style={{ background: "color-mix(in srgb, var(--amber) 14%, transparent)" }}>
                Kembalian {rupiah(lastTx.change)}
              </p>
            )}
          </div>
          <div className="max-h-[300px] overflow-y-auto rounded-xl"><Receipt tx={lastTx} settings={settings} /></div>
          <p className="text-center text-[11px] text-faint">Struk otomatis tersimpan di menu Transaksi</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-line bg-surface p-4 text-center">
            <p className="text-[11px] font-bold text-faint uppercase tracking-wider">Total Tagihan • {itemCount} item • {customerName}</p>
            <p className="font-display font-bold text-3xl text-accent mt-1 tabular-nums">{rupiah(totals.total)}</p>
            {(totals.discount > 0 || totals.tax > 0 || totals.service > 0) && (
              <p className="text-[11px] text-mute mt-1">
                Subtotal {rupiah(totals.subtotal)}
                {totals.discount > 0 && ` − diskon ${rupiah(totals.discount)}`}
                {totals.tax > 0 && ` + PPN ${rupiah(totals.tax)}`}
                {totals.service > 0 && ` + service ${rupiah(totals.service)}`}
              </p>
            )}
          </div>

          <Segmented className="w-full justify-center" value={method} onChange={(v) => { setMethod(v as PayMethod); setProcessing(false); }}
            options={[
              { v: "Tunai", l: <><ICash size={14} /> Tunai</> },
              { v: "QRIS", l: <><IQR size={14} /> QRIS</> },
              { v: "Kartu", l: <><ICard size={14} /> Kartu</> },
            ]} />

          {method === "Tunai" && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {quick.map((v) => (
                  <button key={v} onClick={() => setAmount(String(v))}
                    className={`chip ${tendered === v ? "chip-on" : ""}`}>{v === totals.total ? "Uang Pas" : rupiah(v)}</button>
                ))}
              </div>
              <div className="input flex items-center justify-between py-3">
                <span className="text-xs text-faint font-bold">UANG DITERIMA</span>
                <span className="font-mono font-bold text-xl tabular-nums">{amount ? rupiah(tendered) : "Rp 0"}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9", "00", "0", "⌫"].map((k) => (
                  <button key={k} onClick={() => {
                    if (k === "⌫") setAmount((a) => a.slice(0, -1));
                    else setAmount((a) => String(parseInt((a + k) || "0", 10)).replace(/^0+(?=\d)/, "").slice(0, 9));
                  }}
                    className="rounded-xl border border-line bg-surface py-3 font-mono font-bold text-lg hover:border-accent hover:text-accent active:scale-95 transition-all">
                    {k}
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between text-sm">
                <button onClick={() => setAmount("")} className="text-xs text-faint hover:text-chili inline-flex items-center gap-1"><IX size={12} /> Bersihkan</button>
                <span className={`font-bold ${change >= 0 ? "text-pandan" : "text-chili"}`}>
                  {amount ? (change >= 0 ? `Kembalian ${rupiah(change)}` : `Kurang ${rupiah(-change)}`) : "Masukkan nominal"}
                </span>
              </div>
            </div>
          )}

          {method === "QRIS" && (
            <div className="text-center space-y-3 py-2">
              <FakeQR seed={`${totals.total}-${itemCount}-${settings.brandName}`} />
              <div className="flex items-center justify-center gap-2">
                <Badge color="var(--accent)">QRIS</Badge>
                <Badge color="var(--amber)">Mode Demo — Simulasi</Badge>
              </div>
              <p className="text-xs text-mute">Tunjukkan QR ke pelanggan, lalu konfirmasi setelah dibayar.</p>
              <Button className="w-full" disabled={processing} onClick={() => simulate("QRIS")}>
                {processing ? "Memverifikasi pembayaran…" : "Pelanggan Sudah Bayar (Simulasi)"}
              </Button>
            </div>
          )}

          {method === "Kartu" && (
            <div className="text-center space-y-3 py-2">
              <div className="mx-auto w-64 h-40 rounded-2xl p-4 text-left relative overflow-hidden grad-card">
                <div className="flex justify-between items-start">
                  <ICard size={26} className="text-white/90" />
                  <span className="text-[10px] font-bold text-white/80 tracking-widest">{DEMO_EDC.brand}</span>
                </div>
                <p className="font-mono text-white text-lg mt-6 tracking-widest">{DEMO_EDC.pan}</p>
                <div className="flex justify-between mt-3 text-[10px] text-white/80 font-bold">
                  <span>{DEMO_EDC.label}</span><span>{rupiah(totals.total)}</span>
                </div>
              </div>
              <Badge color="var(--amber)">Mode Demo — Simulasi</Badge>
              <Button className="w-full" disabled={processing} onClick={() => simulate("Kartu")}>
                {processing ? "Menghubungkan ke mesin EDC…" : "Tap / Masukkan Kartu (Simulasi)"}
              </Button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}