"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth, useStore } from "@/lib/store";
import { setSoundEnabled, sfx } from "@/lib/sound";
import { applyTheme, resolveTheme } from "@/lib/brand";
import { DEMO_SHIFT_SPLIT, OPERATING_HOURS } from "@/lib/demo-data";
import { hashPassword, homeFor, roleLabel, routeAllowed, shiftEligible, verifyPassword } from "@/lib/auth";
import type { Perm } from "@/lib/auth";
import type { Product, Transaction } from "@/lib/types";
import { CATEGORY_COLORS, METHOD_COLORS } from "@/lib/types";
import { dateID, num, rupiah, timeID } from "@/lib/format";
import { discountLabel, effectivePrice, hasDiscount, stockOf, todayPromo } from "@/lib/pricing";
import { cashInSession, countdown, fmtDuration, openSessionOf, sessionMinutes } from "@/lib/shift";
import { useToast } from "./Toasts";
import { BrandLockup, BrandMark } from "./Brand";
import { LoginScreen } from "./LoginScreen";
import { LandingPage } from "./LandingPage";
import { ProductThumb } from "./ProductThumb";
import { Highlight, RecentSearches, SearchEmpty, SearchField, SearchFooter, SearchGroup, SearchPanel, useRecentSearches } from "./SearchField";
import { Badge, Button, Drawer, Field, IconBtn, Input, Modal, Skeleton, useClickOutside } from "./ui";
import {
  IArrowRight, IBell, IBox, IChart, IChevronDown, IClock, IGear, IGrid, IHeart, IKey, ILogOut, IMenu,
  IMonitor, IMoon, IPercent, IPlay, IReceipt, IRegister, ISearch, IShield, IStore, ISun,
  IUser, IVolume, IVolumeX,
} from "./icons";

const NAV: { href: string; label: string; icon: typeof IGrid; perm: Perm | null }[] = [
  { href: "/", label: "Dashboard", icon: IGrid, perm: "dashboard" },
  { href: "/kasir", label: "Kasir", icon: IRegister, perm: "pos" },
  { href: "/member", label: "Member", icon: IHeart, perm: "members.view" },
  { href: "/shift", label: "Shift", icon: IClock, perm: "shift.view" },
  { href: "/produk", label: "Produk", icon: IBox, perm: "products.view" },
  { href: "/transaksi", label: "Transaksi", icon: IReceipt, perm: "tx.view" },
  { href: "/analitik", label: "Analitik", icon: IChart, perm: "analytics" },
  { href: "/notifikasi", label: "Notifikasi", icon: IBell, perm: "notif.view" },
  { href: "/pengaturan", label: "Pengaturan", icon: IGear, perm: "settings.self" },
];

type Hit = { kind: "product"; key: string; product: Product } | { kind: "tx"; key: string; tx: Transaction };

function LiveClock() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!now) return <div className="hidden md:block w-24" />;
  return (
    <div className="hidden md:flex flex-col items-end leading-tight">
      <span className="font-mono text-sm font-bold tabular-nums">
        {new Date(now).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
      </span>
      <span className="text-[10px] text-faint">{dateID(now)}</span>
    </div>
  );
}

