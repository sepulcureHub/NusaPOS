"use client";

import { createContext, useContext, useEffect, useReducer, useRef } from "react";
import type { ReactNode } from "react";
import type {
  AppNotification, AppState, Customer, DayPromo, DemoData, DiningTable, Discount, HeldOrder, NotifKind,
  PointReward, Product, Redemption, Role, SavedView, Session, Settings, ShiftPlan, ShiftSession,
  Transaction, TxStatus, User,
} from "./types";
import { CATEGORY_EMOJI } from "./types";
import {
  DEMO_BEHAVIOR, DEMO_SEED, DEMO_SETTINGS, DEMO_TABLES, DEMO_USERS, DEMO_VIEWS, STORE_CLOSE, WALK_IN_CUSTOMER,
} from "./demo-data";
import { buildSeed, defaultShiftPlans } from "./seed";
import { uid } from "./format";
import { ALL_DAYS, makeSku, stockNeed } from "./pricing";
import { attachShiftIds, backfillSessions } from "./shift";
import { ACCENT_VALUES } from "./brand";
import { can, isProtectedUser, shiftEligible, verifyPassword } from "./auth";
import { normalizeUsername } from "./member";
import type { Perm } from "./auth";

const KEY = "nusapos:v1";
const MAX_NOTIFS = 300;

/* Identitas tab ini + jam logis (ms) untuk sinkron antar tab. */
const TAB_ID = uid();
const PERSIST_DEBOUNCE = 250;

interface Envelope { v: 1; rev: number; writer: string; state: AppState }

function parseEnvelope(text: string | null): Envelope | null {
  if (!text) return null;
  try {
    const p = JSON.parse(text);
    if (p?.v !== 1 || !p.state) return null;
    return { v: 1, rev: Number(p.rev) || 0, writer: String(p.writer ?? ""), state: p.state };
  } catch {
    return null;
  }
}

export type Action =
  | { type: "HYDRATE"; state: AppState }
  | { type: "SYNC_REMOTE"; state: AppState }
  | { type: "RESET"; data: DemoData }
  | { type: "WIPE_DEMO" }
  | { type: "ADD_PRODUCT"; product: Product }
  | { type: "UPDATE_PRODUCT"; product: Product }
  | { type: "DELETE_PRODUCTS"; ids: string[] }
  | { type: "RESTORE_PRODUCTS"; entries: { product: Product; index: number }[] }
  | { type: "REORDER"; dragId: string; overId: string }
  | { type: "MOVE_PRODUCT"; id: string; dir: -1 | 1 }
  | { type: "SET_ACTIVE"; ids: string[]; active: boolean }
  | { type: "SET_DISCOUNT"; ids: string[]; discount: Discount }
  | { type: "ADJUST_STOCK"; id: string; delta: number }
  | { type: "ADD_TX"; tx: Transaction }
  | { type: "SET_TX_STATUS"; id: string; status: TxStatus }
  | { type: "HOLD"; order: HeldOrder }
  | { type: "REMOVE_HELD"; id: string }
  | { type: "ADD_CUSTOMER"; customer: Customer }
  | { type: "UPDATE_CUSTOMER"; customer: Customer }
  | { type: "DELETE_CUSTOMERS"; ids: string[] }
  | { type: "RESTORE_CUSTOMERS"; customers: Customer[] }
  | { type: "SET_MEMBER_ACTIVE"; ids: string[]; active: boolean }
  | { type: "ADJUST_POINTS"; id: string; delta: number; note: string }
  | { type: "REDEEM_POINTS"; customerId: string; rewardId: string; by: string; channel: "portal" | "kasir" }
  | { type: "ADD_REWARD"; reward: PointReward }
  | { type: "UPDATE_REWARD"; reward: PointReward }
  | { type: "DELETE_REWARDS"; ids: string[] }
  | { type: "SET_REWARD_ACTIVE"; ids: string[]; active: boolean }
  | { type: "UPDATE_SETTINGS"; patch: Partial<Settings> }
  | { type: "SAVE_VIEW"; view: SavedView }
  | { type: "DELETE_VIEW"; id: string }
  | { type: "LOGIN"; userId: string }
  | { type: "LOGOUT" }
  | { type: "MEMBER_LOGIN"; customerId: string }
  | { type: "MEMBER_LOGOUT" }
  | { type: "ADD_USER"; user: User }
  | { type: "UPDATE_USER"; user: User }
  | { type: "DELETE_USERS"; ids: string[] }
  | { type: "SET_USER_ACTIVE"; ids: string[]; active: boolean }
  | { type: "ADD_SHIFT"; plan: ShiftPlan }
  | { type: "UPDATE_SHIFT"; plan: ShiftPlan }
  | { type: "DELETE_SHIFTS"; ids: string[] }
  | { type: "RESTORE_SHIFTS"; plans: ShiftPlan[] }
  | { type: "SET_SHIFT_ACTIVE"; ids: string[]; active: boolean }
  | { type: "OPEN_SHIFT"; session: ShiftSession }
  | { type: "CLOSE_SHIFT"; id: string; closingCash: number | null; note: string; by: "manual" | "admin" }
  | { type: "RECONCILE_SHIFT"; id: string; closingCash: number; note: string }
  | { type: "EXTEND_SHIFT"; id: string; minutes: number }
  | { type: "AUTO_CLOSE_SHIFTS"; now: number }
  | { type: "ADD_TABLE"; table: DiningTable }
  | { type: "UPDATE_TABLE"; table: DiningTable }
  | { type: "DELETE_TABLES"; ids: string[] }
  | { type: "RESTORE_TABLES"; tables: DiningTable[] }
  | { type: "SET_TABLE_ACTIVE"; ids: string[]; active: boolean }
  | { type: "FREE_TABLE"; id: string }
  | { type: "SET_NOTIF_READ"; ts: number }
  | { type: "CLEAR_NOTIFS" }
  // ═══ LIVE: injeksi user dari Supabase Auth ke store ═══
  | { type: "HYDRATE_LIVE"; user: User; settings: Partial<Settings> };

const initial: AppState = {
  hydrated: false, products: [], transactions: [], customers: [], held: [], views: [],
  settings: DEMO_SETTINGS, users: [], session: null, shiftPlans: [], shiftSessions: [],
  rewards: [], redemptions: [], notifications: [], notifReadAt: 0, memberSession: null, tables: [],
};

