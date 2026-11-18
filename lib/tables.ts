import type { DiningTable } from "./types";
import { uid } from "./format";

export const DEFAULT_AREAS = ["Indoor", "Outdoor", "Bar", "VIP"];

export function tableStats(tables: DiningTable[]) {
  const active = tables.filter((t) => t.active);
  const free = active.filter((t) => t.status === "kosong");
  const busy = active.filter((t) => t.status === "terisi");
  return {
    total: active.length,
    free: free.length,
    busy: busy.length,
    seats: active.reduce((a, t) => a + t.seats, 0),
    freeSeats: free.reduce((a, t) => a + t.seats, 0),
  };
}

/** Daftar area unik sesuai urutan kemunculan. */
export function tableAreas(tables: DiningTable[]): string[] {
  const seen: string[] = [];
  tables.forEach((t) => {
    if (!seen.includes(t.area)) seen.push(t.area);
  });
  return seen;
}

export function groupTablesByArea(tables: DiningTable[]): { area: string; tables: DiningTable[] }[] {
  return tableAreas(tables).map((area) => ({ area, tables: tables.filter((t) => t.area === area) }));
}

export function freeTables(tables: DiningTable[]): DiningTable[] {
  return tables.filter((t) => t.active && t.status === "kosong");
}

export function tableTone(status: DiningTable["status"]): string {
  return status === "terisi" ? "var(--chili)" : "var(--pandan)";
}

/** Label meja berikutnya dalam sebuah area, mis. "T07". */
export function nextTableLabel(tables: DiningTable[], area: string): string {
  const prefix = (area || "Meja").charAt(0).toUpperCase();
  const used = new Set(tables.map((t) => t.label.toUpperCase()));
  let n = tables.filter((t) => t.area === area).length + 1;
  let label = `${prefix}${String(n).padStart(2, "0")}`;
  while (used.has(label.toUpperCase())) {
    n++;
    label = `${prefix}${String(n).padStart(2, "0")}`;
  }
  return label;
}

export function makeTable(partial: Partial<DiningTable> & { label: string; area: string }): DiningTable {
  return {
    id: partial.id ?? uid(),
    label: partial.label,
    seats: Math.max(1, Math.min(20, partial.seats ?? 2)),
    area: partial.area,
    status: "kosong",
    active: partial.active !== false,
    txId: null,
    customerName: null,
    occupiedAt: null,
    note: partial.note ?? "",
  };
}