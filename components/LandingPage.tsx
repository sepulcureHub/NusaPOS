"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import type { Product } from "@/lib/types";
import { CATEGORIES, CATEGORY_COLORS } from "@/lib/types";
import { DEMO_LANDING, STORE_CLOSE, STORE_OPEN } from "@/lib/demo-data";
import { applyTheme, resolveTheme } from "@/lib/brand";
import { dateFull, num, rupiah } from "@/lib/format";
import {
  DAY_FULL, DAY_ORDER, DAY_SHORT, activeDiscount, bundleBaseTotal, bundleComponents, discountAmount,
  discountLabel, effectivePrice, hasDiscount, isAvailableOn, isAvailableToday, isLimited,
  nextAvailableDay, promoDays, promoForDay, stockOf, todayPromo,
} from "@/lib/pricing";
import { ProductThumb } from "./ProductThumb";
import { SearchField } from "./SearchField";
import { Marquee } from "./Marquee";
import { StoreMap, parseAddress } from "./StoreMap";
import { MemberBenefitsPanel, TierLadder } from "./MemberBenefits";
import { BrandLockup } from "./Brand";
import { Badge, Button, Chip, IconBtn, Modal, Segmented } from "./ui";
import {
  IArrowRight, IBox, ICalendar, ICheck, IChevronDown, IClock, IHeart, IInfo,
  IMapPin, IMoon, IPause, IPercent, IPhone, IPlay, IRegister, IRefresh,
  ISparkle, IStar, IStore, ISun, ITag, IUserPlus,
} from "./icons";

const SECTIONS = [
  { id: "promo", label: "Promo" },
  { id: "menu", label: "Menu" },
  { id: "paket", label: "Paket" },
  { id: "member", label: "Member" },
  { id: "cerita", label: "Cerita" },
  { id: "kunjungi", label: "Kunjungi" },
];

const PROMO_GRID: Record<"s" | "m" | "l", string> = {
  s: "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6",
  m: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5",
  l: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
};
const PROMO_ASPECT: Record<"s" | "m" | "l", string> = { s: "1 / 1", m: "4 / 3", l: "16 / 10" };
const MENU_GRID: Record<"s" | "m", string> = {
  s: "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6",
  m: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
};

function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") { setSeen(true); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { setSeen(true); io.disconnect(); } });
    }, { threshold: 0.1, rootMargin: "0px 0px -50px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return { ref, seen };
}

function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const { ref, seen } = useReveal<HTMLDivElement>();
  return (
    <div ref={ref} className={className}
      style={{
        opacity: seen ? 1 : 0,
        transform: seen ? "none" : "translateY(24px)",
        transition: `opacity .7s cubic-bezier(.22,1,.36,1) ${delay}ms, transform .7s cubic-bezier(.22,1,.36,1) ${delay}ms`,
      }}>
      {children}
    </div>
  );
}

function useFavorites() {
  const key = "nusapos:favorites";
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) { const p = JSON.parse(raw); if (Array.isArray(p)) setIds(p.filter((x) => typeof x === "string")); }
    } catch { /* abaikan */ }
  }, []);
  const toggle = (id: string) => setIds((prev) => {
    const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* penuh */ }
    return next;
  });
  return { ids, toggle };
}