function pushNote(list: AppNotification[], n: Omit<AppNotification, "id" | "ts">): AppNotification[] {
  return [{ ...n, id: uid(), ts: Date.now() }, ...list].slice(0, MAX_NOTIFS);
}

function applyStock(products: Product[], items: Transaction["items"], sign: 1 | -1) {
  const need = new Map<string, number>();
  items.forEach((i) => stockNeed(i).forEach((q, id) => need.set(id, (need.get(id) ?? 0) + q * sign)));
  if (!need.size) return products;
  return products.map((p) => (need.has(p.id) ? { ...p, stock: Math.min(99999, Math.max(0, p.stock + (need.get(p.id) ?? 0))) } : p));
}

function applyMember(customers: Customer[], tx: Transaction, sign: 1 | -1) {
  if (!tx.memberNo || tx.isTest) return customers;
  return customers.map((c) => {
    if (c.id !== tx.customerId || !c.member) return c;
    return {
      ...c,
      points: Math.max(0, (c.points ?? 0) + sign * (tx.memberPoints ?? 0)),
      visits: Math.max(0, (c.visits ?? 0) + sign),
      spend: Math.max(0, (c.spend ?? 0) + sign * tx.total),
    };
  });
}

function autoCloseSessions(sessions: ShiftSession[], now: number) {
  let changed = false;
  const next = sessions.map((s) => {
    if (s.closedAt === null && s.autoCloseAt !== null && s.autoCloseAt <= now) {
      changed = true;
      return { ...s, closedAt: s.autoCloseAt, closedBy: "auto" as const, closingCash: null, closeNote: "Ditutup otomatis sesuai jam jadwal shift" };
    }
    return s;
  });
  return changed ? next : sessions;
}

function emptyDemo(settings: Settings, tables: DiningTable[]): DemoData {
  return {
    products: [], transactions: [], customers: [{ ...WALK_IN_CUSTOMER }], held: [], views: [],
    settings, shiftPlans: [], shiftSessions: [], rewards: [], redemptions: [], notifications: [], notifReadAt: 0,
    tables,
  };
}