function NotifBell() {
  const { state } = useStore();
  const path = usePathname();
  const unread = state.notifications.filter((n) => n.ts > state.notifReadAt).length;
  const pulse = unread > 0;
  return (
    <Link href="/notifikasi" aria-label="Notifikasi sistem" className="relative">
      <span className="btn-icon inline-grid"><IBell size={17} /></span>
      {pulse && (
        <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full grid place-items-center text-[8.5px] font-bold text-accent-ink grad-accent anim-pop">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
      {pulse && path !== "/notifikasi" && (
        <span className="absolute top-0 right-0 w-2 h-2 rounded-full pulse-dot" style={{ background: "var(--chili)" }} />
      )}
    </Link>
  );
}

function ShiftBadge() {
  const [h, setH] = useState<number | null>(null);
  useEffect(() => {
    setH(new Date().getHours());
    const t = setInterval(() => setH(new Date().getHours()), 60000);
    return () => clearInterval(t);
  }, []);
  if (h === null) return null;
  const first = OPERATING_HOURS[0];
  const last = OPERATING_HOURS[OPERATING_HOURS.length - 1];
  const open = h >= first && h <= last;
  const shift = !open ? "Di Luar Jam Buka" : h < DEMO_SHIFT_SPLIT ? "Shift Pagi" : "Shift Sore";
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold" style={{ color: open ? "var(--pandan)" : "var(--amber)" }}>
      <span className="w-1.5 h-1.5 rounded-full pulse-dot" style={{ background: "currentColor" }} /> {shift}
    </span>
  );
}

function ShiftStrip() {
  const { state } = useStore();
  const { user, can } = useAuth();
  const path = usePathname();
  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, []);
  if (!user || !can("pos") || !shiftEligible(user) || (path !== "/kasir" && path !== "/shift")) return null;

  const open = openSessionOf(state.shiftSessions, user.id);
  const stats = open ? cashInSession(open, state.transactions) : null;
  const remain = open?.autoCloseAt ? open.autoCloseAt - Date.now() : null;
  const soon = remain !== null && remain < 15 * 60000;

  return (
    <div className="border-b border-line px-4 md:px-6 lg:px-8 py-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px]"
      style={{ background: open ? (soon ? "color-mix(in srgb, var(--amber) 12%, transparent)" : "color-mix(in srgb, var(--pandan) 8%, transparent)") : "color-mix(in srgb, var(--amber) 10%, transparent)" }}>
      {open ? (
        <>
          <span className="inline-flex items-center gap-1.5 font-bold" style={{ color: soon ? "var(--amber)" : "var(--pandan)" }}>
            <span className="w-1.5 h-1.5 rounded-full pulse-dot" style={{ background: "currentColor" }} />
            Shift berjalan · buka {timeID(open.openedAt)}
          </span>
          <span className="text-mute">Durasi <b className="text-ink">{fmtDuration(sessionMinutes(open))}</b></span>
          <span className="text-mute">Trx <b className="text-ink">{stats?.count ?? 0}</b></span>
          <span className="text-mute">Omzet <b className="text-ink">{rupiah(stats?.revenue ?? 0)}</b></span>
          <span className="text-mute hidden sm:inline">Kas diharapkan <b className="text-ink">{rupiah(stats?.expected ?? 0)}</b></span>
          {remain !== null && (
            <span className="font-bold" style={{ color: soon ? "var(--amber)" : "var(--muted)" }}>
              Tutup otomatis {timeID(open.autoCloseAt as number)} · {countdown(remain)} lagi
            </span>
          )}
          <Link href="/shift?tab=shift" className="ml-auto font-bold text-accent inline-flex items-center gap-1">Kelola shift <IArrowRight size={12} /></Link>
        </>
      ) : (
        <>
          <span className="inline-flex items-center gap-1.5 font-bold text-amber"><IClock size={13} /> Shift belum dibuka</span>
          <span className="text-mute hidden sm:inline">Buka shift dengan modal kas awal. Jam tutup mengikuti jadwal.</span>
          <Link href="/shift?tab=shift" className="ml-auto btn btn-primary btn-sm"><IPlay size={12} /> Buka Shift</Link>
        </>
      )}
    </div>
  );
}