export function LandingPage() {
  const { state, dispatch } = useStore();
  const s = state.settings;
  const fav = useFavorites();

  const [q, setQ] = useState("");
  const [cat, setCat] = useState("Semua");
  const [onlyToday, setOnlyToday] = useState(true);
  const [hideOut, setHideOut] = useState(false);
  const [onlyFav, setOnlyFav] = useState(false);
  const [menuSize, setMenuSize] = useState<"s" | "m">("s");
  const [promoSize, setPromoSize] = useState<"s" | "m" | "l">("s");
  const [promoSource, setPromoSource] = useState<"semua" | "terjadwal" | "dasar">("semua");
  const [promoDayOverride, setPromoDayOverride] = useState<number | null>(null);
  const [detail, setDetail] = useState<Product | null>(null);
  const [active, setActive] = useState("promo");
  const [scrollY, setScrollY] = useState(0);
  const [now, setNow] = useState<number | null>(null);
  const [faqOpen, setFaqOpen] = useState<number | null>(0);
  const [mqPaused, setMqPaused] = useState(false);
  const [mqSpeed, setMqSpeed] = useState(1);
  const [mqFlip, setMqFlip] = useState(false);

  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => { applyTheme(s.theme); document.documentElement.dataset.accent = s.accent; }, [s.theme, s.accent]);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => setScrollY(window.scrollY)); };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); };
  }, []);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) setActive(e.target.id); });
    }, { rootMargin: "-45% 0px -50% 0px" });
    SECTIONS.forEach((x) => { const el = document.getElementById(x.id); if (el) io.observe(el); });
    return () => io.disconnect();
  }, []);

  const resolved = resolveTheme(s.theme);
  const toggleTheme = () => {
    const next = resolved === "dark" ? "light" : "dark";
    dispatch({ type: "UPDATE_SETTINGS", patch: { theme: next } });
    applyTheme(next);
  };

  const today = now ? new Date(now).getDay() : new Date().getDay();
  const promoDay = promoDayOverride ?? today;
  const hour = now ? new Date(now).getHours() : null;
  const isOpen = hour !== null && hour >= parseInt(STORE_OPEN) && hour < parseInt(STORE_CLOSE);
  const parsed = useMemo(() => parseAddress(s.address), [s.address]);

  const live = useMemo(() => state.products.filter((p) => p.active), [state.products]);
  const todayMenu = useMemo(() => live.filter((p) => isAvailableToday(p)), [live]);
  const bundles = useMemo(() => live.filter((p) => p.kind === "bundle"), [live]);
  const limited = useMemo(() => live.filter((p) => isLimited(p)), [live]);
  const outToday = useMemo(() => todayMenu.filter((p) => stockOf(p, state.products) <= 0).length, [todayMenu, state.products]);
  const promoTodayCount = useMemo(() => live.filter((p) => hasDiscount(p)).length, [live]);
  const memberCount = state.customers.filter((c) => c.member).length;

  const hero = useMemo(() => {
    const withPhoto = todayMenu.filter((p) => p.photo);
    const pool = withPhoto.length >= 3 ? withPhoto : todayMenu;
    return [...pool].sort((a, b) => b.popularity - a.popularity).slice(0, 3);
  }, [todayMenu]);

  const promoList = useMemo(() => {
    const list = live.filter((p) => {
      const day = promoForDay(p, promoDay);
      const base = discountAmount(p.price, p.discount) > 0;
      if (!day && !base) return false;
      if (promoSource === "terjadwal") return !!day;
      if (promoSource === "dasar") return !day && base;
      return true;
    });
    return list.sort((a, b) => (b.price - effectivePrice(b, promoDay)) - (a.price - effectivePrice(a, promoDay)));
  }, [live, promoDay, promoSource]);

  const weekPromos = useMemo(() => DAY_ORDER.map((d) => {
    const items = live.filter((p) => !!promoForDay(p, d));
    const best = items.reduce((a, p) => Math.max(a, p.price - effectivePrice(p, d)), 0);
    return { day: d, count: items.length, best };
  }), [live]);

  const menu = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return live.filter((p) => {
      const st = stockOf(p, state.products);
      if (cat !== "Semua" && p.category !== cat) return false;
      if (onlyToday && !isAvailableToday(p)) return false;
      if (hideOut && st <= 0) return false;
      if (onlyFav && !fav.ids.includes(p.id)) return false;
      if (needle && !(p.name.toLowerCase().includes(needle) || p.desc.toLowerCase().includes(needle) || p.sku.toLowerCase().includes(needle) || p.category.toLowerCase().includes(needle))) return false;
      return true;
    });
  }, [live, state.products, q, cat, onlyToday, hideOut, onlyFav, fav.ids]);

  /** Satu baris teks berjalan: produk tersedia hari ini + produk promo hari ini. */
  const ticker = useMemo(() => {
    const map = new Map<string, { p: Product; kind: "promo" | "tersedia" }>();

    todayMenu.forEach((p) => {
      map.set(p.id, { p, kind: hasDiscount(p) ? "promo" : "tersedia" });
    });

    live.filter(hasDiscount).forEach((p) => {
      const cur = map.get(p.id);
      if (!cur) map.set(p.id, { p, kind: "promo" });
      else if (cur.kind !== "promo") map.set(p.id, { p: cur.p, kind: "promo" });
    });

    return [...map.values()].sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "promo" ? -1 : 1;
      return a.p.name.localeCompare(b.p.name);
    });
  }, [todayMenu, live]);

  const waNumber = s.phone.replace(/[^0-9]/g, "").replace(/^0/, "62");
  const avgRating = DEMO_LANDING.testimonials.reduce((a, t) => a + t.rating, 0) / DEMO_LANDING.testimonials.length;

  const promoCard = (p: Product, i: number) => {
    const day = promoForDay(p, promoDay);
    const act = activeDiscount(p, promoDay);
    const eff = effectivePrice(p, promoDay);
    const cut = p.price - eff;
    const st = stockOf(p, state.products);
    const sold = st <= 0;
    const sells = isAvailableOn(p, promoDay);
    const compact = promoSize === "s";
    return (
      <Reveal key={p.id} delay={Math.min(i, 14) * 26}>
        <button onClick={() => setDetail(p)} className="card overflow-hidden text-left w-full h-full group hover:-translate-y-1 transition-transform">
          <div className="relative" style={{ aspectRatio: PROMO_ASPECT[promoSize] }}>
            <ProductThumb name={p.name} photo={p.photo} category={p.category} fill rounded={0}
              className="transition-transform duration-500 group-hover:scale-105" />
            <span className="absolute inset-x-0 top-0 h-12 pointer-events-none"
              style={{ background: "linear-gradient(180deg, color-mix(in srgb, var(--bg) 62%, transparent), transparent)" }} />
            <span className="absolute top-1.5 left-1.5">
              <span className={`inline-flex items-center gap-1 rounded-full font-bold grad-accent text-accent-ink shadow-lg ${compact ? "px-1.5 py-0.5 text-[9.5px]" : "px-2.5 py-1 text-xs"}`}>
                <IPercent size={compact ? 9 : 12} /> {discountLabel(act)}
              </span>
            </span>
            {day && <span className="absolute top-1.5 right-1.5"><Badge color="var(--magenta)">{DAY_SHORT[promoDay]}</Badge></span>}
            {(sold || !sells) && (
              <span className="absolute inset-0 grid place-items-center px-1.5" style={{ background: "color-mix(in srgb, var(--bg) 66%, transparent)" }}>
                <span className="text-[9.5px] font-bold px-2 py-1 rounded-full bg-overlay border border-line2 text-center leading-snug">
                  {sold ? "Habis" : `Tidak dijual ${DAY_SHORT[promoDay]}`}
                </span>
              </span>
            )}
          </div>
          <div className={compact ? "p-2" : "p-3.5"}>
            <p className={`font-bold leading-tight line-clamp-2 ${compact ? "text-[11px] min-h-[2.2em]" : "text-sm"}`}>{p.name}</p>
            {!compact && <p className="text-[11px] text-mute mt-1 line-clamp-2 leading-snug">{p.desc}</p>}
            <div className="flex items-baseline gap-1 mt-1.5 flex-wrap">
              <span className={`font-display font-bold text-accent tabular-nums ${compact ? "text-[12.5px]" : "text-xl"}`}>{rupiah(eff)}</span>
              <span className={`text-faint line-through ${compact ? "text-[9px]" : "text-xs"}`}>{rupiah(p.price)}</span>
            </div>
            <div className="flex items-center justify-between gap-1 mt-1">
              <span className={`font-bold text-pandan ${compact ? "text-[9px]" : "text-[11px]"}`}>hemat {rupiah(cut)}</span>
              {!compact && <span className="text-[10px] text-faint">{day ? `promo ${DAY_FULL[promoDay]}` : "diskon dasar"}</span>}
            </div>
          </div>
        </button>
      </Reveal>
    );
  };

  return (
    <div className="relative min-h-dvh overflow-x-hidden">
      <div className="aurora" aria-hidden><i /><i /><i /></div>
      <div className="grain" aria-hidden />

      <header className="fixed top-0 inset-x-0 z-50 border-b border-line bg-bg/85 backdrop-blur-xl">
        <div className="mx-auto max-w-[1280px] h-16 px-4 md:px-6 flex items-center gap-3">
          <Link href="/beranda" className="shrink-0"><BrandLockup settings={s} size={30} compact /></Link>
          <span className="hidden xl:inline-flex items-center gap-1.5 text-[11px] font-bold ml-2"
            style={{ color: isOpen ? "var(--pandan)" : "var(--amber)" }}>
            <span className="w-1.5 h-1.5 rounded-full pulse-dot" style={{ background: "currentColor" }} />
            {isOpen ? "Buka sekarang" : "Sedang tutup"}
          </span>
          <nav className="hidden lg:flex items-center gap-1 ml-auto">
            {SECTIONS.map((x) => (
              <a key={x.id} href={`#${x.id}`}
                className="px-3 py-2 rounded-xl text-xs font-bold transition-colors"
                style={{ color: active === x.id ? "var(--accent)" : "var(--muted)", background: active === x.id ? "var(--accent-soft)" : "transparent" }}>
                {x.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2 ml-auto lg:ml-2">
            <IconBtn label={resolved === "dark" ? "Mode terang" : "Mode gelap"} onClick={toggleTheme}>
              {resolved === "dark" ? <IMoon size={16} /> : <ISun size={16} />}
            </IconBtn>
            {state.session ? (
              <Link href="/" className="btn btn-primary btn-sm"><IRegister size={14} /> Ruang staf</Link>
            ) : state.memberSession ? (
              <Link href="/memberku" className="btn btn-primary btn-sm"><IHeart size={14} /> Portal member</Link>
            ) : (
              <>
                <Link href="/login" className="btn btn-primary btn-sm"><IRegister size={14} /> Masuk</Link>
                <Link href="/memberku" className="btn btn-ghost btn-sm hidden sm:inline-flex"><IHeart size={14} /> Portal member</Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="relative z-10 pt-16">
        {/* HERO */}
        <section className="relative px-4 md:px-6 pt-12 md:pt-20 pb-12">
          <div className="mx-auto max-w-[1280px] grid lg:grid-cols-[1.05fr_.95fr] gap-10 items-center">
            <div>
              <Reveal>
                <span className="inline-flex items-center gap-2 rounded-full border border-line2 bg-surface px-3 py-1.5 text-[11px] font-bold text-mute">
                  <IStore size={13} className="text-accent" /> {DEMO_LANDING.eyebrow} · {parsed.city || parsed.label}
                </span>
              </Reveal>
              <Reveal delay={80}>
                <h1 className="font-display font-bold leading-[0.98] mt-5" style={{ fontSize: "clamp(2.4rem, 6vw, 4.6rem)" }}>
                  {DEMO_LANDING.headline[0]}<br />
                  <span className="text-grad">{DEMO_LANDING.headline[1]}</span><br />
                  {DEMO_LANDING.headline[2]}
                </h1>
              </Reveal>
              <Reveal delay={150}>
                <p className="text-sm md:text-base text-mute mt-5 max-w-xl leading-relaxed">{DEMO_LANDING.sub}</p>
              </Reveal>
              <Reveal delay={220}>
                <div className="flex flex-wrap gap-2.5 mt-7">
                  <a href="#promo" className="btn btn-primary"><IPercent size={16} /> Promo {DAY_FULL[today]} ({promoTodayCount})</a>
                  <a href="#member" className="btn btn-ghost"><IHeart size={16} /> Benefit member</a>
                  <Link href="/login" className="btn btn-ghost"><IRegister size={16} /> Masuk staf / member</Link>
                </div>
              </Reveal>
              <Reveal delay={290}>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mt-8 pt-6 border-t border-line">
                  {[
                    { k: `${todayMenu.length}`, v: "menu siap hari ini" },
                    { k: `${memberCount}`, v: "member terdaftar" },
                    { k: avgRating.toFixed(1), v: `rating ${DEMO_LANDING.testimonials.length} ulasan` },
                    { k: `${STORE_OPEN}–${STORE_CLOSE}`, v: "buka setiap hari" },
                  ].map((x) => (
                    <div key={x.v}>
                      <p className="font-display font-bold text-xl text-accent">{x.k}</p>
                      <p className="text-[11px] text-faint">{x.v}</p>
                    </div>
                  ))}
                </div>
              </Reveal>
            </div>

            <Reveal delay={120}>
              <div className="relative h-[380px] md:h-[460px]" style={{ transform: `translateY(${Math.min(scrollY * 0.06, 40)}px)` }}>
                <div className="absolute inset-0 rounded-[36px] border border-line2 overflow-hidden"
                  style={{ background: "linear-gradient(150deg, color-mix(in srgb, var(--accent) 22%, var(--surface)), var(--surface) 45%, color-mix(in srgb, var(--violet) 18%, var(--surface)))" }}>
                  <div className="absolute inset-0 opacity-40"
                    style={{ background: "radial-gradient(60% 50% at 20% 15%, color-mix(in srgb, var(--amber) 45%, transparent), transparent), radial-gradient(50% 40% at 85% 80%, color-mix(in srgb, var(--laut) 45%, transparent), transparent)" }} />
                </div>
                {hero.map((p, i) => {
                  const pos = [
                    { left: "6%", top: "10%", width: "56%", rot: -6, z: 3 },
                    { right: "5%", top: "26%", width: "48%", rot: 5, z: 2 },
                    { left: "16%", bottom: "6%", width: "52%", rot: 3, z: 4 },
                  ][i];
                  return (
                    <button key={p.id} onClick={() => setDetail(p)}
                      className="absolute card overflow-hidden text-left transition-transform duration-500 hover:scale-[1.04] hover:-translate-y-1"
                      style={{ left: pos.left, right: pos.right, top: pos.top, bottom: pos.bottom, width: pos.width, zIndex: pos.z, transform: `rotate(${pos.rot}deg)`, boxShadow: "0 30px 60px -30px rgba(0,0,0,.7)" }}>
                      <div className="relative" style={{ aspectRatio: "4 / 3" }}>
                        <ProductThumb name={p.name} photo={p.photo} category={p.category} fill rounded={0} />
                        {todayPromo(p) && (
                          <span className="absolute top-2 right-2"><Badge color="var(--amber)"><IPercent size={10} /> {discountLabel(todayPromo(p)!)}</Badge></span>
                        )}
                      </div>
                      <div className="p-3">
                        <p className="text-xs font-bold line-clamp-1">{p.name}</p>
                        <p className="font-display font-bold text-accent text-sm mt-0.5">{rupiah(effectivePrice(p))}</p>
                      </div>
                    </button>
                  );
                })}
                <div className="absolute left-1/2 -translate-x-1/2 -bottom-4 z-10 card px-4 py-2.5 flex items-center gap-2.5" style={{ boxShadow: "var(--shadow-pop)" }}>
                  <IClock size={16} style={{ color: isOpen ? "var(--pandan)" : "var(--amber)" }} />
                  <span className="text-[11px] font-bold">{isOpen ? "Dapur sedang melayani" : "Dapur tutup · buka lagi 07.00"}</span>
                  {now && <span className="text-[10px] text-faint font-mono">{new Date(now).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</span>}
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* TEKS BERJALAN — 1 BARIS SAJA */}
        <section className="relative border-y border-line bg-surface/60 py-3">
          <div className="mx-auto max-w-[1280px] px-4 md:px-6 flex items-center gap-3 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-faint inline-flex items-center gap-1.5">
              <ISparkle size={12} className="text-accent" /> Produk tersedia & promo hari ini
            </span>
            <div className="ml-auto flex items-center gap-1.5">
              <IconBtn label={mqPaused ? "Jalankan teks" : "Jeda teks"} active={!mqPaused} onClick={() => setMqPaused((v) => !v)}>
                {mqPaused ? <IPlay size={14} /> : <IPause size={14} />}
              </IconBtn>
              <button onClick={() => setMqSpeed((v) => (v === 1 ? 2 : v === 2 ? 0.5 : 1))} className="chip !py-1 !px-2.5 !text-[10px]" title="Ubah kecepatan">
                <IRefresh size={11} /> {mqSpeed === 1 ? "1×" : mqSpeed === 2 ? "2×" : "0,5×"}
              </button>
              <button onClick={() => setMqFlip((v) => !v)} className="chip !py-1 !px-2.5 !text-[10px]" title="Balik arah">
                <IArrowRight size={11} style={{ transform: mqFlip ? "rotate(180deg)" : "none" }} /> arah
              </button>
            </div>
          </div>

          <Marquee speed={46 * mqSpeed} direction={mqFlip ? "right" : "left"} paused={mqPaused} gap={34}
            ariaLabel="Produk tersedia dan promo hari ini" className="py-1.5">
            {ticker.length === 0 ? (
              <span className="inline-flex items-center gap-2 text-[12.5px] font-bold whitespace-nowrap text-mute">
                <ISparkle size={13} className="text-accent" /> Belum ada produk tersedia atau promo hari ini.
              </span>
            ) : (
              ticker.map(({ p, kind }) => (
                <span key={`${kind}-${p.id}`} className="inline-flex items-center gap-2 text-[12.5px] font-bold whitespace-nowrap">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: CATEGORY_COLORS[p.category] }} />
                  <span
                    className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                      kind === "promo" ? "bg-amber text-amber-ink" : "bg-accent-soft text-accent"
                    }`}
                  >
                    {kind === "promo" ? "PROMO" : "TODAY"}
                  </span>
                  {p.name}
                  <span className="font-mono text-accent">{rupiah(effectivePrice(p))}</span>
                  {kind === "promo" && p.price > effectivePrice(p) && (
                    <span className="text-[10px] font-bold text-pandan">hemat {rupiah(p.price - effectivePrice(p))}</span>
                  )}
                  <span className="text-faint">·</span>
                </span>
              ))
            )}
          </Marquee>

          <p className="mx-auto max-w-[1280px] px-4 md:px-6 text-[10px] text-faint mt-2">
            Arahkan kursor untuk menjeda · geser dengan jari untuk menelusuri.
          </p>
        </section>

        {/* JANJI */}
        <section className="px-4 md:px-6 py-14">
          <div className="mx-auto max-w-[1280px] grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {DEMO_LANDING.promises.map((p, i) => (
              <Reveal key={p.title} delay={i * 70}>
                <div className="card p-5 h-full">
                  <span className="w-10 h-10 rounded-xl grid place-items-center" style={{ color: "var(--accent)", background: "var(--accent-soft)" }}>
                    {p.icon === "clock" ? <IClock size={18} /> : p.icon === "tag" ? <IPercent size={18} /> : p.icon === "heart" ? <IHeart size={18} /> : <ISparkle size={18} />}
                  </span>
                  <p className="font-display font-bold text-base mt-3">{p.title}</p>
                  <p className="text-xs text-mute mt-1.5 leading-relaxed">{p.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* PROMO */}
        <section id="promo" style={{ scrollMarginTop: 80 }} className="px-4 md:px-6 py-14">
          <div className="mx-auto max-w-[1280px]">
            <Reveal>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <Badge color="var(--amber)"><IPercent size={11} /> Promo {DAY_FULL[promoDay]}{promoDay !== today && " (pratinjau)"}</Badge>
                  <h2 className="font-display font-bold text-3xl md:text-4xl mt-3">Harga spesial, ganti tiap hari</h2>
                  <p className="text-sm text-mute mt-2 max-w-2xl">Promo dijadwalkan langsung oleh admin kedai dan otomatis aktif pada harinya.</p>
                </div>
                <div className="text-right">
                  <p className="font-display font-bold text-4xl text-amber">{promoList.length}</p>
                  <p className="text-[11px] text-faint">promo pada {DAY_FULL[promoDay]}</p>
                </div>
              </div>
            </Reveal>

            <Reveal delay={70}>
              <div className="card p-3.5 mt-5 space-y-3">
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {weekPromos.map((w) => {
                    const on = promoDay === w.day;
                    return (
                      <button key={w.day} onClick={() => setPromoDayOverride(w.day === today ? null : w.day)}
                        className={`shrink-0 rounded-2xl border px-3 py-2 text-left transition-all active:scale-95 ${on ? "border-transparent" : "border-line bg-surface hover:border-line2"}`}
                        style={on ? { background: "linear-gradient(135deg, var(--amber), color-mix(in srgb, var(--amber) 65%, #000))", color: "var(--amber-ink)" } : undefined}>
                        <span className="block text-[11px] font-bold">{DAY_FULL[w.day]}{w.day === today && " · hari ini"}</span>
                        <span className={`block text-[10px] mt-0.5 ${on ? "opacity-80" : "text-faint"}`}>
                          {w.count} promo{w.best > 0 && ` · hemat s.d. ${rupiah(w.best)}`}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-line">
                  <Segmented value={promoSource} onChange={(v) => setPromoSource(v as typeof promoSource)}
                    options={[{ v: "semua", l: "Semua promo" }, { v: "terjadwal", l: "Terjadwal" }, { v: "dasar", l: "Diskon dasar" }]} />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-faint ml-1">Ukuran kartu</span>
                  <Segmented value={promoSize} onChange={(v) => setPromoSize(v as typeof promoSize)}
                    options={[{ v: "s", l: "Rapat" }, { v: "m", l: "Sedang" }, { v: "l", l: "Besar" }]} />
                  {promoDayOverride !== null && (
                    <Button variant="ghost" size="sm" onClick={() => setPromoDayOverride(null)}><IRefresh size={13} /> Kembali ke hari ini</Button>
                  )}
                  <span className="ml-auto text-[11px] text-faint">{promoList.length} produk tampil</span>
                </div>
              </div>
            </Reveal>

            {promoList.length === 0 ? (
              <Reveal><div className="card p-8 text-center mt-4 text-sm text-mute">Belum ada promo untuk {DAY_FULL[promoDay]} dengan filter ini.</div></Reveal>
            ) : (
              <div className={`grid gap-3 mt-4 ${PROMO_GRID[promoSize]}`}>{promoList.map((p, i) => promoCard(p, i))}</div>
            )}
          </div>
        </section>

        {/* MENU */}
        <section id="menu" style={{ scrollMarginTop: 80 }} className="px-4 md:px-6 py-14">
          <div className="mx-auto max-w-[1280px]">
            <Reveal>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="font-display font-bold text-3xl md:text-4xl">Menu lengkap</h2>
                  <p className="text-sm text-mute mt-2 max-w-2xl">Sama persis dengan yang dilihat kasir: produk aktif, jadwal hari, stok, dan harga promo hari ini.</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge color="var(--accent)">{live.length} produk aktif</Badge>
                  <Badge color="var(--pandan)">{todayMenu.length} tersedia hari ini</Badge>
                  <Badge color="var(--chili)">{outToday} habis</Badge>
                  <Badge color="var(--violet)">{bundles.length} paket</Badge>
                </div>
              </div>
            </Reveal>

            <Reveal delay={80}>
              <div className="card p-4 mt-6 space-y-3">
                <SearchField value={q} onChange={setQ} size="lg" count={menu.length} countLabel="menu"
                  placeholder="Cari kopi, makanan, cemilan, atau SKU…" ariaLabel="Cari menu" onEscape={() => setQ("")} />
                <div className="flex gap-2 overflow-x-auto pb-1">
                  <Chip active={cat === "Semua"} onClick={() => setCat("Semua")}>Semua <span className="opacity-60">{live.length}</span></Chip>
                  {CATEGORIES.map((c) => (
                    <Chip key={c} active={cat === c} onClick={() => setCat(c)}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: CATEGORY_COLORS[c] }} /> {c}
                      <span className="opacity-60">{live.filter((p) => p.category === c).length}</span>
                    </Chip>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-line">
                  <Chip active={onlyToday} onClick={() => setOnlyToday(!onlyToday)}><ICalendar size={12} /> Tersedia hari ini</Chip>
                  <Chip active={hideOut} onClick={() => setHideOut(!hideOut)}><IBox size={12} /> Sembunyikan yang habis</Chip>
                  <Chip active={onlyFav} onClick={() => setOnlyFav(!onlyFav)}><IHeart size={12} /> Favorit ({fav.ids.length})</Chip>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-faint ml-1">Ukuran</span>
                  <Segmented value={menuSize} onChange={(v) => setMenuSize(v as typeof menuSize)}
                    options={[{ v: "s", l: "Rapat" }, { v: "m", l: "Sedang" }]} />
                  {(q || cat !== "Semua" || onlyFav || hideOut || !onlyToday) && (
                    <Button variant="ghost" size="sm" onClick={() => { setQ(""); setCat("Semua"); setOnlyToday(true); setHideOut(false); setOnlyFav(false); }}>
                      <IRefresh size={13} /> Reset
                    </Button>
                  )}
                </div>
              </div>
            </Reveal>

            {menu.length === 0 ? (
              <div className="card p-10 text-center mt-4">
                <p className="text-3xl mb-2">🍽️</p>
                <p className="font-bold">Belum ada menu yang cocok</p>
                <Button variant="ghost" size="sm" className="mt-4" onClick={() => { setQ(""); setCat("Semua"); setOnlyToday(false); setHideOut(false); setOnlyFav(false); }}>Reset filter</Button>
              </div>
            ) : (
              <div className={`grid gap-3 mt-4 ${MENU_GRID[menuSize]}`}>
                {menu.map((p, i) => {
                  const eff = effectivePrice(p);
                  const avail = isAvailableToday(p);
                  const st = stockOf(p, state.products);
                  const isFav = fav.ids.includes(p.id);
                  const compact = menuSize === "s";
                  return (
                    <Reveal key={p.id} delay={Math.min(i, 16) * 26}>
                      <div className="card overflow-hidden h-full flex flex-col group">
                        <div className="relative" style={{ aspectRatio: compact ? "1 / 1" : "4 / 3" }}>
                          <button onClick={() => setDetail(p)} className="block w-full h-full" aria-label={`Lihat ${p.name}`}>
                            <ProductThumb name={p.name} photo={p.photo} category={p.category} fill rounded={0}
                              className="transition-transform duration-500 group-hover:scale-105" />
                          </button>
                          <span className="absolute top-1.5 right-1.5 flex flex-col items-end gap-1 pointer-events-none">
                            {todayPromo(p) && <Badge color="var(--amber)">{discountLabel(todayPromo(p)!)}</Badge>}
                            {!todayPromo(p) && hasDiscount(p) && <Badge color="var(--amber)">{discountLabel(p.discount)}</Badge>}
                            {isLimited(p) && <Badge color="var(--magenta)">Limited</Badge>}
                            {p.kind === "bundle" && <Badge color="var(--violet)">Paket</Badge>}
                          </span>
                          <button onClick={() => fav.toggle(p.id)} aria-label="Favorit"
                            className="absolute top-1.5 left-1.5 w-7 h-7 rounded-full grid place-items-center border border-line2 backdrop-blur-sm transition-all active:scale-90"
                            style={{ background: isFav ? "var(--chili)" : "color-mix(in srgb, var(--bg) 60%, transparent)", color: isFav ? "#fff" : "var(--muted)" }}>
                            <IHeart size={13} />
                          </button>
                          {(!avail || st <= 0) && (
                            <span className="absolute inset-0 grid place-items-center px-1.5 pointer-events-none" style={{ background: "color-mix(in srgb, var(--bg) 66%, transparent)" }}>
                              <span className="text-[9.5px] font-bold px-2 py-1 rounded-full bg-overlay border border-line2 text-center leading-snug">
                                {!avail ? `Tersedia ${DAY_FULL[nextAvailableDay(p) ?? 0]}` : "Habis hari ini"}
                              </span>
                            </span>
                          )}
                        </div>
                        <div className={compact ? "p-2 flex-1 flex flex-col" : "p-3.5 flex-1 flex flex-col"}>
                          <p className={`font-bold leading-tight line-clamp-2 ${compact ? "text-[11px]" : "text-[13px]"}`}>{p.name}</p>
                          {!compact && <p className="text-[10px] text-faint mt-1 line-clamp-2 leading-snug flex-1">{p.desc}</p>}
                          <div className="flex items-baseline gap-1 mt-1.5 flex-wrap">
                            <span className={`font-display font-bold text-accent tabular-nums ${compact ? "text-[12.5px]" : "text-base"}`}>{rupiah(eff)}</span>
                            {hasDiscount(p) && <span className="text-[9px] text-faint line-through">{rupiah(p.price)}</span>}
                          </div>
                          <div className={`flex items-center justify-between gap-1 mt-1.5 pt-1.5 border-t border-line ${compact ? "" : "mt-2.5 pt-2"}`}>
                            <span className="text-[9.5px] font-bold" style={{ color: st <= 0 ? "var(--chili)" : !avail ? "var(--amber)" : "var(--muted)" }}>
                              {st <= 0 ? "Habis" : !avail ? "Belum tersedia" : p.kind === "bundle" ? `${num(st)} porsi` : `Stok ${num(st)}`}
                            </span>
                            <button onClick={() => setDetail(p)} className="text-[9.5px] font-bold text-accent inline-flex items-center gap-0.5">Detail <IArrowRight size={10} /></button>
                          </div>
                        </div>
                      </div>
                    </Reveal>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* PAKET */}
        <section id="paket" style={{ scrollMarginTop: 80 }} className="px-4 md:px-6 py-14">
          <div className="mx-auto max-w-[1280px]">
            <Reveal>
              <Badge color="var(--violet)"><ITag size={11} /> Hemat bareng</Badge>
              <h2 className="font-display font-bold text-3xl md:text-4xl mt-3">Paket bundling</h2>
            </Reveal>
            {bundles.length === 0 ? (
              <div className="card p-8 text-center mt-6 text-sm text-mute">Belum ada paket bundling aktif.</div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mt-6">
                {bundles.map((p, i) => {
                  const comps = bundleComponents(p, state.products);
                  const base = bundleBaseTotal(p, state.products);
                  const eff = effectivePrice(p);
                  const st = stockOf(p, state.products);
                  const avail = isAvailableToday(p);
                  return (
                    <Reveal key={p.id} delay={i * 60}>
                      <div className="card p-4 h-full flex flex-col" style={{ borderColor: "color-mix(in srgb, var(--violet) 30%, transparent)" }}>
                        <div className="flex items-start gap-2.5">
                          <ProductThumb name={p.name} photo={p.photo} category={p.category} size={44} rounded={13} />
                          <div className="min-w-0">
                            <p className="font-display font-bold text-sm leading-tight line-clamp-2">{p.name}</p>
                            <p className="text-[10px] text-faint mt-1">{isLimited(p) ? `Hanya ${DAY_ORDER.filter((d) => p.availableDays.includes(d)).map((d) => DAY_SHORT[d]).join(", ")}` : "Setiap hari"}</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {todayPromo(p) && <Badge color="var(--amber)"><IPercent size={10} /> {discountLabel(todayPromo(p)!)}</Badge>}
                          <Badge color={st <= 0 ? "var(--chili)" : avail ? "var(--pandan)" : "var(--amber)"}>
                            {st <= 0 ? "Habis" : avail ? `${num(st)} porsi siap` : `Kembali ${DAY_SHORT[nextAvailableDay(p) ?? 0]}`}
                          </Badge>
                        </div>
                        <ul className="mt-2.5 space-y-1.5 flex-1">
                          {comps.map(({ comp, product }) => (
                            <li key={product.id} className="flex items-center gap-1.5 text-[10.5px]">
                              <ICheck size={11} className="text-pandan shrink-0" />
                              <span className="font-bold">{comp.qty}×</span>
                              <span className="truncate flex-1">{product.name}</span>
                              <span className="font-mono text-faint">{rupiah(effectivePrice(product) * comp.qty)}</span>
                            </li>
                          ))}
                        </ul>
                        <div className="mt-3 pt-2.5 border-t border-line flex items-end justify-between gap-2">
                          <div>
                            <p className="text-[10px] text-faint line-through">{rupiah(base)}</p>
                            <p className="font-display font-bold text-xl text-accent">{rupiah(eff)}</p>
                          </div>
                          <Badge color="var(--pandan)">hemat {rupiah(Math.max(0, base - eff))}</Badge>
                        </div>
                        <Button variant="soft" size="sm" className="mt-2.5" onClick={() => setDetail(p)}>Lihat detail paket</Button>
                      </div>
                    </Reveal>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* MEMBER */}
        <section id="member" style={{ scrollMarginTop: 80 }} className="px-4 md:px-6 py-14">
          <div className="mx-auto max-w-[1280px]">
            <Reveal>
              <div className="card p-6 md:p-8 relative overflow-hidden"
                style={{ borderColor: "color-mix(in srgb, var(--violet) 34%, transparent)", background: "linear-gradient(150deg, color-mix(in srgb, var(--violet) 12%, var(--surface)), var(--surface) 55%, color-mix(in srgb, var(--accent) 10%, var(--surface)))" }}>
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div className="max-w-2xl">
                    <Badge color="var(--violet)"><IHeart size={11} /> Kartu member digital</Badge>
                    <h2 className="font-display font-bold text-3xl md:text-4xl mt-3 leading-tight">
                      Jadi member, <span className="text-grad">belanja makin murah</span> dan dapat hadiah.
                    </h2>
                    <p className="text-sm md:text-base text-mute mt-3 leading-relaxed">
                      Daftar gratis di kasir, dapatkan username & PIN untuk masuk portal member. Tier naik otomatis dari total belanjamu,
                      dan setiap belanja mengumpulkan poin yang bisa ditukar hadiah.
                    </p>
                    <div className="flex flex-wrap gap-2.5 mt-5">
                      <Link href="/login" className="btn btn-primary"><IRegister size={16} /> Sudah member? Masuk</Link>
                      <a href="#kunjungi" className="btn btn-ghost"><IUserPlus size={16} /> Daftar di kasir</a>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 shrink-0">
                    <div className="rounded-2xl border border-line bg-surface p-4 text-center">
                      <p className="font-display font-bold text-3xl" style={{ color: "var(--violet)" }}>{memberCount}</p>
                      <p className="text-[10.5px] text-faint mt-1">member terdaftar</p>
                    </div>
                    <div className="rounded-2xl border border-line bg-surface p-4 text-center">
                      <p className="font-display font-bold text-3xl text-pandan">{s.memberDiscountPct}%</p>
                      <p className="text-[10.5px] text-faint mt-1">potongan langsung</p>
                    </div>
                    <div className="rounded-2xl border border-line bg-surface p-4 text-center">
                      <p className="font-display font-bold text-3xl text-amber">+{num(s.memberWelcomePoints)}</p>
                      <p className="text-[10.5px] text-faint mt-1">poin sambutan</p>
                    </div>
                    <div className="rounded-2xl border border-line bg-surface p-4 text-center">
                      <p className="font-display font-bold text-3xl text-magenta">+{s.memberBirthdayPct}%</p>
                      <p className="text-[10.5px] text-faint mt-1">bonus ultah</p>
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>

            <Reveal delay={80}>
              <div className="mt-6"><MemberBenefitsPanel settings={s} /></div>
            </Reveal>
          </div>
        </section>

        {/* LIMITED */}
        {limited.length > 0 && (
          <section className="px-4 md:px-6 py-14">
            <div className="mx-auto max-w-[1280px] card p-6 md:p-8"
              style={{ borderColor: "color-mix(in srgb, var(--magenta) 32%, transparent)", background: "linear-gradient(150deg, color-mix(in srgb, var(--magenta) 10%, var(--surface)), var(--surface))" }}>
              <Reveal>
                <Badge color="var(--magenta)"><ISparkle size={11} /> Limited edition</Badge>
                <h2 className="font-display font-bold text-2xl md:text-3xl mt-3">Dimasak di hari tertentu saja</h2>
              </Reveal>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mt-6">
                {limited.map((p, i) => (
                  <Reveal key={p.id} delay={i * 50}>
                    <button onClick={() => setDetail(p)} className="w-full text-left rounded-2xl border border-line bg-surface p-3 flex items-center gap-2.5 hover:border-line2 transition-colors">
                      <ProductThumb name={p.name} photo={p.photo} category={p.category} size={42} rounded={12} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-bold truncate">{p.name}</span>
                        <span className="block text-[10px] text-magenta font-bold mt-0.5">{DAY_ORDER.filter((d) => p.availableDays.includes(d)).map((d) => DAY_SHORT[d]).join(" · ")}</span>
                        <span className="block text-[10px] text-faint mt-0.5">{isAvailableToday(p) ? "Ada hari ini ✓" : `Kembali ${DAY_FULL[nextAvailableDay(p) ?? 0]}`}</span>
                      </span>
                      <span className="font-display font-bold text-accent text-sm shrink-0">{rupiah(effectivePrice(p))}</span>
                    </button>
                  </Reveal>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* CERITA */}
        <section id="cerita" style={{ scrollMarginTop: 80 }} className="px-4 md:px-6 py-14">
          <div className="mx-auto max-w-[1280px] grid lg:grid-cols-2 gap-10 items-start">
            <Reveal>
              <Badge color="var(--accent)"><IStore size={11} /> Cerita kami</Badge>
              <h2 className="font-display font-bold text-3xl md:text-4xl mt-3 leading-tight">Dari gerobak gang<br />ke dapur Nusantara.</h2>
              <p className="text-sm md:text-base text-mute mt-5 leading-relaxed">{DEMO_LANDING.story}</p>
              <div className="grid grid-cols-3 gap-3 mt-7">
                {[{ k: "2019", v: "mulai dari gerobak" }, { k: "3", v: "asal biji kopi" }, { k: "14 hari", v: "maks umur sangrai" }].map((x) => (
                  <div key={x.v} className="rounded-2xl border border-line bg-surface p-3.5">
                    <p className="font-display font-bold text-xl text-accent">{x.k}</p>
                    <p className="text-[10px] text-faint mt-1 leading-snug">{x.v}</p>
                  </div>
                ))}
              </div>
            </Reveal>
            <div className="space-y-3">
              {DEMO_LANDING.testimonials.map((t, i) => (
                <Reveal key={t.name} delay={i * 70}>
                  <div className="card p-5">
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }).map((_, k) => (
                        <IStar key={k} size={13} style={{ color: k < t.rating ? "var(--amber)" : "var(--surface2)" }} />
                      ))}
                      <span className="ml-auto text-[10px] text-faint">{t.role}</span>
                    </div>
                    <p className="text-sm mt-3 leading-relaxed">“{t.quote}”</p>
                    <p className="text-xs font-bold mt-3 text-accent">{t.name}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* KUNJUNGI */}
        <section id="kunjungi" style={{ scrollMarginTop: 80 }} className="px-4 md:px-6 py-14">
          <div className="mx-auto max-w-[1280px] grid lg:grid-cols-[1.1fr_.9fr] gap-6">
            <Reveal>
              <div className="card p-6 h-full">
                <Badge color="var(--chili)"><IMapPin size={11} /> Kunjungi kedai</Badge>
                <h2 className="font-display font-bold text-2xl md:text-3xl mt-3">{s.storeName}</h2>
                <p className="text-sm text-mute mt-2">{s.address}</p>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {[parsed.area, parsed.city, parsed.province, parsed.postcode].filter(Boolean).map((c) => (
                    <span key={c} className="rounded-full border border-line bg-surface px-2.5 py-1 text-[10px] font-bold text-mute">{c}</span>
                  ))}
                </div>
                <div className="mt-5"><StoreMap address={s.address} storeName={s.storeName} /></div>
                <div className="flex flex-wrap gap-2 mt-4">
                  <a className="btn btn-primary btn-sm" href={`https://wa.me/${waNumber}`} target="_blank" rel="noreferrer"><IPhone size={14} /> WhatsApp kami</a>
                  <a className="btn btn-ghost btn-sm" href={`tel:${s.phone.replace(/[^0-9+]/g, "")}`}><IPhone size={14} /> {s.phone}</a>
                </div>
              </div>
            </Reveal>

            <Reveal delay={90}>
              <div className="card p-6 h-full">
                <Badge color="var(--pandan)"><IClock size={11} /> Jam buka</Badge>
                <h3 className="font-display font-bold text-xl mt-3">Setiap hari, {STORE_OPEN}–{STORE_CLOSE}</h3>
                <ul className="mt-4 space-y-1.5">
                  {DAY_ORDER.map((d) => {
                    const specials = live.filter((p) => isAvailableOn(p, d) && (isLimited(p) || promoDays(p).includes(d)));
                    const isToday = d === today;
                    return (
                      <li key={d} className="rounded-xl border px-3 py-2.5 flex items-center gap-3"
                        style={{ borderColor: isToday ? "var(--accent)" : "var(--line)", background: isToday ? "var(--accent-soft)" : "var(--surface)" }}>
                        <span className="text-xs font-bold w-16 shrink-0" style={{ color: isToday ? "var(--accent)" : "var(--text)" }}>{DAY_FULL[d]}</span>
                        <span className="text-[11px] text-mute flex-1 truncate">
                          {specials.length ? `${specials.length} menu spesial · ${specials.slice(0, 2).map((p) => p.name).join(", ")}${specials.length > 2 ? "…" : ""}` : "Menu reguler lengkap"}
                        </span>
                        {isToday && <Badge color="var(--accent)">hari ini</Badge>}
                      </li>
                    );
                  })}
                </ul>
                <div className="mt-5 pt-4 border-t border-line">
                  <p className="text-xs font-bold mb-2">Pertanyaan yang sering masuk</p>
                  {DEMO_LANDING.faq.map((f, i) => (
                    <div key={f.q} className="border-b border-line last:border-0">
                      <button onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                        className="w-full flex items-center gap-2 py-2.5 text-left text-[12px] font-bold">
                        <span className="flex-1">{f.q}</span>
                        <IChevronDown size={14} className="text-faint transition-transform" style={{ transform: faqOpen === i ? "rotate(180deg)" : "none" }} />
                      </button>
                      <div style={{ maxHeight: faqOpen === i ? 200 : 0, opacity: faqOpen === i ? 1 : 0, overflow: "hidden", transition: "max-height .35s ease, opacity .25s ease" }}>
                        <p className="text-[11px] text-mute pb-3 leading-relaxed">{f.a}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* CTA */}
        <section className="px-4 md:px-6 pb-16">
          <Reveal>
            <div className="mx-auto max-w-[1280px] card p-8 md:p-12 text-center relative overflow-hidden"
              style={{ background: "linear-gradient(140deg, color-mix(in srgb, var(--accent) 20%, var(--surface)), var(--surface) 50%, color-mix(in srgb, var(--violet) 16%, var(--surface)))" }}>
              <h2 className="font-display font-bold text-3xl md:text-4xl">Sudah siap mampir?</h2>
              <p className="text-sm text-mute mt-3 max-w-xl mx-auto">
                Daftar member gratis di kasir, simpan menu favoritmu, lalu datang pada hari promo yang paling kamu suka.
              </p>
              <div className="flex flex-wrap gap-2.5 justify-center mt-6">
                <a href="#menu" className="btn btn-primary"><IStore size={16} /> Pilih menu sekarang</a>
                <Link href="/login" className="btn btn-ghost"><IRegister size={16} /> Masuk staf / member</Link>
              </div>
              {now && <p className="text-[11px] text-faint mt-5">{dateFull(now)}</p>}
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="relative z-10 border-t border-line bg-bg2/70">
        <div className="mx-auto max-w-[1280px] px-4 md:px-6 py-8 grid sm:grid-cols-3 gap-6">
          <div>
            <BrandLockup settings={s} size={30} />
            <p className="text-[11px] text-mute mt-3 leading-relaxed max-w-xs">{s.tagline}. {s.address}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-faint">Jelajahi</p>
            <div className="grid gap-1.5 mt-2.5">
              {SECTIONS.map((x) => <a key={x.id} href={`#${x.id}`} className="text-xs font-bold text-mute hover:text-accent">{x.label}</a>)}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-faint">Kontak & akun</p>
            <div className="grid gap-1.5 mt-2.5">
              <a href={`tel:${s.phone.replace(/[^0-9+]/g, "")}`} className="text-xs font-bold text-mute hover:text-accent">{s.phone}</a>
              <a href={`https://wa.me/${waNumber}`} target="_blank" rel="noreferrer" className="text-xs font-bold text-mute hover:text-accent">WhatsApp</a>
              <Link href="/login" className="text-xs font-bold text-accent inline-flex items-center gap-1"><IRegister size={12} /> Masuk staf / member</Link>
              <Link href="/memberku" className="text-xs font-bold text-violet inline-flex items-center gap-1"><IHeart size={12} /> Portal member</Link>
            </div>
          </div>
        </div>
        <div className="border-t border-line px-4 md:px-6 py-4 text-[10px] text-faint flex flex-wrap gap-2 justify-between max-w-[1280px] mx-auto">
          <span>© {new Date().getFullYear()} {s.storeName}. Semua harga dalam Rupiah.</span>
          <span>Menu, promo & member tersinkron dengan kasir · peta © Google</span>
        </div>
      </footer>

      {/* DETAIL */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.name ?? "Menu"} wide
        footer={detail && (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant={fav.ids.includes(detail.id) ? "soft" : "ghost"} onClick={() => fav.toggle(detail.id)}>
              <IHeart size={15} /> {fav.ids.includes(detail.id) ? "Tersimpan di favorit" : "Simpan ke favorit"}
            </Button>
            <span className="text-[11px] text-faint flex items-center gap-1.5 ml-auto"><IInfo size={12} /> Pemesanan langsung di kasir kedai</span>
          </div>
        )}>
        {detail && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-line overflow-hidden" style={{ aspectRatio: "16 / 9" }}>
              <ProductThumb name={detail.name} photo={detail.photo} category={detail.category} fill rounded={0} fit="contain" />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge color={CATEGORY_COLORS[detail.category]}>{detail.category}</Badge>
              {detail.kind === "bundle" && <Badge color="var(--violet)">Paket bundling</Badge>}
              {isLimited(detail) && <Badge color="var(--magenta)">Limited edition</Badge>}
              {isAvailableToday(detail) ? <Badge color="var(--pandan)">Tersedia hari ini</Badge> : <Badge color="var(--amber)">Kembali {DAY_FULL[nextAvailableDay(detail) ?? 0]}</Badge>}
              <span className="text-[11px] text-faint font-mono">{detail.sku}</span>
            </div>
            <p className="text-sm text-mute leading-relaxed">{detail.desc}</p>

            <div className="rounded-2xl border p-4" style={{ borderColor: "color-mix(in srgb, var(--accent) 30%, transparent)", background: "var(--accent-soft)" }}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-faint">Harga hari ini · {DAY_FULL[today]}</p>
              <div className="flex items-end gap-2.5 mt-1 flex-wrap">
                <span className="font-display font-bold text-3xl text-accent">{rupiah(effectivePrice(detail))}</span>
                {hasDiscount(detail) && <span className="text-sm text-faint line-through">{rupiah(detail.price)}</span>}
                {hasDiscount(detail) && <Badge color="var(--amber)">hemat {rupiah(detail.price - effectivePrice(detail))}</Badge>}
              </div>
              <p className="text-[11px] text-mute mt-2">Member dapat tambahan potongan {s.memberDiscountPct}% + bonus tier. PPN {s.taxPct}% dihitung saat bayar.</p>
            </div>

            <div className="rounded-2xl border p-4" style={{ borderColor: "color-mix(in srgb, var(--violet) 30%, transparent)", background: "color-mix(in srgb, var(--violet) 7%, transparent)" }}>
              <p className="text-xs font-bold mb-2 flex items-center gap-1.5"><IHeart size={13} style={{ color: "var(--violet)" }} /> Kalau kamu member</p>
              <TierLadder settings={s} dense />
              <p className="text-[11px] text-mute mt-2.5">Daftar gratis di kasir dan langsung dapat {num(s.memberWelcomePoints)} poin sambutan.</p>
            </div>

            {detail.kind === "bundle" && (
              <div className="rounded-2xl border border-line bg-surface p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold">Isi paket</p>
                  <span className="text-[11px] text-faint">Normal {rupiah(bundleBaseTotal(detail, state.products))}</span>
                </div>
                <ul className="space-y-2">
                  {bundleComponents(detail, state.products).map(({ comp, product }) => (
                    <li key={product.id} className="flex items-center gap-2.5">
                      <ProductThumb name={product.name} photo={product.photo} category={product.category} size={32} rounded={9} />
                      <span className="text-xs font-bold flex-1 truncate">{comp.qty}× {product.name}</span>
                      <span className="text-[11px] font-mono text-faint">{rupiah(effectivePrice(product) * comp.qty)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="rounded-2xl border border-line bg-surface p-4">
              <p className="text-xs font-bold mb-2.5">Jadwal & promo per hari</p>
              <div className="grid grid-cols-7 gap-1.5">
                {DAY_ORDER.map((d) => {
                  const on = isAvailableOn(detail, d);
                  const promo = promoDays(detail).includes(d);
                  return (
                    <div key={d} className="rounded-lg border py-2 text-center"
                      style={{ borderColor: on ? "transparent" : "var(--line)", background: on ? (promo ? "var(--amber)" : "var(--accent-soft)") : "var(--bg2)", color: on ? (promo ? "var(--amber-ink)" : "var(--accent)") : "var(--faint)" }}>
                      <span className="block text-[10px] font-bold">{DAY_SHORT[d]}</span>
                      <span className="block text-[9px] mt-0.5">{on ? (promo ? "%" : "✓") : "–"}</span>
                    </div>
                  );
                })}
              </div>
              <p className="text-[11px] text-mute mt-2.5">Stok tercatat di kasir: {num(stockOf(detail, state.products))} {detail.kind === "bundle" ? "porsi" : "unit"}</p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}