function core(state: AppState, a: Action): AppState {
  switch (a.type) {
    case "HYDRATE": return a.state;
    /* Sinkron dari tab lain: data ikut, sesi login tab ini TIDAK ditimpa. */
    case "SYNC_REMOTE": return {
      ...a.state,
      session: state.session,
      memberSession: state.memberSession,
      hydrated: true,
    };
    case "RESET": return { ...a.data, users: state.users, session: state.session, memberSession: null, hydrated: true };
    case "WIPE_DEMO": return { ...state, ...emptyDemo(state.settings, state.tables), hydrated: true };

    // ═══ LIVE: injeksi user Supabase ke store ═══
    case "HYDRATE_LIVE": {
      const { user, settings } = a;
      return {
        ...state,
        users: [user],
        session: { userId: user.id, since: Date.now() },
        settings: { ...state.settings, ...settings },
        hydrated: true,
      };
    }

    case "ADD_PRODUCT": return { ...state, products: [a.product, ...state.products] };
    case "UPDATE_PRODUCT": return { ...state, products: state.products.map((p) => (p.id === a.product.id ? a.product : p)) };
    case "DELETE_PRODUCTS": return { ...state, products: state.products.filter((p) => !a.ids.includes(p.id)) };
    case "RESTORE_PRODUCTS": {
      const arr = [...state.products];
      [...a.entries].sort((x, y) => x.index - y.index).forEach((e) => arr.splice(Math.min(e.index, arr.length), 0, e.product));
      return { ...state, products: arr };
    }
    case "REORDER": {
      const arr = [...state.products];
      const from = arr.findIndex((p) => p.id === a.dragId);
      const to = arr.findIndex((p) => p.id === a.overId);
      if (from < 0 || to < 0) return state;
      const [m] = arr.splice(from, 1);
      arr.splice(to, 0, m);
      return { ...state, products: arr };
    }
    case "MOVE_PRODUCT": {
      const arr = [...state.products];
      const i = arr.findIndex((p) => p.id === a.id);
      const j = i + a.dir;
      if (i < 0 || j < 0 || j >= arr.length) return state;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return { ...state, products: arr };
    }
    case "SET_ACTIVE": return { ...state, products: state.products.map((p) => (a.ids.includes(p.id) ? { ...p, active: a.active } : p)) };
    case "SET_DISCOUNT": return { ...state, products: state.products.map((p) => (a.ids.includes(p.id) ? { ...p, discount: { ...a.discount } } : p)) };
    case "ADJUST_STOCK": return { ...state, products: state.products.map((p) => (p.id === a.id ? { ...p, stock: Math.min(99999, Math.max(0, p.stock + a.delta)) } : p)) };

    case "ADD_TX": {
      if (a.tx.isTest) return state; /* mode uji admin tidak pernah tercatat */
      const sess = state.session ? state.users.find((u) => u.id === state.session!.userId) : null;
      const open = sess && shiftEligible(sess) ? state.shiftSessions.find((s) => s.userId === sess.id && s.closedAt === null) : null;
      const tx = a.tx.shiftId || !open ? a.tx : { ...a.tx, shiftId: open.id };
      let tables = state.tables;
      if (tx.orderType === "dinein" && tx.tableId) {
        tables = state.tables.map((t) => (t.id === tx.tableId
          ? { ...t, status: "terisi" as const, txId: tx.id, customerName: tx.customerName, occupiedAt: tx.ts }
          : t));
      }
      return {
        ...state,
        transactions: [...state.transactions, tx],
        products: applyStock(state.products, tx.items, -1),
        customers: tx.status === "Selesai" ? applyMember(state.customers, tx, 1) : state.customers,
        tables,
      };
    }
    case "SET_TX_STATUS": {
      const tx = state.transactions.find((t) => t.id === a.id);
      if (!tx || tx.status === a.status) return state;
      let tables = state.tables;
      if (tx.tableId) {
        if (a.status === "Refund") {
          tables = state.tables.map((t) => (t.id === tx.tableId && t.txId === tx.id
            ? { ...t, status: "kosong" as const, txId: null, customerName: null, occupiedAt: null }
            : t));
        } else if (tx.orderType === "dinein") {
          /* Batalkan refund → meja diisi lagi, HANYA kalau masih kosong & aktif. */
          tables = state.tables.map((t) => (t.id === tx.tableId && t.active && t.status === "kosong"
            ? { ...t, status: "terisi" as const, txId: tx.id, customerName: tx.customerName, occupiedAt: tx.ts }
            : t));
        }
      }
      return {
        ...state,
        transactions: state.transactions.map((t) => (t.id === a.id ? { ...t, status: a.status } : t)),
        products: applyStock(state.products, tx.items, a.status === "Refund" ? 1 : -1),
        customers: applyMember(state.customers, tx, a.status === "Refund" ? -1 : 1),
        tables,
      };
    }
    case "HOLD": return { ...state, held: [a.order, ...state.held] };
    case "REMOVE_HELD": return { ...state, held: state.held.filter((h) => h.id !== a.id) };

    case "ADD_CUSTOMER": return { ...state, customers: [...state.customers, a.customer] };
    case "UPDATE_CUSTOMER": return { ...state, customers: state.customers.map((c) => (c.id === a.customer.id ? a.customer : c)) };
    case "DELETE_CUSTOMERS": {
      const ids = a.ids.filter((id) => id !== WALK_IN_CUSTOMER.id);
      return { ...state, customers: state.customers.filter((c) => !ids.includes(c.id)) };
    }
    case "RESTORE_CUSTOMERS": {
      const have = new Set(state.customers.map((c) => c.id));
      return { ...state, customers: [...state.customers, ...a.customers.filter((c) => !have.has(c.id))] };
    }
    case "SET_MEMBER_ACTIVE": return {
      ...state,
      customers: state.customers.map((c) => (a.ids.includes(c.id) && c.member ? { ...c, memberActive: a.active } : c)),
    };
    case "ADJUST_POINTS": return {
      ...state,
      customers: state.customers.map((c) => (c.id === a.id && c.member
        ? { ...c, points: Math.max(0, (c.points ?? 0) + a.delta), notes: a.note ? `${c.notes ? c.notes + " · " : ""}${a.note}` : c.notes }
        : c)),
    };
    case "REDEEM_POINTS": {
      const c = state.customers.find((x) => x.id === a.customerId);
      const r = state.rewards.find((x) => x.id === a.rewardId);
      if (!c || !r || !c.member || !r.active) return state;
      if ((c.points ?? 0) < r.cost) return state;
      const redemption: Redemption = {
        id: uid(), customerId: c.id, memberNo: c.memberNo ?? "-", customerName: c.name,
        rewardId: r.id, rewardName: r.name, rewardEmoji: r.emoji,
        cost: r.cost, ts: Date.now(), by: a.by, channel: a.channel,
      };
      return {
        ...state,
        customers: state.customers.map((x) => (x.id === c.id ? { ...x, points: Math.max(0, (x.points ?? 0) - r.cost) } : x)),
        redemptions: [redemption, ...state.redemptions].slice(0, 500),
      };
    }
    case "ADD_REWARD": return { ...state, rewards: [a.reward, ...state.rewards] };
    case "UPDATE_REWARD": return { ...state, rewards: state.rewards.map((r) => (r.id === a.reward.id ? a.reward : r)) };
    case "DELETE_REWARDS": return { ...state, rewards: state.rewards.filter((r) => !a.ids.includes(r.id)) };
    case "SET_REWARD_ACTIVE": return { ...state, rewards: state.rewards.map((r) => (a.ids.includes(r.id) ? { ...r, active: a.active } : r)) };

    case "UPDATE_SETTINGS": return { ...state, settings: { ...state.settings, ...a.patch } };
    case "SAVE_VIEW": return { ...state, views: [...state.views, a.view] };
    case "DELETE_VIEW": return { ...state, views: state.views.filter((v) => v.id !== a.id) };

    case "LOGIN": {
      const u = state.users.find((x) => x.id === a.userId && x.active);
      if (!u) return state;
      return { ...state, session: { userId: u.id, since: Date.now() } };
    }
    case "LOGOUT": return { ...state, session: null };
    case "MEMBER_LOGIN": {
      const c = state.customers.find((x) => x.id === a.customerId);
      if (!c || !c.member || c.memberActive === false || c.portal === false) return state;
      return { ...state, memberSession: { customerId: c.id, since: Date.now() } };
    }
    case "MEMBER_LOGOUT": return { ...state, memberSession: null };

    case "ADD_USER": {
      if (state.users.some((u) => u.username.toLowerCase() === a.user.username.toLowerCase())) return state;
      return { ...state, users: [...state.users, { ...a.user, role: "kasir", isRoot: false }] };
    }
    case "UPDATE_USER": {
      const prev = state.users.find((u) => u.id === a.user.id);
      if (!prev) return state;
      const locked = isProtectedUser(prev);
      const next: User = {
        ...prev, name: a.user.name, passHash: a.user.passHash || prev.passHash,
        username: locked ? prev.username : a.user.username,
        role: locked ? prev.role : a.user.role,
        active: locked ? true : a.user.active, isRoot: prev.isRoot,
      };
      if (!locked && state.users.some((u) => u.id !== next.id && u.username.toLowerCase() === next.username.toLowerCase())) return state;
      return {
        ...state,
        users: state.users.map((u) => (u.id === next.id ? next : u)),
        shiftSessions: state.shiftSessions.map((s) => (s.userId === next.id ? { ...s, userName: next.name } : s)),
        session: !next.active && state.session?.userId === next.id ? null : state.session,
      };
    }
    case "DELETE_USERS": {
      const removable = a.ids.filter((id) => {
        const u = state.users.find((x) => x.id === id);
        return !!u && !isProtectedUser(u);
      });
      if (!removable.length) return state;
      return {
        ...state,
        users: state.users.filter((u) => !removable.includes(u.id)),
        shiftPlans: state.shiftPlans.filter((p) => !removable.includes(p.userId)),
        shiftSessions: state.shiftSessions.map((s) => (removable.includes(s.userId) && s.closedAt === null ? { ...s, closedAt: Date.now(), closedBy: "admin" as const } : s)),
        session: state.session && removable.includes(state.session.userId) ? null : state.session,
      };
    }
    case "SET_USER_ACTIVE": return {
      ...state,
      users: state.users.map((u) => (a.ids.includes(u.id) && !isProtectedUser(u) ? { ...u, active: a.active } : u)),
      session: !a.active && state.session && a.ids.includes(state.session.userId) ? null : state.session,
    };

    case "ADD_SHIFT": {
      const u = state.users.find((x) => x.id === a.plan.userId);
      if (!u || !shiftEligible(u)) return state;
      return { ...state, shiftPlans: [...state.shiftPlans, a.plan] };
    }
    case "UPDATE_SHIFT": return { ...state, shiftPlans: state.shiftPlans.map((p) => (p.id === a.plan.id ? a.plan : p)) };
    case "DELETE_SHIFTS": return { ...state, shiftPlans: state.shiftPlans.filter((p) => !a.ids.includes(p.id)) };
    case "RESTORE_SHIFTS": {
      const have = new Set(state.shiftPlans.map((p) => p.id));
      const allowed = a.plans.filter((p) => {
        const u = state.users.find((x) => x.id === p.userId);
        return !!u && shiftEligible(u) && !have.has(p.id);
      });
      return { ...state, shiftPlans: [...state.shiftPlans, ...allowed] };
    }
    case "SET_SHIFT_ACTIVE": return { ...state, shiftPlans: state.shiftPlans.map((p) => (a.ids.includes(p.id) ? { ...p, active: a.active } : p)) };
    case "OPEN_SHIFT": {
      const u = state.users.find((x) => x.id === a.session.userId);
      if (!u || !shiftEligible(u)) return state;
      if (state.shiftSessions.some((s) => s.userId === u.id && s.closedAt === null)) return state;
      return { ...state, shiftSessions: [...state.shiftSessions, { ...a.session, userName: u.name }] };
    }
    case "CLOSE_SHIFT": return {
      ...state,
      shiftSessions: state.shiftSessions.map((s) => (s.id === a.id && s.closedAt === null
        ? { ...s, closedAt: Date.now(), closingCash: a.closingCash === null ? null : Math.max(0, a.closingCash), closeNote: a.note || s.closeNote, closedBy: a.by }
        : s)),
    };
    case "RECONCILE_SHIFT": return {
      ...state,
      shiftSessions: state.shiftSessions.map((s) => (s.id === a.id ? { ...s, closingCash: Math.max(0, a.closingCash), closeNote: a.note || s.closeNote } : s)),
    };
    case "EXTEND_SHIFT": return {
      ...state,
      shiftSessions: state.shiftSessions.map((s) => (s.id === a.id && s.closedAt === null ? { ...s, autoCloseAt: (s.autoCloseAt ?? Date.now()) + a.minutes * 60000 } : s)),
    };
    case "AUTO_CLOSE_SHIFTS": {
      const next = autoCloseSessions(state.shiftSessions, a.now);
      return next === state.shiftSessions ? state : { ...state, shiftSessions: next };
    }

    case "ADD_TABLE": return { ...state, tables: [...state.tables, a.table] };
    case "UPDATE_TABLE": return { ...state, tables: state.tables.map((t) => (t.id === a.table.id ? a.table : t)) };
    case "DELETE_TABLES": return { ...state, tables: state.tables.filter((t) => !a.ids.includes(t.id)) };
    case "RESTORE_TABLES": {
      const have = new Set(state.tables.map((t) => t.id));
      return { ...state, tables: [...state.tables, ...a.tables.filter((t) => !have.has(t.id))] };
    }
    case "SET_TABLE_ACTIVE": return { ...state, tables: state.tables.map((t) => (a.ids.includes(t.id) ? { ...t, active: a.active } : t)) };
    case "FREE_TABLE": return {
      ...state,
      tables: state.tables.map((t) => (t.id === a.id ? { ...t, status: "kosong" as const, txId: null, customerName: null, occupiedAt: null } : t)),
    };

    case "SET_NOTIF_READ": return { ...state, notifReadAt: Math.max(state.notifReadAt, a.ts) };
    case "CLEAR_NOTIFS": return { ...state, notifications: [], notifReadAt: Date.now() };

    default: return state;
  }
}

