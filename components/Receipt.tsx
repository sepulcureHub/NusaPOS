"use client";

import type { Transaction, Settings, Customer } from "@/lib/types";
import { rupiah, timeID, hashStr } from "@/lib/format";
import { itemSavings } from "@/lib/pricing";
import { rng } from "@/lib/seed";
import { BrandMark } from "./Brand";

function Barcode({ seed }: { seed: string }) {
  const r = rng(hashStr(seed));
  const bars: { x: number; w: number }[] = [];
  let x = 0;
  for (let i = 0; i < 34; i++) {
    const w = 1 + Math.floor(r() * 3);
    bars.push({ x, w });
    x += w + 1 + Math.floor(r() * 2);
  }
  return (
    <svg viewBox={`0 0 ${x} 30`} className="w-full h-8" preserveAspectRatio="none" aria-hidden>
      {bars.map((b, i) => <rect key={i} x={b.x} y="0" width={b.w} height="30" fill="#111" />)}
    </svg>
  );
}

const Row = ({ l, r, bold }: { l: string; r: string; bold?: boolean }) => (
  <div className={`flex justify-between gap-2 ${bold ? "font-bold text-[13px]" : ""}`}>
    <span>{l}</span><span className="text-right">{r}</span>
  </div>
);

export function Receipt({ tx, settings, print = true, member }: {
  tx: Transaction; settings: Settings; print?: boolean; member?: Customer | null;
}) {
  const d = new Date(tx.ts);
  const productSavings = tx.items.reduce((a, i) => a + itemSavings(i), 0);
  const totalSavings = productSavings + tx.discount + (tx.memberDiscount ?? 0);

  return (
    <div className={`${print ? "print-area" : ""} receipt mx-auto w-full max-w-[300px] bg-white text-neutral-900 font-mono text-[11.5px] leading-relaxed rounded-lg p-4 shadow-inner`}>
      <div className="text-center">
        {settings.logo && (
          <div className="flex justify-center mb-2"><BrandMark settings={settings} size={44} plate={false} /></div>
        )}
        <p className="font-bold text-[14px] uppercase tracking-wide">{settings.storeName}</p>
        <p className="text-[10px]">{settings.tagline}</p>
        <p className="text-[10px]">{settings.address}</p>
        <p className="text-[10px]">Telp {settings.phone}</p>
      </div>
      <div className="border-t border-dashed border-neutral-400 my-2" />
      <Row l="No" r={tx.id} />
      <Row l="Tanggal" r={d.toLocaleDateString("id-ID")} />
      <Row l="Jam" r={timeID(tx.ts)} />
      <Row l="Kasir" r={tx.cashier} />
      <Row l="Pelanggan" r={tx.customerName} />
      {tx.memberNo && <Row l="Member" r={`${tx.memberNo}${tx.memberTier ? ` (${tx.memberTier})` : ""}`} />}
      {tx.status === "Refund" && <p className="text-center font-bold mt-1">*** REFUND ***</p>}
      <div className="border-t border-dashed border-neutral-400 my-2" />
      {tx.items.map((i, k) => {
        const cut = itemSavings(i);
        return (
          <div key={k} className="mb-1.5">
            <p className="break-words">{i.kind === "bundle" ? "[PAKET] " : ""}{i.name}</p>
            <div className="flex justify-between">
              <span>{i.qty} x {rupiah(i.price)}</span>
              <span>{rupiah(i.price * i.qty)}</span>
            </div>
            {cut > 0 && <p className="text-[10px]">  promo: hemat {rupiah(cut)}</p>}
            {i.components?.map((c, ci) => (
              <p key={ci} className="text-[10px] text-neutral-600">  - {c.qty * i.qty}x {c.name}</p>
            ))}
          </div>
        );
      })}
      <div className="border-t border-dashed border-neutral-400 my-2" />
      <Row l="Subtotal" r={rupiah(tx.subtotal)} />
      {tx.discount > 0 && <Row l="Diskon transaksi" r={`-${rupiah(tx.discount)}`} />}
      {(tx.memberDiscount ?? 0) > 0 && <Row l="Potongan member" r={`-${rupiah(tx.memberDiscount ?? 0)}`} />}
      {tx.tax > 0 && <Row l={`PPN ${settings.taxPct}%`} r={rupiah(tx.tax)} />}
      {tx.service > 0 && <Row l={`Service ${settings.servicePct}%`} r={rupiah(tx.service)} />}
      <Row l="TOTAL" r={rupiah(tx.total)} bold />
      <Row l={tx.method} r={rupiah(tx.tendered)} />
      {tx.method === "Tunai" && <Row l="Kembali" r={rupiah(tx.change)} />}
      {totalSavings > 0 && (
        <>
          <div className="border-t border-dashed border-neutral-400 my-2" />
          <Row l="Total hemat" r={rupiah(totalSavings)} bold />
        </>
      )}
      {tx.memberNo && (
        <>
          <div className="border-t border-dashed border-neutral-400 my-2" />
          <Row l="Poin didapat" r={`+${tx.memberPoints ?? 0}`} />
          {member && <Row l="Total poin" r={`${member.points ?? 0}`} />}
          <p className="text-center text-[9.5px] mt-1">Tukar poin & naik tier otomatis</p>
        </>
      )}
      <div className="border-t border-dashed border-neutral-400 my-2" />
      <p className="text-center text-[10px] whitespace-pre-wrap">{settings.receiptFooter}</p>
      <div className="mt-3"><Barcode seed={tx.id} /></div>
      <p className="text-center text-[9px] mt-1 tracking-widest">{tx.id}</p>
      <p className="text-center text-[9px] mt-2 text-neutral-500">Powered by {settings.brandName}</p>
    </div>
  );
}