function CommandPalette({ variant }: { variant: "inline" | "modal" }) {
  const { state } = useStore();
  const { can, user } = useAuth();
  const router = useRouter();
  const recent = useRecentSearches("global");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  useClickOutside(wrapRef, () => { if (variant === "inline") setOpen(false); });

  const res = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (s.length < 1) return { products: [] as Product[], txs: [] as Transaction[] };
    const scope = can("tx.all") ? state.transactions : state.transactions.filter((t) => t.cashier === user?.name && !t.isTest);
    return {
      products: state.products.filter((p) => p.name.toLowerCase().includes(s) || p.sku.toLowerCase().includes(s) || p.category.toLowerCase().includes(s)).slice(0, 6),
      txs: [...scope].reverse().filter((t) => t.id.toLowerCase().includes(s) || t.customerName.toLowerCase().includes(s) || (t.memberNo ?? "").toLowerCase().includes(s)).slice(0, 4),
    };
  }, [q, state.products, state.transactions, can, user]);

  const hits: Hit[] = useMemo(() => [
    ...res.products.map((p) => ({ kind: "product" as const, key: p.id, product: p })),
    ...res.txs.map((t) => ({ kind: "tx" as const, key: t.id, tx: t })),
  ], [res]);

  useEffect(() => { setActive(0); }, [q]);
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const close = () => { setOpen(false); setQ(""); };

  const pick = (hit: Hit) => {
    recent.push(q);
    router.push(hit.kind === "product" ? `/kasir?q=${encodeURIComponent(hit.product.name)}` : `/transaksi?open=${hit.tx.id}`);
    sfx.tap();
    close();
  };

  const idx = hits.length ? Math.min(active, hits.length - 1) : 0;

  const body = (
    <div ref={listRef} className={variant === "inline" ? "max-h-[62vh] overflow-y-auto" : "max-h-[58vh] overflow-y-auto"}>
      {q.trim().length === 0 ? (
        <>
          <RecentSearches items={recent.items} onPick={(v) => { setQ(v); setOpen(true); }} onClear={recent.clear} />
          {recent.items.length === 0 && (
            <div className="px-3 py-6 text-center">
              <p className="text-sm font-bold">Cari di {state.settings.brandName}</p>
              <p className="text-[11px] text-faint mt-1">Nama produk, SKU, ID transaksi, member, atau pelanggan.</p>
            </div>
          )}
          <SearchGroup label="Akses cepat" icon={<IGrid size={12} />} />
          <div className="grid grid-cols-2 gap-1.5 px-2 pb-2">
            {NAV.filter((n) => !n.perm || can(n.perm)).map((n) => {
              const Icon = n.icon;
              return (
                <Link key={n.href} href={n.href} onClick={close}
                  className="flex items-center gap-2 rounded-xl border border-line bg-surface px-2.5 py-2 text-xs font-bold hover:border-line2 transition-colors">
                  <Icon size={14} className="text-accent" /> {n.label}
                </Link>
              );
            })}
          </div>
        </>
      ) : hits.length === 0 ? (
        <SearchEmpty query={q} />
      ) : (
        <>
          {res.products.length > 0 && <SearchGroup label={`Produk · ${res.products.length}`} icon={<IBox size={12} />} />}
          {res.products.map((p, i) => {
            const st = stockOf(p, state.products);
            const promo = todayPromo(p);
            const on = idx === i;
            return (
              <button key={p.id} data-active={on} onMouseEnter={() => setActive(i)} onClick={() => pick(hits[i])}
                className="w-full flex items-center gap-2.5 px-2 py-2 rounded-xl text-left transition-colors"
                style={{ background: on ? "var(--surface2)" : "transparent" }}>
                <ProductThumb name={p.name} photo={p.photo} category={p.category} size={34} rounded={10} />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-bold truncate"><Highlight text={p.name} query={q} /></span>
                  <span className="flex items-center gap-1.5 text-[10px] text-faint font-mono">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: CATEGORY_COLORS[p.category] }} />
                    <Highlight text={p.sku} query={q} />
                    <span>· {p.kind === "bundle" ? `${num(st)} porsi` : `stok ${num(st)}`}</span>
                  </span>
                </span>
                {promo && <Badge color="var(--amber)"><IPercent size={10} /> {discountLabel(promo)}</Badge>}
                <span className="text-right shrink-0">
                  <span className="block text-xs font-mono font-bold text-accent">{rupiah(effectivePrice(p))}</span>
                  {hasDiscount(p) && <span className="block text-[9px] text-faint line-through">{rupiah(p.price)}</span>}
                </span>
                <IArrowRight size={13} className={on ? "text-accent" : "text-faint opacity-0"} />
              </button>
            );
          })}

          {res.txs.length > 0 && <SearchGroup label={`Transaksi · ${res.txs.length}`} icon={<IReceipt size={12} />} />}
          {res.txs.map((t, j) => {
            const i = res.products.length + j;
            const on = idx === i;
            return (
              <button key={t.id} data-active={on} onMouseEnter={() => setActive(i)} onClick={() => pick(hits[i])}
                className="w-full flex items-center gap-2.5 px-2 py-2 rounded-xl text-left transition-colors"
                style={{ background: on ? "var(--surface2)" : "transparent" }}>
                <span className="w-8 h-8 rounded-lg grid place-items-center shrink-0"
                  style={{ color: METHOD_COLORS[t.method], background: `color-mix(in srgb, ${METHOD_COLORS[t.method]} 14%, transparent)` }}>
                  <IReceipt size={14} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-mono font-bold truncate"><Highlight text={t.id} query={q} /></span>
                  <span className="block text-[10px] text-faint truncate">
                    <Highlight text={t.customerName} query={q} /> · {dateID(t.ts)} {timeID(t.ts)}
                  </span>
                </span>
                {t.status === "Refund" && <Badge color="var(--chili)">Refund</Badge>}
                <span className="text-xs font-mono font-bold shrink-0">{rupiah(t.total)}</span>
                <IArrowRight size={13} className={on ? "text-accent" : "text-faint opacity-0"} />
              </button>
            );
          })}
        </>
      )}
      <SearchFooter />
    </div>
  );

  if (variant === "modal") {
    return (
      <>
        <IconBtn label="Cari" className="md:hidden" onClick={() => { setOpen(true); sfx.tap(); }}><ISearch size={17} /></IconBtn>
        <Modal open={open} onClose={close} title="Pencarian">
          <SearchField value={q} onChange={setQ} size="md" autoFocus ariaLabel="Cari"
            placeholder="Cari produk, transaksi, member…" count={hits.length}
            onEnter={() => hits[idx] && pick(hits[idx])} onEscape={close}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, Math.max(0, hits.length - 1))); }
              if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
            }} />
          <div className="mt-3">{body}</div>
        </Modal>
      </>
    );
  }

  return (
    <div ref={wrapRef} className="relative hidden md:block">
      <SearchField value={q} onChange={(v) => { setQ(v); setOpen(true); }} onFocus={() => setOpen(true)}
        onHotkey={() => setOpen(true)} shortcut="mod+k" size="sm" ariaLabel="Cari"
        placeholder="Cari produk, transaksi, member…" count={q.trim() ? hits.length : null} className="w-56 xl:w-72"
        onEnter={() => hits[idx] && pick(hits[idx])} onEscape={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, Math.max(0, hits.length - 1))); }
          if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
        }} />
      {open && <div className="absolute top-full left-0 mt-2 w-[420px] max-w-[86vw] z-50"><SearchPanel>{body}</SearchPanel></div>}
    </div>
  );
}

function PasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { dispatch } = useStore();
  const { user } = useAuth();
  const { push } = useToast();
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => { if (open) { setCur(""); setNext(""); setConfirm(""); setErr(""); } }, [open]);

  const save = () => {
    if (!user) return;
    if (!verifyPassword(cur, user.passHash)) { setErr("Password saat ini salah."); sfx.error(); return; }
    if (next.length < 6) { setErr("Password baru minimal 6 karakter."); sfx.error(); return; }
    if (next !== confirm) { setErr("Konfirmasi password tidak sama."); sfx.error(); return; }
    dispatch({ type: "UPDATE_USER", user: { ...user, passHash: hashPassword(next) } });
    sfx.success();
    push({ msg: "Password berhasil diganti", type: "ok" });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Ganti Password"
      footer={<div className="flex gap-2 justify-end"><Button variant="ghost" onClick={onClose}>Batal</Button><Button onClick={save}>Simpan Password</Button></div>}>
      <div className="space-y-4">
        <Field label="Password saat ini" error={err}><Input type="password" value={cur} onChange={(e) => { setCur(e.target.value); setErr(""); }} autoFocus /></Field>
        <Field label="Password baru" hint="Minimal 6 karakter"><Input type="password" value={next} onChange={(e) => { setNext(e.target.value); setErr(""); }} /></Field>
        <Field label="Ulangi password baru"><Input type="password" value={confirm} onChange={(e) => { setConfirm(e.target.value); setErr(""); }} /></Field>
      </div>
    </Modal>
  );
}