/* ---------- pencatat aktivitas sistem ---------- */
function actorOf(state: AppState, fallback?: string): string {
  const u = state.session ? state.users.find((x) => x.id === state.session!.userId) : null;
  return u?.name ?? fallback ?? "Sistem";
}

function annotate(state: AppState, next: AppState, a: Action): AppState {
  let note: { kind: NotifKind; title: string; detail?: string; actor?: string } | null = null;

  switch (a.type) {
    // ═══ LIVE: catat login via Supabase Auth ═══
    case "HYDRATE_LIVE": {
      note = { kind: "auth", title: "Masuk ke sistem (live)", detail: `${a.user.name} (@${a.user.username}) · ${a.user.role}`, actor: a.user.name };
      break;
    }

    case "LOGIN": {
      const u = state.users.find((x) => x.id === a.userId);
      note = { kind: "auth", title: `Masuk ke sistem`, detail: `${u?.name ?? a.userId} (@${u?.username ?? "?"})`, actor: u?.name };
      break;
    }
    case "LOGOUT": note = { kind: "auth", title: "Keluar dari sistem", actor: actorOf(state) }; break;
    case "MEMBER_LOGIN": {
      const c = state.customers.find((x) => x.id === a.customerId);
      note = { kind: "member", title: "Member masuk ke portal", detail: `${c?.name ?? ""} · @${c?.username ?? c?.memberNo ?? ""}`, actor: c?.name };
      break;
    }
    case "MEMBER_LOGOUT": note = { kind: "member", title: "Member keluar dari portal", actor: "Portal member" }; break;

    case "ADD_TX":
      if (!a.tx.isTest) {
        const orderInfo = a.tx.orderType === "dinein"
          ? ` · Makan di sini${a.tx.tableLabel ? ` (${a.tx.tableLabel})` : ""}`
          : a.tx.orderType === "takeaway" ? " · Bawa pulang" : "";
        note = { kind: "sale", title: `Penjualan baru ${a.tx.id}`, detail: `${a.tx.customerName} · ${a.tx.method} · Rp ${a.tx.total.toLocaleString("id-ID")}${orderInfo}`, actor: a.tx.cashier };
      }
      break;
    case "SET_TX_STATUS":
      note = { kind: a.status === "Refund" ? "refund" : "sale", title: `${a.status === "Refund" ? "Refund" : "Batalkan refund"} ${a.id}`, actor: actorOf(state) };
      break;

    case "ADD_PRODUCT": note = { kind: "product", title: `Produk ditambahkan: ${a.product.name}`, detail: a.product.sku, actor: actorOf(state) }; break;
    case "UPDATE_PRODUCT": note = { kind: "product", title: `Produk diperbarui: ${a.product.name}`, detail: a.product.sku, actor: actorOf(state) }; break;
    case "DELETE_PRODUCTS": note = { kind: "product", title: `${a.ids.length} produk dihapus`, actor: actorOf(state) }; break;
    case "RESTORE_PRODUCTS": note = { kind: "product", title: `${a.entries.length} produk dipulihkan`, actor: actorOf(state) }; break;
    case "SET_ACTIVE": note = { kind: "product", title: `${a.ids.length} produk ${a.active ? "diaktifkan" : "dinonaktifkan"}`, actor: actorOf(state) }; break;
    case "SET_DISCOUNT": note = { kind: "product", title: `Diskon dasar diubah untuk ${a.ids.length} produk`, actor: actorOf(state) }; break;
    case "ADJUST_STOCK": note = { kind: "stock", title: `Stok disesuaikan (${a.delta > 0 ? "+" : ""}${a.delta})`, actor: actorOf(state) }; break;

    case "HOLD": note = { kind: "sale", title: `Order ditahan: ${a.order.label}`, actor: actorOf(state) }; break;
    case "REMOVE_HELD": note = { kind: "sale", title: "Order ditahan dihapus", actor: actorOf(state) }; break;

    case "ADD_CUSTOMER": note = { kind: a.customer.member ? "member" : "system", title: a.customer.member ? `Member baru: ${a.customer.name}` : `Pelanggan baru: ${a.customer.name}`, detail: a.customer.memberNo, actor: a.customer.createdByName ?? actorOf(state) }; break;
    case "UPDATE_CUSTOMER": note = { kind: "member", title: `Profil member diperbarui: ${a.customer.name}`, actor: actorOf(state) }; break;
    case "DELETE_CUSTOMERS": note = { kind: "member", title: `${a.ids.length} member/pelanggan dihapus`, actor: actorOf(state) }; break;
    case "RESTORE_CUSTOMERS": note = { kind: "member", title: `${a.customers.length} member dipulihkan`, actor: actorOf(state) }; break;
    case "SET_MEMBER_ACTIVE": note = { kind: "member", title: `${a.ids.length} member ${a.active ? "diaktifkan" : "dinonaktifkan"}`, actor: actorOf(state) }; break;
    case "ADJUST_POINTS": note = { kind: "points", title: `Poin disesuaikan (${a.delta > 0 ? "+" : ""}${a.delta})`, detail: a.note, actor: actorOf(state) }; break;
    case "REDEEM_POINTS": {
      const c = state.customers.find((x) => x.id === a.customerId);
      const r = state.rewards.find((x) => x.id === a.rewardId);
      note = { kind: "points", title: `Penukaran poin: ${r?.name ?? "?"}`, detail: `${c?.name ?? ""} menukar ${r?.cost ?? 0} poin`, actor: c?.name ?? a.by };
      break;
    }
    case "ADD_REWARD": note = { kind: "reward", title: `Hadiah baru: ${a.reward.name}`, detail: `${a.reward.cost} poin`, actor: actorOf(state) }; break;
    case "UPDATE_REWARD": note = { kind: "reward", title: `Hadiah diperbarui: ${a.reward.name}`, actor: actorOf(state) }; break;
    case "DELETE_REWARDS": note = { kind: "reward", title: `${a.ids.length} hadiah dihapus`, actor: actorOf(state) }; break;
    case "SET_REWARD_ACTIVE": note = { kind: "reward", title: `${a.ids.length} hadiah ${a.active ? "diaktifkan" : "dinonaktifkan"}`, actor: actorOf(state) }; break;

    case "UPDATE_SETTINGS": {
      const keys = Object.keys(a.patch);
      note = { kind: "settings", title: `Pengaturan diubah (${keys.length} item)`, detail: keys.slice(0, 5).join(", "), actor: actorOf(state) };
      break;
    }
    case "SAVE_VIEW": note = { kind: "view", title: `View disimpan: ${a.view.name}`, actor: actorOf(state) }; break;
    case "DELETE_VIEW": note = { kind: "view", title: "View dihapus", actor: actorOf(state) }; break;

    case "ADD_USER": note = { kind: "user", title: `Akun dibuat: ${a.user.name}`, detail: `@${a.user.username}`, actor: actorOf(state) }; break;
    case "UPDATE_USER": note = { kind: "user", title: `Akun diperbarui: ${a.user.name}`, actor: actorOf(state) }; break;
    case "DELETE_USERS": note = { kind: "user", title: `${a.ids.length} akun dihapus`, actor: actorOf(state) }; break;
    case "SET_USER_ACTIVE": note = { kind: "user", title: `${a.ids.length} akun ${a.active ? "diaktifkan" : "dinononaktifkan"}`, actor: actorOf(state) }; break;

    case "ADD_SHIFT": note = { kind: "shift", title: "Jadwal shift ditambahkan", actor: actorOf(state) }; break;
    case "UPDATE_SHIFT": note = { kind: "shift", title: "Jadwal shift diperbarui", actor: actorOf(state) }; break;
    case "DELETE_SHIFTS": note = { kind: "shift", title: `${a.ids.length} jadwal shift dihapus`, actor: actorOf(state) }; break;
    case "SET_SHIFT_ACTIVE": note = { kind: "shift", title: `${a.ids.length} shift ${a.active ? "diaktifkan" : "dinonaktifkan"}`, actor: actorOf(state) }; break;
    case "OPEN_SHIFT": note = { kind: "shift", title: `Shift dibuka: ${next.shiftSessions[next.shiftSessions.length - 1]?.userName ?? ""}`, detail: `Modal awal Rp ${(a.session.openingCash).toLocaleString("id-ID")}`, actor: a.session.userName }; break;
    case "CLOSE_SHIFT": {
      const s = state.shiftSessions.find((x) => x.id === a.id);
      note = { kind: "shift", title: `Shift ditutup: ${s?.userName ?? ""}`, detail: a.closingCash === null ? "kas belum dihitung" : `kas akhir Rp ${a.closingCash.toLocaleString("id-ID")}`, actor: actorOf(state, s?.userName) };
      break;
    }
    case "RECONCILE_SHIFT": note = { kind: "shift", title: "Kas shift dihitung", detail: `Rp ${a.closingCash.toLocaleString("id-ID")}`, actor: actorOf(state) }; break;
    case "EXTEND_SHIFT": note = { kind: "shift", title: `Shift diperpanjang ${a.minutes} menit`, actor: actorOf(state) }; break;
    case "AUTO_CLOSE_SHIFTS": {
      if (next.shiftSessions === state.shiftSessions) break;
      const closed = next.shiftSessions.filter((s, i) => s.closedAt !== null && state.shiftSessions[i]?.closedAt === null);
      note = { kind: "shift", title: `${closed.length || ""} shift ditutup otomatis`.replace("  ", " "), detail: "Sesuai jam jadwal", actor: "Sistem" };
      break;
    }

    case "ADD_TABLE": note = { kind: "system", title: `Meja ditambahkan: ${a.table.label}`, detail: `${a.table.area} · ${a.table.seats} kursi`, actor: actorOf(state) }; break;
    case "UPDATE_TABLE": note = { kind: "system", title: `Meja diperbarui: ${a.table.label}`, actor: actorOf(state) }; break;
    case "DELETE_TABLES": note = { kind: "system", title: `${a.ids.length} meja dihapus`, actor: actorOf(state) }; break;
    case "RESTORE_TABLES": note = { kind: "system", title: `${a.tables.length} meja dipulihkan`, actor: actorOf(state) }; break;
    case "SET_TABLE_ACTIVE": note = { kind: "system", title: `${a.ids.length} meja ${a.active ? "diaktifkan" : "dinonaktifkan"}`, actor: actorOf(state) }; break;
    case "FREE_TABLE": {
      const t = state.tables.find((x) => x.id === a.id);
      note = { kind: "system", title: `Meja ${t?.label ?? ""} dikosongkan`, detail: "Tamu selesai / meja siap dipakai lagi", actor: actorOf(state) };
      break;
    }

    case "RESET": note = { kind: "data", title: "Data demo diacak ulang", actor: actorOf(state) }; break;
    case "WIPE_DEMO": note = { kind: "data", title: "Seluruh data demo dihapus", detail: "Akun & pengaturan tetap", actor: actorOf(state) }; break;

    default:
      break;
  }

  if (!note) return next;
  return { ...next, notifications: pushNote(next.notifications, note) };
}

