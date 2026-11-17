import type { Role, User } from "./types";

const SALT = "nusapos::auth::v1";

export function hashPassword(pw: string) {
  const s = `${SALT}|${pw}`;
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = (h1 ^ c) >>> 0;
    h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 = (h2 + Math.imul(c + i, 0x85ebca6b)) >>> 0;
    h2 = ((h2 << 13) | (h2 >>> 19)) >>> 0;
  }
  return `${h1.toString(16).padStart(8, "0")}${h2.toString(16).padStart(8, "0")}`;
}

export function verifyPassword(pw: string, hash: string) {
  return hashPassword(pw) === hash;
}

export type Perm =
  | "dashboard"
  | "pos"
  | "products.view" | "products.manage"
  | "tx.view" | "tx.all" | "tx.refund" | "tx.export"
  | "members.view" | "members.manage" | "members.delete" | "members.points"
  | "analytics"
  | "shift.view" | "shift.manage"
  | "settings.self" | "settings.store" | "settings.users" | "data.manage";

/** Kasir hanya mendapat ruang kerja operasional: jualan, member, shift sendiri, struk sendiri. */
export const ROLE_PERMS: Record<Role, Perm[]> = {
  admin: [
    "dashboard", "pos", "products.view", "products.manage",
    "tx.view", "tx.all", "tx.refund", "tx.export",
    "members.view", "members.manage", "members.delete", "members.points",
    "analytics", "shift.view", "shift.manage",
    "settings.self", "settings.store", "settings.users", "data.manage",
  ],
  kasir: [
    "pos",
    "tx.view",
    "members.view", "members.manage",
    "shift.view",
    "settings.self",
  ],
};

export const PERM_LABELS: { perm: Perm; label: string }[] = [
  { perm: "pos", label: "Kasir — jual, tahan order, bayar" },
  { perm: "members.view", label: "Cari & lihat member pelanggan" },
  { perm: "members.manage", label: "Daftarkan & edit member pelanggan" },
  { perm: "shift.view", label: "Shift sendiri — buka, tutup, jadwal & performa" },
  { perm: "tx.view", label: "Lihat transaksi & cetak struk" },
  { perm: "tx.all", label: "Lihat transaksi semua kasir" },
  { perm: "tx.refund", label: "Refund transaksi" },
  { perm: "tx.export", label: "Ekspor laporan CSV" },
  { perm: "members.delete", label: "Hapus member" },
  { perm: "members.points", label: "Sesuaikan poin member" },
  { perm: "products.view", label: "Buka katalog produk" },
  { perm: "products.manage", label: "Tambah / edit / hapus produk & paket" },
  { perm: "dashboard", label: "Dashboard bisnis" },
  { perm: "analytics", label: "Analitik & insight penjualan" },
  { perm: "shift.manage", label: "Jadwal shift semua kasir + buka/tutup paksa" },
  { perm: "settings.self", label: "Tema, suara & password sendiri" },
  { perm: "settings.store", label: "Pengaturan toko, pajak, brand, program member" },
  { perm: "settings.users", label: "Kelola pengguna & akses" },
  { perm: "data.manage", label: "Backup, acak & hapus data demo" },
];

export function can(role: Role, perm: Perm) {
  return ROLE_PERMS[role].includes(perm);
}

export function roleLabel(role: Role) {
  return role === "admin" ? "Administrator" : "Kasir";
}

export function isProtectedUser(u: User) {
  return u.role === "admin" || u.isRoot;
}

/** Shift hanya berlaku untuk akun kasir. */
export function shiftEligible(u: User) {
  return u.role === "kasir";
}

export function homeFor(role: Role) {
  return role === "admin" ? "/" : "/kasir";
}

export const ROUTE_PERM: { href: string; perm: Perm | null }[] = [
  { href: "/kasir", perm: "pos" },
  { href: "/member", perm: "members.view" },
  { href: "/shift", perm: "shift.view" },
  { href: "/produk", perm: "products.view" },
  { href: "/transaksi", perm: "tx.view" },
  { href: "/analitik", perm: "analytics" },
  { href: "/pengaturan", perm: "settings.self" },
  { href: "/beranda", perm: null },
  { href: "/", perm: "dashboard" },
];

export function routeAllowed(pathname: string, role: Role) {
  const match = ROUTE_PERM.find((r) => (r.href === "/" ? pathname === "/" : pathname.startsWith(r.href)));
  if (!match || match.perm === null) return true;
  return can(role, match.perm);
}