function ProfileMenu({ onPassword }: { onPassword: () => void }) {
  const { state, dispatch } = useStore();
  const { user, role } = useAuth();
  const { push } = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false));
  if (!user) return null;

  const initials = user.name.split(" ").slice(0, 2).map((w: string) => w[0]).join("").toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button onClick={() => { setOpen((v) => !v); sfx.tap(); }} title="Akun saya"
        className="flex items-center gap-2 rounded-xl border border-line bg-surface px-2 py-1.5 hover:border-line2 transition-colors">
        <span className="w-7 h-7 rounded-lg grid place-items-center text-[11px] font-bold text-accent-ink grad-accent">{initials}</span>
        <span className="hidden xl:block text-left leading-tight">
          <span className="block text-xs font-bold max-w-[110px] truncate">{user.name}</span>
          <span className="block text-[9px] text-faint uppercase tracking-wider">{roleLabel(role)}</span>
        </span>
        <IChevronDown size={13} className="hidden xl:block text-faint" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 card p-2 z-50 anim-pop">
          <div className="px-3 py-2.5 border-b border-line">
            <p className="text-sm font-bold truncate">{user.name}</p>
            <p className="text-[11px] text-faint font-mono">@{user.username}</p>
            <span className="mt-2 inline-block">
              <Badge color={role === "admin" ? "var(--accent)" : "var(--amber)"}>
                {role === "admin" ? <IShield size={11} /> : <IRegister size={11} />} {roleLabel(role)}
              </Badge>
            </span>
            {state.session && <p className="text-[10px] text-faint mt-2">Masuk sejak {timeID(state.session.since)}</p>}
            {role === "admin" && <p className="text-[10px] text-faint mt-1">Kasir admin = mode uji (transaksi tidak dicatat)</p>}
          </div>
          <button onClick={() => { setOpen(false); onPassword(); }}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-surface2 text-left text-xs font-bold">
            <IKey size={15} className="text-mute" /> Ganti password
          </button>
          <Link href="/notifikasi" onClick={() => setOpen(false)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-surface2 text-left text-xs font-bold">
            <IBell size={15} className="text-mute" /> Notifikasi sistem
          </Link>
          <Link href="/beranda" onClick={() => setOpen(false)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-surface2 text-left text-xs font-bold">
            <IStore size={15} className="text-mute" /> Halaman pelanggan
          </Link>
          <Link href="/pengaturan" onClick={() => setOpen(false)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-surface2 text-left text-xs font-bold">
            <IGear size={15} className="text-mute" /> Pengaturan
          </Link>
          <button onClick={() => {
            setOpen(false);
            dispatch({ type: "LOGOUT" });
            sfx.remove();
            push({ msg: "Berhasil keluar", type: "info" });
            router.replace("/login");
          }} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-surface2 text-left text-xs font-bold text-chili">
            <ILogOut size={15} /> Keluar
          </button>
        </div>
      )}
    </div>
  );
}

