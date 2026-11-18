"use client";

import { useState } from "react";
import { IQR } from "./icons";
import { rupiah } from "@/lib/format";

export function QRISCenter({
  amount,
  storeName,
  src,
}: {
  amount: number;
  storeName: string;
  src?: string;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <div className="w-full flex flex-col items-center justify-center gap-3 py-2">
      <div
        className="relative w-44 h-44 md:w-52 md:h-52 rounded-[28px] bg-white p-3 grid place-items-center border border-line"
        style={{ boxShadow: "0 22px 55px -28px rgba(0,0,0,.65)" }}
      >
        {src && !failed ? (
          <img
            src={src}
            alt="Logo QRIS"
            className="max-w-full max-h-full object-contain"
            loading="lazy"
            onError={() => setFailed(true)}
          />
        ) : (
          <div className="text-ink">
            <IQR size={96} />
          </div>
        )}
      </div>

      <div className="text-center">
        <p className="text-[10px] font-bold uppercase tracking-widest text-faint">
          Scan untuk bayar QRIS
        </p>
        <p className="font-display font-bold text-2xl mt-1 tabular-nums">
          {rupiah(amount)}
        </p>
        <p className="text-[11px] text-mute mt-0.5">{storeName}</p>
      </div>
    </div>
  );
}