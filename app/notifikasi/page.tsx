"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth, useStore } from "@/lib/store";
import { useToast } from "@/components/Toasts";
import { sfx } from "@/lib/sound";
import type { AppNotification, NotifKind } from "@/lib/types";
import { dateID, relTime, timeID } from "@/lib/format";
import { SearchField } from "@/components/SearchField";
import { Badge, Button, EmptyState, PageSkel, Segmented, Select } from "@/components/ui";
import {
  IAlert, IBell, IBox, ICheckCircle, IClock, IGear, IHeart, IInfo,
  IReceipt, IRegister, IShield, IStar, ITrash, IUser, IUsers,
} from "@/components/icons";

const KIND_META: Record<NotifKind, { label: string; color: string; icon: React.ReactNode }> = {
  auth: { label: "Akses", color: "var(--accent)", icon: <IShield size={14} /> },
  sale: { label: "Penjualan", color: "var(--pandan)", icon: <IReceipt size={14} /> },
  refund: { label: "Refund", color: "var(--chili)", icon: <IReceipt size={14} /> },
  product: { label: "Produk", color: "var(--amber)", icon: <IBox size={14} /> },
  stock: { label: "Stok", color: "var(--amber)", icon: <IBox size={14} /> },
  member: { label: "Member", color: "var(--violet)", icon: <IHeart size={14} /> },
  points: { label: "Poin", color: "var(--violet)", icon: <IStar size={14} /> },
  reward: { label: "Hadiah", color: "var(--violet)", icon: <IStar size={14} /> },
  shift: { label: "Shift", color: "var(--laut)", icon: <IClock size={14} /> },
  settings: { label: "Pengaturan", color: "var(--muted)", icon: <IGear size={14} /> },
  user: { label: "Pengguna", color: "var(--magenta)", icon: <IUsers size={14} /> },
  view: { label: "Tampilan", color: "var(--muted)", icon: <IRegister size={14} /> },
  data: { label: "Data", color: "var(--chili)", icon: <IAlert size={14} /> },
  system: { label: "Sistem", color: "var(--muted)", icon: <IInfo size={14} /> },
};

const KIND_OPTIONS = [
  { v: "all", l: "Semua jenis" },
  ...Object.entries(KIND_META).map(([v, m]) => ({ v, l: m.label })),
];