function SidebarContent({ onNavigate, onPassword }: { onNavigate?: () => void; onPassword: () => void }) {
  const path = usePathname();
  const { state, dispatch } = useStore();
  const { user, role, can } = useAuth();
  const { push } = useToast();
  const router = useRouter();
  const items = NAV.filter((n) => !n.perm || can(n.perm));
  const memberCount = state.customers.filter((c) => c.member).length;
  const unread = state.notifications.filter((n) => n.ts > state.notifReadAt).length;

  return (
    <div className="flex flex-col h-full">
      <Link href={homeFor(role)} onClick={onNavigate} className="flex items-center px-5 py-3 min-h-16 border-b border-line shrink-0">
        <BrandLockup settings={state.settings} />
      </Link>
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <p className="text-[10px] font-bold text-faint uppercase tracking-widest px-3 pb-2">Menu {roleLabel(role)}</p>
        {items.map((n) => {
          const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
          const Icon = n.icon;
          return (
            <Link key={n.href} href={n.href} onClick={onNavigate} aria-current={active ? "page" : undefined}
              className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${active ? "text-accent-ink" : "text-mute hover:text-ink hover:bg-surface2"}`}
              style={active ? { background: "linear-gradient(135deg, var(--accent), var(--accent2))", boxShadow: "0 6px 20px var(--accent-soft)" } : undefined}>
              <Icon size={18} />
              {n.label}
              {n.href === "/kasir" && state.held.length > 0 && (
                <span className="ml-auto text-[10px] font-bold rounded-full px-1.5 py-0.5"
                  style={{ background: active ? "rgba(0,0,0,.2)" : "var(--amber)", color: active ? "inherit" : "var(--amber-ink)" }}>
                  {state.held.length}
                </span>
              )}
              {n.href === "/member" && memberCount > 0 && (
                <span className="ml-auto text-[10px] font-bold rounded-full px-1.5 py-0.5"
                  style={{ background: active ? "rgba(0,0,0,.2)" : "var(--violet)", color: "#fff" }}>
                  {memberCount}
                </span>
              )}
              {n.href === "/notifikasi" && unread > 0 && (
                <span className="ml-auto text-[10px] font-bold rounded-full px-1.5 py-0.5"
                  style={{ background: active ? "rgba(0,0,0,.2)" : "var(--chili)", color: "#fff" }}>
                  {unread}
                </span>
              )}
            </Link>
          );
        })}
        <div className="border-t border-line mt-3 pt-3 space-y-1">
          <Link href="/beranda" onClick={onNavigate} className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-bold text-mute hover:text-ink hover:bg-surface2">
            <IStore size={17} /> Halaman pelanggan
          </Link>
          <Link href="/memberku" onClick={onNavigate} className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-bold text-mute hover:text-ink hover:bg-surface2">
            <IHeart size={17} /> Portal member
          </Link>
        </div>
      </nav>
      <div className="p-4 border-t border-line space-y-3 shrink-0">
        <div className="rounded-xl border border-line bg-surface p-3">
          <div className="flex items-center gap-2">
            <IStore size={15} className="text-accent" />
            <p className="text-xs font-bold truncate">{state.settings.storeName}</p>
          </div>
          <div className="mt-1.5 flex items-center justify-between">
            <ShiftBadge />
            <span className="text-[10px] text-faint inline-flex items-center gap-1">
              <IClock size={11} /> {OPERATING_HOURS[0]}–{OPERATING_HOURS[OPERATING_HOURS.length - 1] + 1}
            </span>
          </div>
        </div>
        {user && (
          <div className="rounded-xl border border-line bg-surface p-3">
            <div className="flex items-center gap-2">
              {role === "admin" ? <IShield size={14} className="text-accent" /> : <IUser size={14} className="text-amber" />}
              <p className="text-xs font-bold truncate flex-1">{user.name}</p>
            </div>
            <div className="flex gap-1.5 mt-2">
              <button onClick={onPassword} className="chip !py-1 !px-2 !text-[10px]"><IKey size={11} /> Password</button>
              <button onClick={() => {
                dispatch({ type: "LOGOUT" });
                sfx.remove();
                push({ msg: "Berhasil keluar", type: "info" });
                router.replace("/login");
              }} className="chip !py-1 !px-2 !text-[10px] hover:!text-chili"><ILogOut size={11} /> Keluar</button>
            </div>
          </div>
        )}
        <p className="text-[10px] text-faint text-center">v1.8 · shift kasir · poin & tier · demo lokal</p>
      </div>
    </div>
  );
}

function AccessDenied({ path }: { path: string }) {
  const { can } = useAuth();
  const router = useRouter();
  return (
    <div className="card p-10 text-center max-w-lg mx-auto mt-8 rise">
      <span className="w-14 h-14 rounded-2xl grid place-items-center mx-auto"
        style={{ color: "var(--amber)", background: "color-mix(in srgb, var(--amber) 14%, transparent)" }}>
        <IShield size={26} />
      </span>
      <h2 className="font-display font-bold text-xl mt-4">Bukan ruang kerja kasir</h2>
      <p className="text-sm text-mute mt-2">
        Halaman <code className="kbd">{path}</code> hanya untuk <b className="text-ink">Administrator</b>.
        Kasir fokus pada jualan, member, shift, dan struk sendiri.
      </p>
      <div className="flex flex-wrap gap-2 justify-center mt-5">
        {can("pos") && <Button onClick={() => router.replace("/kasir")}><IRegister size={16} /> Ke kasir</Button>}
        {can("members.view") && <Button variant="ghost" onClick={() => router.replace("/member")}><IHeart size={16} /> Member</Button>}
        <Button variant="ghost" onClick={() => router.replace("/shift")}><IClock size={16} /> Shift saya</Button>
      </div>
    </div>
  );
}

function BootScreen() {
  const { state } = useStore();
  return (
    <div className="min-h-dvh grid place-items-center px-6">
      <div className="w-full max-w-sm text-center">
        <div className="flex justify-center"><BrandLockup settings={state.settings} size={44} /></div>
        <p className="text-xs text-faint mt-4">Menyiapkan ruang kerja…</p>
        <div className="space-y-2 mt-6">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5 mx-auto" />
          <Skeleton className="h-3 w-3/5 mx-auto" />
        </div>
      </div>
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const { state, dispatch } = useStore();
  const { user, role, can } = useAuth();
  const { push } = useToast();
  const path = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [resolved, setResolved] = useState<"dark" | "light">("dark");

  useEffect(() => {
    if (!state.hydrated) return;
    const mode = state.settings.theme;
    applyTheme(mode);
    setResolved(resolveTheme(mode));
    if (mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const h = () => { applyTheme("system"); setResolved(resolveTheme("system")); };
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, [state.hydrated, state.settings.theme]);

  useEffect(() => {
    if (!state.hydrated) return;
    document.documentElement.dataset.accent = state.settings.accent;
  }, [state.hydrated, state.settings.accent]);

  useEffect(() => { setSoundEnabled(state.settings.sound); }, [state.settings.sound]);

  useEffect(() => {
    const label = NAV.find((n) => (n.href === "/" ? path === "/" : path.startsWith(n.href)))?.label
      ?? (path === "/beranda" ? "Beranda" : path === "/memberku" ? "Portal member" : "Masuk");
    document.title = `${label} • ${path === "/beranda" || path === "/memberku" ? state.settings.storeName : state.settings.brandName}`;
  }, [path, state.settings.brandName, state.settings.storeName]);

  useEffect(() => {
    if (state.hydrated && state.session && user && !user.active) {
      dispatch({ type: "LOGOUT" });
      push({ msg: "Akun dinonaktifkan — sesi diakhiri", type: "err" });
      router.replace("/login");
    }
  }, [state.hydrated, state.session, user, dispatch, push, router]);

  useEffect(() => {
    if (state.hydrated && user && path === "/" && !can("dashboard")) router.replace("/kasir");
  }, [state.hydrated, user, path, can, router]);

  const toggleSound = () => {
    const next = !state.settings.sound;
    dispatch({ type: "UPDATE_SETTINGS", patch: { sound: next } });
    setSoundEnabled(next);
    if (next) sfx.tap();
  };

  const toggleTheme = () => {
    const next = resolved === "dark" ? "light" : "dark";
    dispatch({ type: "UPDATE_SETTINGS", patch: { theme: next } });
    sfx.tap();
    push({ msg: next === "light" ? "Mode terang aktif ☀️" : "Mode gelap aktif 🌙", type: "ok", dur: 2000 });
  };

  if (!state.hydrated) return <BootScreen />;
  if (path === "/beranda") return <div className="relative z-10">{children}</div>;
  if (path === "/memberku") return <div className="relative z-10">{children}</div>;
  if (path === "/login") return <div className="relative z-10">{children}</div>;
  if (!state.session || !user) return path === "/" ? <LandingPage /> : <LoginScreen />;

  const themeLabel = state.settings.theme === "system" ? "Sistem" : resolved === "dark" ? "Gelap" : "Terang";
  const ThemeIcon = state.settings.theme === "system" ? IMonitor : resolved === "dark" ? IMoon : ISun;
  const navItems = NAV.filter((n) => !n.perm || can(n.perm));
  const mobileItems = navItems.slice(0, 5);
  const allowed = routeAllowed(path, role);
  const current = NAV.find((n) => (n.href === "/" ? path === "/" : path.startsWith(n.href)));

  return (
    <div className="min-h-dvh">
      <div className="aurora" aria-hidden><i /><i /><i /></div>
      <div className="grain" aria-hidden />

      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-60 z-40 border-r border-line bg-bg2/90 backdrop-blur-xl flex-col">
        <SidebarContent onPassword={() => setPwOpen(true)} />
      </aside>

      <div className="lg:pl-60 relative z-10">
        <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-xl">
          <div className="h-16 flex items-center gap-2 md:gap-3 px-4 md:px-6 lg:px-8">
            <IconBtn label="Menu" className="lg:hidden" onClick={() => setMenuOpen(true)}><IMenu size={18} /></IconBtn>
            <Link href={homeFor(role)} className="lg:hidden flex items-center gap-2 min-w-0">
              <BrandMark settings={state.settings} size={28} />
              {state.settings.showWordmark && <span className="font-display font-bold text-sm truncate">{state.settings.brandName}</span>}
            </Link>
            <h1 className="hidden lg:flex items-center gap-2 font-display font-bold text-base">
              {current?.label ?? state.settings.brandName}
              <Badge color={role === "admin" ? "var(--accent)" : "var(--amber)"}>
                {role === "admin" ? <IShield size={10} /> : <IRegister size={10} />} {roleLabel(role)}
              </Badge>
            </h1>
            <div className="flex-1" />
            <CommandPalette variant="inline" />
            <CommandPalette variant="modal" />
            <LiveClock />
            <NotifBell />
            <IconBtn label={`Tema: ${themeLabel} — klik untuk ganti`} onClick={toggleTheme}><ThemeIcon size={17} /></IconBtn>
            <IconBtn label={state.settings.sound ? "Matikan suara" : "Nyalakan suara"} active={state.settings.sound} onClick={toggleSound}>
              {state.settings.sound ? <IVolume size={17} /> : <IVolumeX size={17} />}
            </IconBtn>
            {can("pos") && path !== "/kasir" && (
              <Link href="/kasir" className="btn btn-primary btn-sm hidden sm:inline-flex"><IRegister size={15} /> Buka Kasir</Link>
            )}
            <ProfileMenu onPassword={() => setPwOpen(true)} />
          </div>
          <ShiftStrip />
        </header>

        <main className="mx-auto w-full max-w-[1440px] px-4 md:px-6 lg:px-8 pt-6 pb-28 lg:pb-10">
          {allowed ? children : <AccessDenied path={path} />}
        </main>
      </div>

      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-line bg-bg2/95 backdrop-blur-xl" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="grid h-16" style={{ gridTemplateColumns: `repeat(${mobileItems.length}, minmax(0,1fr))` }}>
          {mobileItems.map((n) => {
            const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
            const Icon = n.icon;
            return (
              <Link key={n.href} href={n.href} aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center justify-center gap-1 text-[10px] font-bold transition-colors ${active ? "text-accent" : "text-faint"}`}>
                <span className={`grid place-items-center w-9 h-6 rounded-full transition-colors ${active ? "bg-accent-soft" : ""}`}><Icon size={18} /></span>
                {n.label}
              </Link>
            );
          })}
        </div>
      </nav>

      <Drawer open={menuOpen} onClose={() => setMenuOpen(false)} side="left"
        title={<BrandLockup settings={state.settings} size={24} compact />}>
        <div className="-mx-5 -my-4 h-[calc(100dvh-65px)]">
          <SidebarContent onNavigate={() => setMenuOpen(false)} onPassword={() => { setMenuOpen(false); setPwOpen(true); }} />
        </div>
      </Drawer>

      <PasswordModal open={pwOpen} onClose={() => setPwOpen(false)} />
    </div>
  );
}