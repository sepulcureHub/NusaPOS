"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/store";
import { useToast } from "@/components/Toasts";
import { Button, Field, Input, Modal } from "@/components/ui";
import { closeShift, getMyShift, openShift, type LiveShift } from "@/app/actions/shift";
import { rupiah, timeID } from "@/lib/format";

const LIVE = process.env.NEXT_PUBLIC_DATA_MODE === "live";

/** LIVE: kasir wajib buka shift (dijaga RPC) sebelum POS bisa dipakai. */
export function LiveShiftGate({ children }: { children: ReactNode }) {
  const { user, isAdmin } = useAuth();
  const { push } = useToast();
  const [checked, setChecked] = useState(!LIVE);
  const [shift, setShift] = useState<LiveShift | null>(null);
  const [opening, setOpening] = useState("100000");
  const [busy, setBusy] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [closing, setClosing] = useState("");
  const [closeNote, setCloseNote] = useState("");

  const refresh = useCallback(async () => {
    const res = await getMyShift();
    setChecked(true);
    if (res.ok) setShift(res.shift ?? null);
    else push({ msg: res.error ?? "Gagal memuat shift", type: "err" });
  }, [push]);

  useEffect(() => {
    if (LIVE && user && !isAdmin) void refresh();
    else setChecked(true);
  }, [user, isAdmin, refresh]);

  if (!LIVE || !user || isAdmin) return <>{children}</>;

  if (!checked) {
    return (
      <div className="p-6 space-y-3">
        <div className="h-8 w-56 rounded-xl bg-surface animate-pulse" />
        <div className="h-40 rounded-2xl bg-surface animate-pulse" />
      </div>
    );
  }

  const doOpen = async () => {
    const v = Math.round(Number(opening));
    if (!Number.isFinite(v) || v < 0) {
      push({ msg: "Modal awal tidak valid", type: "err" });
      return;
    }
    setBusy(true);
    const res = await openShift(v);
    setBusy(false);
    if (res.ok && res.shift) {
      setShift(res.shift);
      push({ msg: "Shift dibuka — selamat berjualan!", type: "ok" });
    } else {
      push({ msg: res.error ?? "Gagal membuka shift", type: "err" });
    }
  };

  const doClose = async () => {
    if (!shift) return;
    const v = Math.round(Number(closing));
    if (!Number.isFinite(v) || v < 0) {
      push({ msg: "Kas penutupan tidak valid", type: "err" });
      return;
    }
    setBusy(true);
    const res = await closeShift(shift.id, v, closeNote);
    setBusy(false);
    if (res.ok) {
      push({
        msg: `Shift ditutup. Kas seharusnya ${rupiah(res.expectedCash ?? 0)} · selisih ${rupiah(res.variance ?? 0)}`,
        type: (res.variance ?? 0) === 0 ? "ok" : "info",
        dur: 8000,
      });
      setShift(null);
      setCloseOpen(false);
      setClosing("");
      setCloseNote("");
    } else {
      push({ msg: res.error ?? "Gagal menutup shift", type: "err" });
    }
  };

  if (!shift) {
    return (
      <div className="min-h-[60vh] grid place-items-center p-6">
        <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6">
          <h2 className="text-lg font-extrabold">Buka Shift Kasir</h2>
          <p className="text-xs text-mute mt-1 leading-relaxed">
            Mode LIVE: penjualan tercatat ke database dan wajib terikat shift aktif.
            Masukkan modal awal laci kas untuk mulai.
          </p>
          <div className="mt-4">
            <Field label="Modal awal laci kas (Rp)">
              <Input
                type="number" min={0} inputMode="numeric"
                value={opening}
                onChange={(e) => setOpening(e.target.value)}
              />
            </Field>
          </div>
          <Button className="w-full mt-4" disabled={busy} onClick={doOpen}>
            {busy ? "Membuka…" : "Buka Shift"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mx-4 mt-3 rounded-xl border border-line bg-surface px-4 py-2.5 flex items-center gap-3 flex-wrap">
        <span className="text-xs font-bold" style={{ color: "var(--pandan)" }}>
          ● SHIFT AKTIF
        </span>
        <span className="text-[11px] text-mute">
          Buka {timeID(shift.openedAt)} · modal {rupiah(shift.openingCash)}
        </span>
        <Button size="sm" variant="soft" className="ml-auto" onClick={() => setCloseOpen(true)}>
          Tutup Shift
        </Button>
      </div>
      {children}
      <Modal open={closeOpen} onClose={() => setCloseOpen(false)} title="Tutup Shift">
        <div className="space-y-4">
          <Field label="Uang kas di laci saat penutupan (Rp)">
            <Input
              type="number" min={0} inputMode="numeric"
              value={closing}
              onChange={(e) => setClosing(e.target.value)}
            />
          </Field>
          <Field label="Catatan (opsional)">
            <Input
              value={closeNote} maxLength={200}
              onChange={(e) => setCloseNote(e.target.value)}
            />
          </Field>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setCloseOpen(false)}>Batal</Button>
            <Button variant="danger" disabled={busy} onClick={doClose}>
              {busy ? "Menutup…" : "Tutup & Rekonsiliasi"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}