export default function NotifikasiPage() {
  const { state, dispatch } = useStore();
  const { isAdmin } = useAuth();
  const { push } = useToast();
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("all");
  const [range, setRange] = useState("all");

  useEffect(() => {
    if (state.hydrated) dispatch({ type: "SET_NOTIF_READ", ts: Date.now() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.hydrated]);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const minTs = range === "today"
      ? new Date(new Date().setHours(0, 0, 0, 0)).getTime()
      : range === "7" ? Date.now() - 6 * 86400000
        : range === "30" ? Date.now() - 29 * 86400000 : 0;
    return state.notifications.filter((n) =>
      n.ts >= minTs &&
      (kind === "all" || n.kind === kind) &&
      (!needle || n.title.toLowerCase().includes(needle) || (n.detail ?? "").toLowerCase().includes(needle) || (n.actor ?? "").toLowerCase().includes(needle))
    );
  }, [state.notifications, q, kind, range]);

  const counts = useMemo(() => {
    const m = new Map<NotifKind, number>();
    state.notifications.forEach((n) => m.set(n.kind, (m.get(n.kind) ?? 0) + 1));
    return m;
  }, [state.notifications]);

  const groupByDay = (items: AppNotification[]) => {
    const groups = new Map<string, AppNotification[]>();
    items.forEach((n) => {
      const k = dateID(n.ts);
      const arr = groups.get(k) ?? [];
      arr.push(n);
      groups.set(k, arr);
    });
    return [...groups.entries()];
  };

  /* Guard SETELAH semua hook — Rules of Hooks. */
  if (!state.hydrated) return <PageSkel />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3 rise">
        <div>
          <h1 className="font-display font-bold text-2xl flex items-center gap-2">
            <IBell size={22} className="text-accent" /> Notifikasi Sistem
          </h1>
          <p className="text-sm text-mute mt-0.5">
            Mencatat seluruh perubahan & aktivitas: penjualan, refund, member, poin, shift, produk, pengaturan, pengguna, dan akses.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdmin && (
            <Button variant="danger" size="sm" disabled={!state.notifications.length}
              onClick={() => { dispatch({ type: "CLEAR_NOTIFS" }); sfx.remove(); push({ msg: "Semua notifikasi dibersihkan", type: "info" }); }}>
              <ITrash size={14} /> Bersihkan semua
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 lg:grid-cols-6 gap-2">
        {[
          { l: "Total log", v: state.notifications.length, c: "var(--accent)" },
          { l: "Penjualan", v: counts.get("sale") ?? 0, c: "var(--pandan)" },
          { l: "Member & poin", v: (counts.get("member") ?? 0) + (counts.get("points") ?? 0) + (counts.get("reward") ?? 0), c: "var(--violet)" },
          { l: "Shift", v: counts.get("shift") ?? 0, c: "var(--laut)" },
          { l: "Produk & stok", v: (counts.get("product") ?? 0) + (counts.get("stock") ?? 0), c: "var(--amber)" },
          { l: "Akses & pengguna", v: (counts.get("auth") ?? 0) + (counts.get("user") ?? 0), c: "var(--magenta)" },
        ].map((x) => (
          <div key={x.l} className="card p-3.5">
            <p className="text-[10px] text-faint font-bold uppercase tracking-wider">{x.l}</p>
            <p className="font-display font-bold text-2xl mt-1 tabular-nums" style={{ color: x.c }}>{num0(x.v)}</p>
          </div>
        ))}
      </div>

      <div className="card p-4 space-y-3 rise" style={{ animationDelay: "60ms" }}>
        <SearchField value={q} onChange={setQ} size="md" shortcut="/" count={list.length} countLabel="log"
          ariaLabel="Cari notifikasi" placeholder="Cari judul, detail, atau nama pengguna…" onEscape={() => setQ("")} />
        <div className="flex flex-wrap items-center gap-2">
          <Segmented value={range} onChange={setRange}
            options={[{ v: "today", l: "Hari ini" }, { v: "7", l: "7 hari" }, { v: "30", l: "30 hari" }, { v: "all", l: "Semua" }]} />
          <Select label="Jenis" value={kind} onChange={setKind} className="w-44" options={KIND_OPTIONS} />
          <span className="ml-auto text-[11px] text-faint">{list.length} dari {state.notifications.length} log</span>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="card">
          <EmptyState emoji="🔔" title="Belum ada notifikasi yang cocok"
            desc={state.notifications.length === 0 ? "Aktivitas sistem akan tercatat otomatis di sini." : "Coba longgarkan filter atau kata kunci."} />
        </div>
      ) : (
        <div className="space-y-4">
          {groupByDay(list).map(([day, items]) => (
            <div key={day} className="card overflow-hidden rise">
              <div className="px-4 py-2.5 border-b border-line bg-surface2/60 flex items-center gap-2">
                <ICheckCircle size={13} className="text-accent" />
                <span className="text-xs font-bold">{day}</span>
                <span className="ml-auto text-[10px] text-faint">{items.length} aktivitas</span>
              </div>
              <ul className="divide-y divide-line">
                {items.map((n) => {
                  const meta = KIND_META[n.kind] ?? KIND_META.system;
                  return (
                    <li key={n.id} className="px-4 py-3 flex items-start gap-3 hover:bg-surface2/50 transition-colors">
                      <span className="w-8 h-8 rounded-lg grid place-items-center shrink-0 mt-0.5"
                        style={{ color: meta.color, background: `color-mix(in srgb, ${meta.color} 14%, transparent)` }}>
                        {meta.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-bold leading-tight">{n.title}</p>
                        {n.detail && <p className="text-[11px] text-mute mt-0.5 leading-snug">{n.detail}</p>}
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5">
                          <Badge color={meta.color}>{meta.label}</Badge>
                          {n.actor && <span className="inline-flex items-center gap-1 text-[10px] text-faint"><IUser size={10} /> {n.actor}</span>}
                          <span className="text-[10px] text-faint ml-auto">{relTime(n.ts)} · {timeID(n.ts)}</span>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function num0(n: number) {
  return Math.round(n).toLocaleString("id-ID");
}