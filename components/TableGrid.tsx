"use client";

import type { DiningTable } from "@/lib/types";
import { groupTablesByArea, tableStats, tableTone } from "@/lib/tables";
import { timeID } from "@/lib/format";
import { Badge } from "./ui";
import { ICheckCircle, IInfo, IUser } from "./icons";

/** Satu kartu meja dengan ilustrasi kursi mengelilingi meja. */
function TableCard({
  t,
  selected = false,
  selectable = false,
  onSelect,
}: {
  t: DiningTable;
  selected?: boolean;
  selectable?: boolean;
  onSelect?: (id: string) => void;
}) {
  const busy = t.status === "terisi";
  const tone = tableTone(t.status);
  const clickable = selectable && !busy && t.active;
  const seats = Math.max(1, Math.min(t.seats, 8));

  const inner = (
    <>
      <span
        className="relative w-16 h-16 rounded-full grid place-items-center font-display font-bold text-sm shrink-0"
        style={{
          color: tone,
          background: `color-mix(in srgb, ${tone} 14%, var(--surface))`,
          border: `2px solid color-mix(in srgb, ${tone} 55%, transparent)`,
        }}
      >
        {t.label}
        {Array.from({ length: seats }).map((_, i) => {
          const ang = (i / seats) * Math.PI * 2 - Math.PI / 2;
          const x = 50 + 46 * Math.cos(ang);
          const y = 50 + 46 * Math.sin(ang);
          return (
            <span
              key={i}
              className="absolute w-2 h-2 rounded-full"
              style={{ left: `${x}%`, top: `${y}%`, transform: "translate(-50%,-50%)", background: tone }}
            />
          );
        })}
      </span>

      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-mute mt-2">
        <IUser size={11} /> {t.seats} kursi
      </span>

      <Badge color={tone}>{busy ? "Terisi" : "Kosong"}</Badge>

      {busy && t.customerName ? (
        <span className="block text-[9px] text-faint truncate max-w-full mt-1">
          {t.customerName}{t.occupiedAt ? ` · ${timeID(t.occupiedAt)}` : ""}
        </span>
      ) : (
        <span className="block text-[9px] text-faint mt-1">{t.area}</span>
      )}

      {selected && (
        <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full grid place-items-center grad-accent text-accent-ink">
          <ICheckCircle size={12} />
        </span>
      )}
    </>
  );

  const cls = `relative rounded-2xl border p-3 flex flex-col items-center text-center transition-all ${
    clickable ? "hover:-translate-y-0.5 hover:border-accent cursor-pointer" : ""
  } ${selected ? "ring-2 ring-accent" : ""} ${selectable && busy ? "opacity-55 cursor-not-allowed" : ""}`;
  const style = {
    borderColor: selected ? "var(--accent)" : `color-mix(in srgb, ${tone} 32%, transparent)`,
    background: `linear-gradient(160deg, color-mix(in srgb, ${tone} 7%, var(--surface)), var(--surface) 65%)`,
  };

  if (selectable) {
    return (
      <button type="button" disabled={!clickable} onClick={() => clickable && onSelect?.(t.id)} className={cls} style={style}>
        {inner}
      </button>
    );
  }
  return (
    <div className={cls} style={style}>
      {inner}
    </div>
  );
}

/**
 * Denah meja.
 * - selectable: mode pilih meja di kasir (meja kosong bisa diklik).
 * - tanpa selectable: tampilan pemantauan (member / portal / overview kasir).
 */
export function TableGrid({
  tables,
  selectedId = null,
  onSelect,
  selectable = false,
}: {
  tables: DiningTable[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  selectable?: boolean;
}) {
  const active = tables.filter((t) => t.active);
  const stats = tableStats(tables);
  const groups = groupTablesByArea(active);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge color="var(--pandan)"><ICheckCircle size={10} /> {stats.free} kosong</Badge>
        <Badge color="var(--chili)">{stats.busy} terisi</Badge>
        <Badge color="var(--accent)">{stats.total} meja · {stats.seats} kursi</Badge>
        <span className="ml-auto inline-flex items-center gap-3 text-[10px] text-faint">
          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: "var(--pandan)" }} /> Kosong</span>
          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: "var(--chili)" }} /> Terisi</span>
        </span>
      </div>

      {active.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface p-6 text-center text-sm text-mute">
          Belum ada meja aktif. Administrator dapat menambahkannya di halaman Member → Meja.
        </div>
      ) : (
        groups.map((g) => (
          <div key={g.area}>
            <p className="text-[11px] font-bold uppercase tracking-widest text-faint mb-2">{g.area}</p>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2.5">
              {g.tables.map((t) => (
                <TableCard key={t.id} t={t} selectable={selectable} selected={selectedId === t.id} onSelect={onSelect} />
              ))}
            </div>
          </div>
        ))
      )}

      {selectable && (
        <p className="text-[11px] text-faint flex gap-1.5">
          <IInfo size={12} className="shrink-0 mt-0.5" />
          Hanya meja <b className="text-ink">kosong</b> yang bisa dipilih. Meja otomatis terisi setelah pembayaran selesai.
        </p>
      )}
    </div>
  );
}