function reducer(state: AppState, a: Action): AppState {
  const next = core(state, a);
  if (next === state) return state;
  return annotate(state, next, a);
}

function normalizeProducts(raw: Product[]): Product[] {
  const skus: string[] = [];
  return raw.map((p) => {
    const kind = p.kind === "bundle" ? "bundle" : "single";
    const category = p.category ?? "Kopi";
    const days = Array.isArray(p.availableDays)
      ? [...new Set(p.availableDays.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))]
      : [...ALL_DAYS];
    const disc: Discount = p.discount && (p.discount.type === "pct" || p.discount.type === "rp")
      ? { type: p.discount.type, value: Math.max(0, Number(p.discount.value) || 0) }
      : { type: "pct", value: 0 };
    const promos: DayPromo[] = Array.isArray(p.dayPromos)
      ? p.dayPromos.filter((x) => x && Number.isInteger(x.day) && x.day >= 0 && x.day <= 6 && Number(x.value) > 0)
          .map((x) => ({ day: x.day, type: x.type === "rp" ? "rp" : "pct", value: Math.max(0, Number(x.value) || 0) }))
      : [];
    const sku = (p.sku || makeSku(category, kind, skus)).toUpperCase();
    skus.push(sku);
    return {
      ...p, category, kind, sku,
      price: Math.max(0, Number(p.price) || 0), cost: Math.max(0, Number(p.cost) || 0),
      stock: Math.max(0, Number(p.stock) || 0),
      emoji: p.emoji || (kind === "bundle" ? "🎁" : CATEGORY_EMOJI[category]),
      desc: p.desc ?? "", popularity: Number(p.popularity) || 5, active: p.active !== false,
      photo: typeof p.photo === "string" && p.photo.startsWith("data:image/") ? p.photo : null,
      discount: disc, dayPromos: promos,
      availableDays: days.length ? days : [...ALL_DAYS],
      bundleItems: Array.isArray(p.bundleItems)
        ? p.bundleItems.filter((c) => c && typeof c.productId === "string" && Number(c.qty) > 0).map((c) => ({ productId: c.productId, qty: Math.max(1, Math.round(c.qty)) }))
        : [],
    };
  });
}

