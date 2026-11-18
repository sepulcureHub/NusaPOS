import type { Discount, Settings, TxItem } from "./types";

export const rupiah = (n: number) => "Rp " + Math.round(n).toLocaleString("id-ID");
export const num = (n: number) => Math.round(n).toLocaleString("id-ID");

export const compact = (n: number) =>
  n >= 1e9 ? (n / 1e9).toLocaleString("id-ID", { maximumFractionDigits: 1 }) + " M"
  : n >= 1e6 ? (n / 1e6).toLocaleString("id-ID", { maximumFractionDigits: 1 }) + " jt"
  : n >= 1e3 ? Math.round(n / 1e3) + " rb"
  : String(Math.round(n));

export const compactRp = (n: number) => "Rp " + compact(n);

export const pctStr = (n: number) =>
  (n > 0 ? "+" : "") + n.toLocaleString("id-ID", { maximumFractionDigits: 1 }) + "%";

export const timeID = (ts: number) =>
  new Date(ts).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

export const dateID = (ts: number) =>
  new Date(ts).toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" });

export const dateFull = (ts: number) =>
  new Date(ts).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

export const dateShort = (ts: number) =>
  new Date(ts).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });

export const relTime = (ts: number) => {
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return "baru saja";
  if (m < 60) return `${m} mnt lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lalu`;
  return `${Math.floor(h / 24)} hr lalu`;
};

export const startOfDay = (ts: number) => {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

export const dayKey = (ts: number) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

export const uid = () => Math.random().toString(36).slice(2, 10);
export const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));

export function calcTotals(items: TxItem[], disc: Discount, s: Settings, memberPct = 0) {
  const subtotal = items.reduce((a, i) => a + i.price * i.qty, 0);
  const discount = clamp(disc.type === "rp" ? disc.value : Math.round((subtotal * disc.value) / 100), 0, subtotal);
  const afterOrder = subtotal - discount;
  const memberDiscount = clamp(Math.round((afterOrder * clamp(memberPct, 0, 100)) / 100), 0, afterOrder);
  const base = afterOrder - memberDiscount;
  const tax = Math.round((base * s.taxPct) / 100);
  const service = Math.round((base * s.servicePct) / 100);
  return { subtotal, discount, memberDiscount, tax, service, total: base + tax + service };
}

export function nextTxId(txs: { id: string; ts: number }[]) {
  const d = new Date();
  const key = `NP-${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  let seq = txs.filter((t) => dayKey(t.ts) === dayKey(d.getTime())).length + 1;
  let id = `${key}-${String(seq).padStart(3, "0")}`;
  while (txs.some((t) => t.id === id)) { seq++; id = `${key}-${String(seq).padStart(3, "0")}`; }
  return id;
}

export function download(name: string, content: string, type = "text/plain") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/** Sel teks yang diawali = + - @ TAB/CR bisa dieksekusi Excel/Sheets → netralkan. */
const CSV_RISKY = /^[=+\-@\t\r]/;

export function toCSV(rows: (string | number)[][]) {
  return "\uFEFF" + rows
    .map((r) => r.map((c) => {
      let s = String(c ?? "");
      if (typeof c !== "number" && CSV_RISKY.test(s)) s = `'${s}`;
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(","))
    .join("\r\n");
}

export function hashStr(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h >>> 0;
}