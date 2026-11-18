"use client";

import { IInfo, IShield } from "./icons";

export function KasirTestBanner() {
  return (
    <div
      className="rounded-2xl border p-4 flex flex-wrap items-start gap-3"
      style={{
        borderColor: "color-mix(in srgb, var(--amber) 42%, transparent)",
        background: "color-mix(in srgb, var(--amber) 9%, transparent)",
      }}
    >
      <span
        className="w-10 h-10 rounded-xl grid place-items-center shrink-0"
        style={{ color: "var(--amber)", background: "color-mix(in srgb, var(--amber) 16%, transparent)" }}
      >
        <IShield size={19} />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold" style={{ color: "var(--amber)" }}>
          Mode uji admin — transaksi tidak dicatat
        </p>
        <p className="text-[11.5px] text-mute mt-1 leading-relaxed">
          Halaman kasir ini untuk menguji alur pembayaran, struk, member, promo, dan QRIS.
          Transaksi yang dibuat admin <b className="text-ink">tidak menambah riwayat transaksi, stok, omzet, poin member, maupun shift</b>.
        </p>
      </div>

      <span className="inline-flex items-center gap-1.5 rounded-full border border-line2 bg-surface px-2.5 py-1 text-[10px] font-bold text-faint shrink-0">
        <IInfo size={11} /> TEST MODE
      </span>
    </div>
  );
}