function normalizeUsers(raw: User[] | undefined): User[] {
  const list: User[] = Array.isArray(raw) ? raw.filter((u) => u && typeof u.username === "string" && typeof u.passHash === "string") : [];
  const cleaned: User[] = list.map((u) => ({
    ...u, name: u.name || u.username,
    role: (u.role === "admin" ? "admin" : "kasir") as Role,
    active: u.role === "admin" ? true : u.active !== false,
    isRoot: !!u.isRoot || u.role === "admin",
    createdAt: Number(u.createdAt) || Date.now(),
  }));
  if (!cleaned.some((u) => u.role === "admin")) cleaned.unshift({ ...DEMO_USERS[0] });
  return cleaned;
}

function normalizeCustomers(raw: Customer[] | undefined): Customer[] {
  const list = Array.isArray(raw) && raw.length ? raw : [{ ...WALK_IN_CUSTOMER }];
  const out = list.map((c) => {
    if (c.id === WALK_IN_CUSTOMER.id) return { ...WALK_IN_CUSTOMER };
    if (!c.member) return { ...c, member: false };
    return {
      ...c, member: true,
      memberNo: c.memberNo || `NUSA-${String(Math.floor(Math.random() * 9000) + 1000)}`,
      points: Math.max(0, Number(c.points) || 0),
      visits: Math.max(0, Number(c.visits) || 0),
      spend: Math.max(0, Number(c.spend) || 0),
      joinedAt: Number(c.joinedAt) || Date.now(),
      memberActive: c.memberActive !== false,
      portal: c.portal !== false,
      email: c.email ?? "", birthDate: c.birthDate ?? "", notes: c.notes ?? "",
    };
  });
  if (!out.some((c) => c.id === WALK_IN_CUSTOMER.id)) out.unshift({ ...WALK_IN_CUSTOMER });

  const seenNo = new Set<string>();
  const seenUser = new Set<string>();

  return out.map((c) => {
    if (!c.member) return c;

    let no = c.memberNo ?? "NUSA-0000";
    let nNo = 1;
    while (seenNo.has(no)) { nNo++; no = `${c.memberNo}-${nNo}`; }
    seenNo.add(no);

    let uname =
      normalizeUsername(c.username ?? "") ||
      normalizeUsername(no) ||
      normalizeUsername(c.phone) ||
      "member";

    if (uname.length < 3) uname = `member${uname.replace(/[^a-z0-9]/g, "") || "01"}`;
    uname = uname.slice(0, 20);

    let finalUser = uname;
    let nUser = 1;
    while (seenUser.has(finalUser)) {
      nUser++;
      const suffix = `-${nUser}`;
      finalUser = `${uname.slice(0, Math.max(1, 20 - suffix.length))}${suffix}`;
    }
    seenUser.add(finalUser);

    return { ...c, memberNo: no, username: finalUser };
  });
}

export function normalizeTables(raw: DiningTable[] | undefined): DiningTable[] {
  /* undefined / bukan array = data lama (pra-meja) → baru seed meja demo.
     Array kosong = admin memang menghapus semua meja → hormati, jangan dibangkitkan. */
  const list = Array.isArray(raw) ? raw : DEMO_TABLES.map((t) => ({ ...t }));
  return list.map((t) => ({
    id: t.id || uid(),
    label: String(t.label || "Meja"),
    seats: Math.max(1, Math.min(20, Number(t.seats) || 2)),
    area: String(t.area || "Indoor"),
    status: t.status === "terisi" ? "terisi" : "kosong",
    active: t.active !== false,
    txId: t.txId ?? null,
    customerName: t.customerName ?? null,
    occupiedAt: t.occupiedAt ?? null,
    note: t.note ?? "",
  }));
}

/* Meja "terisi" wajib punya transaksi dine-in yang masih Selesai.
   Kalau tidak (di-refund / data demo dihapus) → kosongkan. */
function reconcileTables(tables: DiningTable[], txs: Transaction[]): DiningTable[] {
  const live = new Set(txs.filter((t) => t.status === "Selesai" && !!t.tableId).map((t) => t.id));
  return tables.map((t) => {
    if (t.status !== "terisi") return t;
    if (t.txId && live.has(t.txId)) return t;
    return { ...t, status: "kosong" as const, txId: null, customerName: null, occupiedAt: null };
  });
}

const LEGACY_ACCENT: Record<string, Settings["accent"]> = { amber: "ungu", magenta: "lembayung" };

export function normalize(raw: Partial<AppState>): AppState {
  const s: Settings = { ...DEMO_SETTINGS, ...(raw.settings ?? {}) };
  if (!["dark", "light", "system"].includes(s.theme)) s.theme = "dark";
  if (!ACCENT_VALUES.includes(s.accent)) s.accent = LEGACY_ACCENT[s.accent as string] ?? "tosca";
  if (!["rounded", "circle", "square"].includes(s.logoShape)) s.logoShape = "rounded";
  if (typeof s.logo !== "string" || !s.logo.startsWith("data:image/")) s.logo = null;
  s.logoSize = Math.min(48, Math.max(24, Number(s.logoSize) || 34));
  s.brandName = String(s.brandName || DEMO_SETTINGS.brandName);
  s.brandTagline = String(s.brandTagline ?? DEMO_SETTINGS.brandTagline);

  s.memberPointRate = Math.max(100, Number(s.memberPointRate) || 1000);
  s.memberDiscountPct = Math.min(25, Math.max(0, Number(s.memberDiscountPct) || 0));
  s.memberBirthdayPct = Math.min(25, Math.max(0, Number(s.memberBirthdayPct) || 0));
  s.memberWelcomePoints = Math.min(100000, Math.max(0, Number(s.memberWelcomePoints) || 0));

  /* migrasi ambang tier lama (berbasis poin) → akumulasi belanja (Rp) */
  if ((Number(s.memberTierPlatinum) || 0) < 100000) {
    s.memberTierSilver = DEMO_SETTINGS.memberTierSilver;
    s.memberTierGold = DEMO_SETTINGS.memberTierGold;
    s.memberTierPlatinum = DEMO_SETTINGS.memberTierPlatinum;
  }
  s.memberTierSilver = Math.max(1, Number(s.memberTierSilver) || DEMO_SETTINGS.memberTierSilver);
  s.memberTierGold = Math.max(s.memberTierSilver + 1, Number(s.memberTierGold) || DEMO_SETTINGS.memberTierGold);
  s.memberTierPlatinum = Math.max(s.memberTierGold + 1, Number(s.memberTierPlatinum) || DEMO_SETTINGS.memberTierPlatinum);
  s.memberBonusBronze = Math.min(25, Math.max(0, Number(s.memberBonusBronze) || 0));
  s.memberBonusSilver = Math.min(25, Math.max(0, Number(s.memberBonusSilver) || 0));
  s.memberBonusGold = Math.min(25, Math.max(0, Number(s.memberBonusGold) || 0));
  s.memberBonusPlatinum = Math.min(25, Math.max(0, Number(s.memberBonusPlatinum) || 0));
  s.memberBenefitNotes = String(s.memberBenefitNotes ?? DEMO_SETTINGS.memberBenefitNotes);

  const users = normalizeUsers(raw.users);
  const kasirIds = new Set(users.filter(shiftEligible).map((u) => u.id));
  const customers = normalizeCustomers(raw.customers);

  let session: Session | null = null;
  if (raw.session && typeof raw.session.userId === "string") {
    const u = users.find((x) => x.id === raw.session!.userId);
    if (u && u.active) session = { userId: u.id, since: Number(raw.session.since) || Date.now() };
  }

  let memberSession: AppState["memberSession"] = null;
  if (raw.memberSession && typeof raw.memberSession.customerId === "string") {
    const c = customers.find((x) => x.id === raw.memberSession!.customerId);
    if (c && c.member && c.memberActive !== false && c.portal !== false) {
      memberSession = { customerId: c.id, since: Number(raw.memberSession.since) || Date.now() };
    }
  }

  const transactions = Array.isArray(raw.transactions) ? raw.transactions.filter((t) => !t.isTest) : [];
  const shiftPlans: ShiftPlan[] = (Array.isArray(raw.shiftPlans) ? raw.shiftPlans : defaultShiftPlans(users)).filter((p) => p && kasirIds.has(p.userId));

  let shiftSessions: ShiftSession[] = (Array.isArray(raw.shiftSessions) ? raw.shiftSessions : backfillSessions(transactions, users, DEMO_BEHAVIOR.openingCash))
    .filter((x) => x && typeof x.openedAt === "number" && kasirIds.has(x.userId))
    .map((x) => ({ ...x, autoCloseAt: x.autoCloseAt ?? null, closedBy: x.closedBy ?? (x.closedAt !== null ? "manual" : null), closingCash: x.closingCash ?? null }));
  shiftSessions = autoCloseSessions(shiftSessions, Date.now());

  const rewards: PointReward[] = Array.isArray(raw.rewards)
    ? raw.rewards
        .filter((r) => r && typeof r.name === "string")
        .map((r) => ({
          id: r.id || uid(),
          name: r.name,
          emoji: r.emoji || "🎁",
          desc: r.desc ?? "",
          cost: Math.max(1, Number(r.cost) || 1),
          active: r.active !== false,
          createdAt: Number(r.createdAt) || Date.now(),
        }))
    : [];

  const redemptions: Redemption[] = Array.isArray(raw.redemptions)
    ? raw.redemptions.filter((r) => r && typeof r.customerId === "string" && typeof r.rewardId === "string")
    : [];

  const notifications: AppNotification[] = Array.isArray(raw.notifications)
    ? raw.notifications.filter((n) => n && typeof n.title === "string" && typeof n.kind === "string").slice(0, MAX_NOTIFS)
    : [];

  return {
    hydrated: true,
    products: normalizeProducts(Array.isArray(raw.products) ? raw.products : []),
    transactions: attachShiftIds(transactions, shiftSessions),
    customers,
    held: Array.isArray(raw.held) ? raw.held : [],
    views: Array.isArray(raw.views) ? raw.views : DEMO_VIEWS.map((v) => ({ ...v })),
    settings: s, users, session, shiftPlans, shiftSessions,
    rewards, redemptions, notifications,
    notifReadAt: Number(raw.notifReadAt) || 0,
    memberSession,
    tables: reconcileTables(normalizeTables(raw.tables), transactions),
  };
}

const Ctx = createContext<{ state: AppState; dispatch: React.Dispatch<Action> } | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial);
  const revRef = useRef(0);
  const skipWriteRef = useRef(false);
  const quotaWarnedRef = useRef(false);

  /* 1. Hydrate dari localStorage (atau seed demo saat pertama kali dibuka). */
  useEffect(() => {
    const env = parseEnvelope(localStorage.getItem(KEY));
    revRef.current = env?.rev ?? 0;
    const next = env ? normalize(env.state) : { ...buildSeed(DEMO_SEED), hydrated: true };
    dispatch({ type: "HYDRATE", state: next });
  }, []);

  /* 2. Auto-close shift tiap 15 detik + saat tab kembali visible. */
  useEffect(() => {
    if (!state.hydrated) return;
    const tick = () => dispatch({ type: "AUTO_CLOSE_SHIFTS", now: Date.now() });
    tick();
    const t = setInterval(tick, 15000);
    const onVis = () => { if (document.visibilityState === "visible") tick(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVis); };
  }, [state.hydrated]);

  /* 3. Persist debounce + jam logis & ID tab supaya tab lain bisa membandingkan. */
  useEffect(() => {
    if (!state.hydrated) return;
    if (skipWriteRef.current) { skipWriteRef.current = false; return; } // jangan gema-kan state tab lain
    const t = setTimeout(() => {
      const rev = Math.max(Date.now(), revRef.current + 1);
      try {
        localStorage.setItem(KEY, JSON.stringify({ v: 1, rev, writer: TAB_ID, state: { ...state, hydrated: false } }));
        revRef.current = rev;
      } catch (e) {
        if (!quotaWarnedRef.current) {
          quotaWarnedRef.current = true;
          console.warn(
            "[NusaPOS] Gagal menyimpan ke localStorage — kuota ±5MB penuh. " +
            "Kurangi/hapus foto produk, atau ekspor backup JSON lalu hapus data demo.", e
          );
        }
      }
    }, PERSIST_DEBOUNCE);
    return () => clearTimeout(t);
  }, [state]);

  /* 4. Sinkron antar tab di browser yang sama (event `storage` hanya menembak tab lain). */
  useEffect(() => {
    if (!state.hydrated) return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== KEY) return;
      const env = parseEnvelope(e.newValue);
      if (!env || env.writer === TAB_ID) return;
      /* Terima kalau lebih baru; kalau seri (ms sama) menangkan writer terbesar
         supaya kedua tab konvergen, bukan saling timpa. */
      const newer = env.rev > revRef.current || (env.rev === revRef.current && env.writer > TAB_ID);
      if (!newer) return;
      revRef.current = env.rev;
      skipWriteRef.current = true;
      dispatch({ type: "SYNC_REMOTE", state: normalize(env.state) });
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [state.hydrated]);

  return <Ctx.Provider value={{ state, dispatch }}>{children}</Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore harus di dalam StoreProvider");
  return v;
}

export function useAuth() {
  const { state } = useStore();
  const user = state.session ? state.users.find((u) => u.id === state.session!.userId) ?? null : null;
  const role: Role = user?.role ?? "kasir";
  return { user, role, isAdmin: role === "admin", can: (perm: Perm) => can(role, perm) };
}

/* Helper login member: username + PIN. Fallback lama: memberNo / phone. */
export function verifyMemberPin(state: AppState, identifier: string, pin: string): Customer | null {
  const id = identifier.trim().toLowerCase();
  if (!id) return null;
  const digits = id.replace(/[^\d]/g, "");

  const c = state.customers.find((x) =>
    x.member &&
    (
      normalizeUsername(x.username ?? "") === id ||
      (x.memberNo ?? "").toLowerCase() === id ||
      (digits.length >= 8 && x.phone.replace(/[^\d]/g, "") === digits)
    )
  );

  if (!c || !c.pinHash || c.memberActive === false || c.portal === false) return null;
  return verifyPassword(pin, c.pinHash) ? c : null;
}

export { STORE_CLOSE };