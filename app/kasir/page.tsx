"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth, useStore } from "@/lib/store";
import { useToast } from "@/components/Toasts";
import { sfx } from "@/lib/sound";
import { getCatalog } from "@/app/actions/catalog";
import { recordSale } from "@/app/actions/sale";
import type {
  Customer, DiningTable, Discount, HeldOrder, OrderType,
  PayMethod, Product, Settings, Transaction, TxItem,
} from "@/lib/types";
import { CATEGORIES, CATEGORY_COLORS } from "@/lib/types";
import { WALK_IN_CUSTOMER } from "@/lib/demo-data";
import { calcTotals, nextTxId, num, relTime, rupiah, uid } from "@/lib/format";
import {
  DAY_FULL, DAY_SHORT, cartSavings, discountLabel, effectivePrice,
  hasDiscount, isAvailableToday, isLimited, itemSavings, nextAvailableDay,
  nextPromoDay, promoLabel, stockOf, toTxItem, todayPromo,
} from "@/lib/pricing";
import {
  TIER_COLOR, initials, isBirthday, memberDiscountPct, pointsFor,
  tierOf, totalTierPct,
} from "@/lib/member";
import { openSessionOf } from "@/lib/shift";
import { shiftEligible } from "@/lib/auth";
import { ProductThumb } from "@/components/ProductThumb";
import { SearchField } from "@/components/SearchField";
import { MemberForm } from "@/components/MemberForm";
import { MemberPicker } from "@/components/MemberPicker";
import { MemberBenefitsModal } from "@/components/MemberBenefits";
import { TableGrid } from "@/components/TableGrid";
import {
  Badge, Button, Chip, Drawer, EmptyState, IconBtn, Input, Modal,
  PageSkel, Segmented,
} from "@/components/ui";
import { KasirTestBanner } from "@/components/KasirTestBanner";
import { QRISCenter } from "@/components/QRISCenter";
import {
  IBox, ICalendar, ICart, ICard, ICash, ICheckCircle, IHeart, IImage,
  IInfo, IMenu, IMinus, IPause, IPercent, IPlus, IQR, IShield, ISparkle,
  IStar, IStore, ITag, ITrash, IUser, IUserPlus, IX,
} from "@/components/icons";

type Density = "ringkas" | "standar" | "besar";
type Layout = "kartu" | "daftar";
type Fit = "cover" | "contain";

const DENSITY: Record<
  Density,
  {
    min: number;
    aspect: string;
    pad: string;
    name: string;
    lines: number;
    price: string;
  }
> = {
  ringkas: {
    min: 124,
    aspect: "1 / 1",
    pad: "p-2",
    name: "text-[11.5px]",
    lines: 1,
    price: "text-[13px]",
  },
  standar: {
    min: 164,
    aspect: "4 / 3",
    pad: "p-2.5",
    name: "text-[12.5px]",
    lines: 2,
    price: "text-[15px]",
  },
  besar: {
    min: 212,
    aspect: "4 / 3",
    pad: "p-3",
    name: "text-[13.5px]",
    lines: 2,
    price: "text-[17px]",
  },
};

const PAY_METHODS: PayMethod[] = ["Tunai", "QRIS", "Kartu"];

function usePref<T>(key: string, initial: T) {
  const [v, setV] = useState<T>(() => {
    if (typeof window === "undefined") return initial;
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(v));
    } catch {
      /* penuh */
    }
  }, [key, v]);

  return [v, setV] as const;
}

function roundUp(value: number, step: number) {
  return Math.ceil(Math.max(0, value) / step) * step;
}

export default function KasirPage() {
  return (
    <Suspense fallback={<PageSkel />}>
      <Kasir />
    </Suspense>
  );
}

function Kasir() {
  const { state, dispatch } = useStore();
  const { user, isAdmin } = useAuth();
  const { push } = useToast();
  const router = useRouter();
  const sp = useSearchParams();

  const LIVE = process.env.NEXT_PUBLIC_DATA_MODE === "live";
  /* Mode uji admin HANYA ada di demo. Di live, admin jual beneran. */
  const isTestMode = !LIVE && isAdmin;

  const [q, setQ] = useState(sp.get("q") ?? "");
  const [cat, setCat] = useState("Semua");
  const [onlyToday, setOnlyToday] = useState(true);
  const [promoOnly, setPromoOnly] = useState(false);

  const [items, setItems] = useState<TxItem[]>([]);
  const [custId, setCustId] = useState(WALK_IN_CUSTOMER.id);
  const [disc, setDisc] = useState<Discount>({ type: "pct", value: 0 });

  const [payOpen, setPayOpen] = useState(false);
  const [heldOpen, setHeldOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [memberFormOpen, setMemberFormOpen] = useState(false);
  const [benefitOpen, setBenefitOpen] = useState(false);
  const [tablesOpen, setTablesOpen] = useState(false);

  const [quick, setQuick] = useState<Product | null>(null);
  const [lastTx, setLastTx] = useState<Transaction | null>(null);
  const [localHeld, setLocalHeld] = useState<HeldOrder[]>([]);

  const [density, setDensity] = usePref<Density>("nusapos:pos-density", "standar");
  const [layout, setLayout] = usePref<Layout>("nusapos:pos-layout", "kartu");
  const [fit, setFit] = usePref<Fit>("nusapos:pos-fit", "cover");

  /* ── LIVE: state katalog dari server ── */
  const [liveProducts, setLiveProducts] = useState<Product[]>([]);
  const [liveCustomers, setLiveCustomers] = useState<Customer[]>([]);
  const [liveTables, setLiveTables] = useState<DiningTable[]>([]);
  const [liveSettings, setLiveSettings] = useState<Partial<Settings> | null>(null);
  const [liveReady, setLiveReady] = useState(false);

  useEffect(() => {
    if (!LIVE) return;
    let alive = true;
    (async () => {
      const data = await getCatalog();
      if (!alive) return;
      if ("error" in data) {
        router.replace("/login");
        return;
      }
      setLiveProducts(data.products);
      setLiveCustomers(data.customers);
      setLiveTables(data.tables);
      setLiveSettings(data.settings);
      setLiveReady(true);
    })();
    return () => { alive = false; };
  }, [LIVE, router]);

  /* ── Sumber data ter-derive: LIVE = server, DEMO = store ── */
  const products = LIVE ? liveProducts : state.products;
  const customers = LIVE ? liveCustomers : state.customers;
  const tables = LIVE ? liveTables : state.tables;
  const settings: Settings = useMemo(
  () => LIVE
    ? { ...state.settings, ...(liveSettings ?? {}) }
    : state.settings,
  [LIVE, state.settings, liveSettings],
);
  const ready = LIVE ? liveReady : state.hydrated;

  useEffect(() => { setQ(sp.get("q") ?? ""); }, [sp]);
  useEffect(() => {
    if (sp.get("held") && ready) setHeldOpen(true);
  }, [sp, ready]);

  const customer =
    customers.find((c) => c.id === custId) ??
    (LIVE ? WALK_IN_CUSTOMER : customers[0] ?? WALK_IN_CUSTOMER);
  const d = DENSITY[density] ?? DENSITY.standar;
  const myShift =
    user && shiftEligible(user)
      ? openSessionOf(state.shiftSessions, user.id)
      : null;

  const heldList = isTestMode ? localHeld : state.held;
  const mPct = memberDiscountPct(customer, settings);
  const activeTables = tables.filter((t) => t.active);
  const freeTableCount = activeTables.filter((t) => t.status === "kosong").length;

  const stockById = (id: string) => {
    const p = products.find((x) => x.id === id);
    return p ? stockOf(p, products) : 999;
  };
  const inCart = (id: string) => items.find((i) => i.productId === id)?.qty ?? 0;

  const promoTodayCount = useMemo(
    () => products.filter((p) => p.active && !!todayPromo(p) && isAvailableToday(p)).length,
    [products],
  );

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return products.filter(
      (p) =>
        p.active &&
        (cat === "Semua" ||
          (cat === "Paket" ? p.kind === "bundle" : p.category === cat)) &&
        (!onlyToday || isAvailableToday(p)) &&
        (!promoOnly || (!!todayPromo(p) && isAvailableToday(p))) &&
        (!s ||
          p.name.toLowerCase().includes(s) ||
          p.sku.toLowerCase().includes(s) ||
          p.category.toLowerCase().includes(s)),
    );
  }, [products, q, cat, onlyToday, promoOnly]);

  const totals = useMemo(
    () => calcTotals(items, disc, settings, mPct),
    [items, disc, settings, mPct],
  );
  const savings = useMemo(() => cartSavings(items), [items]);
  const itemCount = items.reduce((a, i) => a + i.qty, 0);

  const willEarn =
    customer.member && settings.memberEnabled && !isTestMode
      ? pointsFor(totals.total, settings)
      : 0;

  const add = (p: Product) => {
    if (!isAvailableToday(p)) {
      const nd = nextAvailableDay(p);
      sfx.error();
      push({
        msg: `${p.name} tidak tersedia hari ini${nd !== null ? ` — kembali hari ${DAY_FULL[nd]}` : ""}`,
        type: "err",
      });
      return;
    }
    const max = stockOf(p, products);
    if (max <= 0) {
      sfx.error();
      push({ msg: `${p.name} sudah habis`, type: "err" });
      return;
    }
    const ex = items.find((i) => i.productId === p.id);
    if (ex) {
      if (ex.qty >= max) {
        sfx.error();
        push({ msg: `Stok ${p.name} tinggal ${max}`, type: "err" });
        return;
      }
      setItems(items.map((i) => (i.productId === p.id ? { ...i, qty: i.qty + 1 } : i)));
    } else {
      setItems([...items, toTxItem(p, products, 1)]);
    }
    sfx.add();
  };

  const setQty = (id: string, delta: number) => {
    const it = items.find((i) => i.productId === id);
    if (!it) return;
    const max = stockById(id);
    const next = it.qty + delta;
    if (next <= 0) { remove(id); return; }
    if (next > max) {
      sfx.error();
      push({ msg: `Stok ${it.name} tinggal ${max}`, type: "err" });
      return;
    }
    setItems(items.map((i) => (i.productId === id ? { ...i, qty: next } : i)));
    sfx.tap();
  };

  const remove = (id: string) => {
    setItems(items.filter((i) => i.productId !== id));
    sfx.remove();
  };

  const clearCart = () => {
    if (!items.length) return;
    const prev = items;
    setItems([]);
    sfx.remove();
    push({
      msg: "Keranjang dikosongkan", type: "info",
      actionLabel: "Urungkan", onAction: () => setItems(prev),
    });
  };

  const hold = () => {
    if (!items.length) return;
    const order: HeldOrder = {
      id: uid(), ts: Date.now(),
      label: `${customer.name} • ${itemCount} item`,
      items, customerId: custId, discount: disc,
    };
    if (isTestMode) {
      setLocalHeld((prev) => [order, ...prev]);
      push({
        msg: "Order ditahan dalam mode uji — tidak disimpan ke sistem",
        type: "info", actionLabel: "Lihat", onAction: () => setHeldOpen(true),
      });
    } else {
      dispatch({ type: "HOLD", order });
      push({
        msg: "Order ditahan", type: "ok",
        actionLabel: "Lihat", onAction: () => setHeldOpen(true),
      });
    }
    setItems([]);
    setDisc({ type: "pct", value: 0 });
    setCustId(WALK_IN_CUSTOMER.id);
    sfx.hold();
  };

  const resume = (o: HeldOrder) => {
    const capped = o.items
      .map((i) => ({ ...i, qty: Math.min(i.qty, stockById(i.productId)) }))
      .filter((i) => i.qty > 0);
    setItems(capped);
    setCustId(o.customerId);
    setDisc(o.discount);
    if (isTestMode) setLocalHeld((prev) => prev.filter((x) => x.id !== o.id));
    else dispatch({ type: "REMOVE_HELD", id: o.id });
    setHeldOpen(false);
    sfx.add();
    push({ msg: "Order dilanjutkan", type: "ok" });
  };

  const removeHeld = (o: HeldOrder) => {
    if (isTestMode) {
      setLocalHeld((prev) => prev.filter((x) => x.id !== o.id));
      sfx.remove();
      push({
        msg: "Order uji dihapus", type: "info",
        actionLabel: "Urungkan", onAction: () => setLocalHeld((prev) => [o, ...prev]),
      });
    } else {
      dispatch({ type: "REMOVE_HELD", id: o.id });
      sfx.remove();
      push({
        msg: "Order ditahan dihapus", type: "info",
        actionLabel: "Urungkan", onAction: () => dispatch({ type: "HOLD", order: o }),
      });
    }
  };

  const confirmPay = async (
    method: PayMethod,
    tendered: number,
    orderType: OrderType,
    tableId: string | null,
  ) => {
    const table =
      orderType === "dinein" && tableId
        ? tables.find((t) => t.id === tableId) ?? null
        : null;

    /* ══ LIVE: jual via server — harga & total OTORITATIF di DB ══ */
    if (LIVE) {
      const res = await recordSale({
        items: items.map((i) => ({ productId: i.productId, qty: i.qty })),
        customerId: customer.member ? customer.id : null,
        method,
        tendered,
        orderType,
        tableId: orderType === "dinein" ? tableId : null,
        discount: disc,
        isTest: false,
      });

      if (!res.ok) {
        sfx.error();
        push({ msg: res.error ?? "Transaksi gagal", type: "err", dur: 5200 });
        return; /* payment sheet tetap terbuka → user bisa retry/batal */
      }

      /* refresh katalog: stok turun, meja terisi, poin member naik — dari DB */
      const cat2 = await getCatalog();
      if (!("error" in cat2)) {
        setLiveProducts(cat2.products);
        setLiveCustomers(cat2.customers);
        setLiveTables(cat2.tables);
        setLiveSettings(cat2.settings);
      }

      const tx: Transaction = {
        id: res.txNumber ?? res.id ?? `LIVE-${uid()}`,
        ts: Date.now(),
        items,
        subtotal: totals.subtotal,
        discount: totals.discount,
        memberDiscount: totals.memberDiscount,
        memberPoints: willEarn,
        memberNo: customer.member ? customer.memberNo : undefined,
        memberTier: customer.member ? tierOf(customer.spend ?? 0, settings) : undefined,
        tax: totals.tax,
        service: totals.service,
        total: totals.total,
        method,
        tendered,
        change: method === "Tunai" ? tendered - totals.total : 0,
        customerId: customer.id,
        customerName: customer.name,
        cashier: user?.name ?? settings.cashier,
        status: "Selesai",
        shiftId: myShift?.id,
        isTest: false,
        orderType,
        tableId: orderType === "dinein" ? tableId : null,
        tableLabel: table?.label ?? null,
      };

      setLastTx(tx);
      sfx.success();
      if (method === "Tunai") sfx.cash();
      if (orderType === "dinein" && table) {
        push({ msg: `${table.label} sekarang terisi atas nama ${customer.name}`, type: "ok", dur: 4200 });
      }
      if (willEarn > 0) {
        push({ msg: `${customer.name} mendapat +${willEarn} poin member`, type: "ok", dur: 4200 });
      }
      return;
    }

    /* ══ DEMO: mekanisme lama, TIDAK DIUBAH ══ */
    const tx: Transaction = {
      id: isTestMode ? `TEST-${uid()}` : nextTxId(state.transactions),
      ts: Date.now(),
      items,
      subtotal: totals.subtotal,
      discount: totals.discount,
      memberDiscount: totals.memberDiscount,
      memberPoints: willEarn,
      memberNo: customer.member ? customer.memberNo : undefined,
      memberTier: customer.member ? tierOf(customer.spend ?? 0, settings) : undefined,
      tax: totals.tax,
      service: totals.service,
      total: totals.total,
      method,
      tendered,
      change: tendered - totals.total,
      customerId: customer.id,
      customerName: customer.name,
      cashier: user?.name ?? settings.cashier,
      status: "Selesai",
      shiftId: myShift?.id,
      isTest: isTestMode,
      orderType,
      tableId: orderType === "dinein" ? tableId : null,
      tableLabel: table?.label ?? null,
    };

    if (!isTestMode) dispatch({ type: "ADD_TX", tx });

    setLastTx(tx);
    sfx.success();
    if (method === "Tunai") sfx.cash();

    if (isTestMode) {
      push({
        msg: "Transaksi uji selesai — tidak tercatat di riwayat, stok, poin, shift, atau meja.",
        type: "info", dur: 5200,
      });
    } else {
      if (orderType === "dinein" && table) {
        push({ msg: `${table.label} sekarang terisi atas nama ${customer.name}`, type: "ok", dur: 4200 });
      }
      if (willEarn > 0) {
        push({ msg: `${customer.name} mendapat +${willEarn} poin member`, type: "ok", dur: 4200 });
      }
    }
  };

  const closePay = () => {
    setPayOpen(false);
    if (lastTx) {
      setItems([]);
      setDisc({ type: "pct", value: 0 });
      setCustId(WALK_IN_CUSTOMER.id);
      setLastTx(null);
    }
  };

  if (!ready) return <PageSkel />;

  const cart = (
    <CartPanel
      items={items} customer={customer} settings={settings} mPct={mPct}
      willEarn={willEarn} onPickCustomer={() => setPickerOpen(true)}
      onRegister={() => setMemberFormOpen(true)} onBenefits={() => setBenefitOpen(true)}
      disc={disc} setDisc={setDisc} totals={totals} savings={savings}
      setQty={setQty} remove={remove} onHold={hold} onClear={clearCart}
      onCharge={() => { setCartOpen(false); setPayOpen(true); }}
      stockOf={stockById}
    />
  );

  const hiddenToday = products.filter((p) => p.active && !isAvailableToday(p)).length;

  return (
    <div className="lg:h-[calc(100dvh-172px)] lg:grid lg:grid-cols-[minmax(0,1fr)_396px] lg:gap-6">
      <section className="flex flex-col min-h-0">
        <div className="flex flex-wrap items-center justify-between gap-2 rise">
          <div className="min-w-0">
            <h1 className="font-display font-bold text-xl flex items-center gap-2">
              Ruang Kasir
              {user && (
                <Badge color={isTestMode ? "var(--accent)" : "var(--amber)"}>
                  {isTestMode ? <IShield size={10} /> : <IUser size={10} />}{" "}
                  {user.name.split(" ")[0]}
                </Badge>
              )}
              {LIVE && (
                <Badge color="var(--pandan)">
                  <span className="w-1.5 h-1.5 rounded-full pulse-dot" style={{ background: "currentColor" }} />
                  MODE LIVE
                </Badge>
              )}
            </h1>
            <p className="text-[11px] text-faint mt-0.5 hidden xl:block">
              <span className="kbd">/</span> cari ·{" "}
              <span className="kbd">Enter</span> tambah hasil pertama · benefit member otomatis
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => { setTablesOpen(true); sfx.tap(); }} className="chip">
              <IStore size={12} /> Meja{" "}
              <span className="opacity-70">{freeTableCount}/{activeTables.length}</span>
            </button>
            <button onClick={() => { setBenefitOpen(true); sfx.tap(); }} className="chip">
              <IHeart size={12} /> Benefit member
            </button>
            {promoTodayCount > 0 && (
              <button
                onClick={() => { setPromoOnly((v) => !v); setOnlyToday(true); sfx.tap(); }}
                className={`chip ${promoOnly ? "chip-on" : ""}`}
              >
                <IPercent size={12} /> Promo <span className="opacity-70">{promoTodayCount}</span>
              </button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setHeldOpen(true)}>
              <IPause size={14} /> Ditahan
              {heldList.length > 0 && <Badge color="var(--amber)">{heldList.length}</Badge>}
            </Button>
          </div>
        </div>

        {isTestMode && (
          <div className="mt-3 rise" style={{ animationDelay: "35ms" }}>
            <KasirTestBanner />
          </div>
        )}
        {LIVE && (
          <div className="mt-3 rise" style={{ animationDelay: "35ms" }}>
            <div
              className="rounded-xl border px-3 py-2.5 text-[11px] flex items-start gap-2"
              style={{
                borderColor: "color-mix(in srgb, var(--pandan) 38%, transparent)",
                background: "color-mix(in srgb, var(--pandan) 8%, transparent)",
              }}
            >
              <IShield size={14} className="shrink-0 mt-0.5" style={{ color: "var(--pandan)" }} />
              <span className="text-mute">
                <b className="text-ink">Mode live.</b> Transaksi tersimpan ke database server (atomik, anti-curang).
                Shift kasir & sinkron penuh member/meja menyusul di fase berikutnya.
              </span>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 mt-3 rise" style={{ animationDelay: "50ms" }}>
          <div className="grow min-w-[220px]">
            <SearchField
              value={q} onChange={setQ} size="lg"
              shortcut={payOpen || quick || pickerOpen || benefitOpen ? undefined : "/"}
              count={filtered.length} countLabel="produk" ariaLabel="Cari produk kasir"
              placeholder="Cari nama produk, SKU, atau kategori…"
              onEnter={() => { if (filtered[0]) add(filtered[0]); }}
              onEscape={() => setQ("")}
            />
          </div>
          <div className="flex items-center gap-1.5">
            <Segmented
              value={density}
              onChange={(v) => { setDensity(v as Density); sfx.tap(); }}
              options={[
                { v: "ringkas", l: <span title="Kartu ringkas">S</span> },
                { v: "standar", l: <span title="Kartu standar">M</span> },
                { v: "besar", l: <span title="Kartu besar">L</span> },
              ]}
            />
            <IconBtn label="Tampilan kartu" active={layout === "kartu"} onClick={() => { setLayout("kartu"); sfx.tap(); }}>
              <IBox size={16} />
            </IconBtn>
            <IconBtn label="Tampilan daftar" active={layout === "daftar"} onClick={() => { setLayout("daftar"); sfx.tap(); }}>
              <IMenu size={16} />
            </IconBtn>
            <IconBtn
              label={fit === "cover" ? "Foto memenuhi kotak" : "Foto utuh"}
              active={fit === "contain"}
              onClick={() => { setFit(fit === "cover" ? "contain" : "cover"); sfx.tap(); }}
            >
              <IImage size={16} />
            </IconBtn>
          </div>
        </div>

        <div className="flex gap-2 mt-2.5 overflow-x-auto pb-1 rise" style={{ animationDelay: "90ms" }}>
          <Chip active={cat === "Semua"} onClick={() => setCat("Semua")}>Semua</Chip>
          <Chip active={cat === "Paket"} onClick={() => setCat("Paket")}>
            <ITag size={12} /> Paket{" "}
            <span className="opacity-60">{products.filter((p) => p.active && p.kind === "bundle").length}</span>
          </Chip>
          {CATEGORIES.map((c) => (
            <Chip key={c} active={cat === c} onClick={() => setCat(c)}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: CATEGORY_COLORS[c] }} /> {c}
            </Chip>
          ))}
          <span className="w-px shrink-0 bg-line mx-1" />
          <Chip active={onlyToday} onClick={() => { setOnlyToday(!onlyToday); sfx.tap(); }}>
            <ICalendar size={12} /> Tersedia hari ini
            {!onlyToday && hiddenToday > 0 && <span className="opacity-60">+{hiddenToday}</span>}
          </Chip>
        </div>

        <div className="mt-3 overflow-y-auto pr-1 lg:flex-1 min-h-0 pb-28 lg:pb-2">
          {filtered.length === 0 ? (
            <EmptyState
              emoji="🔍" title="Tidak ada produk cocok"
              desc={
                products.length === 0
                  ? "Katalog masih kosong. Administrator perlu menambahkan produk dulu."
                  : "Coba kata kunci lain, atau longgarkan filter hari & promo."
              }
            >
              <Button variant="ghost" size="sm" onClick={() => { setQ(""); setCat("Semua"); setOnlyToday(false); setPromoOnly(false); }}>
                Reset Filter
              </Button>
            </EmptyState>
          ) : layout === "kartu" ? (
            <div className="grid gap-3 content-start" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${d.min}px, 1fr))` }}>
              {filtered.map((p, i) => (
                <ProductCard
                  key={p.id} p={p} products={products} settings={settings} fit={fit} d={d}
                  qty={inCart(p.id)} index={i} onAdd={() => add(p)}
                  onInfo={() => { setQuick(p); sfx.tap(); }}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((p, i) => (
                <ProductRow
                  key={p.id} p={p} products={products} settings={settings} fit={fit}
                  qty={inCart(p.id)} index={i} onAdd={() => add(p)}
                  onInfo={() => { setQuick(p); sfx.tap(); }}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      <aside className="hidden lg:flex flex-col card min-h-0 overflow-hidden rise" style={{ animationDelay: "130ms" }}>
        {cart}
      </aside>

      {items.length > 0 && !payOpen && (
        <div className="lg:hidden fixed bottom-[4.4rem] inset-x-3 z-30 card p-3 flex items-center justify-between gap-3 anim-pop">
          <span className="flex items-center gap-2.5 min-w-0">
            <span className="relative w-9 h-9 rounded-xl grid place-items-center bg-accent-soft text-accent shrink-0">
              <ICart size={17} />
              <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full grid place-items-center text-[9px] font-bold grad-accent text-accent-ink">
                {itemCount}
              </span>
            </span>
            <span className="min-w-0">
              <span className="block text-[11px] text-faint font-bold">
                {itemCount} item{savings > 0 && ` · hemat ${rupiah(savings)}`}
              </span>
              <span className="block font-display font-bold text-sm truncate">{rupiah(totals.total)}</span>
            </span>
          </span>
          <Button size="sm" onClick={() => setCartOpen(true)}>Keranjang</Button>
        </div>
      )}

      <Drawer open={cartOpen} onClose={() => setCartOpen(false)} title={`Keranjang • ${itemCount} item`}>
        <div className="-mx-5 -my-4 flex flex-col h-[70dvh]">{cart}</div>
      </Drawer>

      <Drawer
        open={heldOpen}
        onClose={() => { setHeldOpen(false); if (sp.get("held")) router.replace("/kasir"); }}
        title={`Order Ditahan (${heldList.length})`}
      >
        {heldList.length === 0 ? (
          <EmptyState emoji="⏸️" title="Tidak ada order ditahan" desc="Tahan order dari keranjang untuk dilanjutkan nanti." />
        ) : (
          <ul className="space-y-3">
            {heldList.map((o) => {
              const oc = customers.find((c) => c.id === o.customerId) ?? WALK_IN_CUSTOMER;
              const t = calcTotals(o.items, o.discount, settings, memberDiscountPct(oc, settings));
              return (
                <li key={o.id} className="rounded-2xl border border-line bg-surface p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-bold truncate">{o.label}</p>
                    <span className="text-[10px] text-faint shrink-0">{relTime(o.ts)}</span>
                  </div>
                  <div className="flex gap-1.5 mt-2">
                    {o.items.slice(0, 5).map((i) => (
                      <ProductThumb key={i.productId} name={i.name} photo={i.photo} category={i.category} size={30} rounded={8} />
                    ))}
                    {o.items.length > 5 && <span className="text-[10px] text-faint self-center">+{o.items.length - 5}</span>}
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <p className="font-display font-bold text-accent">{rupiah(t.total)}</p>
                    <div className="flex gap-2">
                      <IconBtn label="Hapus order" onClick={() => removeHeld(o)}><ITrash size={15} /></IconBtn>
                      <Button size="sm" onClick={() => resume(o)}>Lanjutkan</Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Drawer>

      <QuickView
        product={quick} products={products} transactions={state.transactions}
        settings={settings} qty={quick ? inCart(quick.id) : 0}
        onAdd={(p) => add(p)} onQty={(id, delta) => setQty(id, delta)} onClose={() => setQuick(null)}
      />

      <MemberPicker
        open={pickerOpen} onClose={() => setPickerOpen(false)}
        currentId={custId} onPick={(c) => setCustId(c.id)} onRegister={() => setMemberFormOpen(true)}
      />
      <MemberForm open={memberFormOpen} edit={null} onClose={() => setMemberFormOpen(false)} onSaved={(c) => setCustId(c.id)} />

      <MemberBenefitsModal
        open={benefitOpen} onClose={() => setBenefitOpen(false)} settings={settings}
        canConfigure={isAdmin} onConfigure={() => router.push("/member?tab=benefit")}
        roleNote={
          isAdmin
            ? "Kamu masuk sebagai administrator: mewarisi semua fitur kasir, dan satu-satunya peran yang boleh mengubah benefit member di halaman Member → Benefit Member. Transaksi di kasir admin bersifat uji."
            : "Kamu masuk sebagai kasir: bisa mendaftarkan member, memilih member di keranjang, dan benefit dihitung otomatis. Angka benefit hanya bisa diubah administrator di halaman Member → Benefit Member."
        }
      />

      <Modal
        open={tablesOpen} onClose={() => setTablesOpen(false)} title="Ketersediaan meja" wide
        footer={<div className="flex justify-end"><Button onClick={() => setTablesOpen(false)}>Tutup</Button></div>}
      >
        <TableGrid tables={tables} />
      </Modal>

      <PaymentSheet
        open={payOpen} onClose={closePay} totals={totals} customerName={customer.name}
        settings={settings} lastTx={lastTx} onConfirm={confirmPay}
        isAdmin={isTestMode} tables={tables}
      />
    </div>
  );
}

function ProductCard({
  p,
  products,
  settings,
  fit,
  d,
  qty,
  index,
  onAdd,
  onInfo,
}: {
  p: Product;
  products: Product[];
  settings: { lowStock: number };
  fit: Fit;
  d: {
    min: number;
    aspect: string;
    pad: string;
    name: string;
    lines: number;
    price: string;
  };
  qty: number;
  index: number;
  onAdd: () => void;
  onInfo: () => void;
}) {
  const st = stockOf(p, products);
  const out = st <= 0;
  const low = !out && st <= settings.lowStock;
  const avail = isAvailableToday(p);
  const eff = effectivePrice(p);
  const promo = todayPromo(p);
  const nd = nextAvailableDay(p);
  const np = nextPromoDay(p);
  const disabled = out || !avail;
  const comps = p.kind === "bundle" ? p.bundleItems : [];

  return (
    <div
      className={`group card relative overflow-hidden p-0 transition-all duration-200 hover:-translate-y-1 hover:border-line2 rise ${
        qty > 0 ? "ring-2 ring-accent" : ""
      }`}
      style={{ animationDelay: `${Math.min(index, 14) * 26}ms` }}
    >
      <button
        type="button"
        onClick={onAdd}
        disabled={disabled}
        className="block w-full text-left disabled:cursor-not-allowed disabled:opacity-60 active:scale-[.98] transition-transform"
      >
        <div
          className="relative w-full overflow-hidden"
          style={{ aspectRatio: d.aspect }}
        >
          <ProductThumb
            name={p.name}
            photo={p.photo}
            category={p.category}
            fill
            rounded={0}
            fit={fit}
            className="transition-transform duration-500 group-hover:scale-[1.05]"
          />
          <div
            className="absolute inset-x-0 top-0 h-20 pointer-events-none"
            style={{
              background:
                "linear-gradient(180deg, color-mix(in srgb, var(--bg) 62%, transparent), transparent)",
            }}
          />
          <span className="absolute top-1.5 right-1.5 flex flex-col items-end gap-1 pointer-events-none">
            {promo && (
              <Badge color="var(--amber)">
                <IPercent size={10} /> {discountLabel(promo)}
              </Badge>
            )}
            {!promo && hasDiscount(p) && (
              <Badge color="var(--amber)">{discountLabel(p.discount)}</Badge>
            )}
            {p.kind === "bundle" && (
              <Badge color="var(--violet)">
                <ITag size={10} /> Paket
              </Badge>
            )}
            {isLimited(p) && (
              <Badge color="var(--magenta)">
                <ISparkle size={10} /> Limited
              </Badge>
            )}
            {(out || low) && (
              <Badge color={out ? "var(--chili)" : "var(--amber)"}>
                {out ? "Habis" : `Sisa ${st}`}
              </Badge>
            )}
          </span>

          {qty > 0 && (
            <span className="absolute bottom-1.5 left-1.5 min-w-6 h-6 px-1.5 rounded-full grid place-items-center text-[11px] font-bold grad-accent text-accent-ink shadow-lg pointer-events-none">
              ×{qty}
            </span>
          )}

          {!avail && (
            <span
              className="absolute inset-0 grid place-items-center px-2 pointer-events-none"
              style={{
                background: "color-mix(in srgb, var(--bg) 68%, transparent)",
              }}
            >
              <span className="text-[10px] font-bold px-2.5 py-1.5 rounded-full bg-overlay border border-line2 text-center leading-snug">
                Libur hari ini
                {nd !== null && (
                  <>
                    <br />
                    kembali {DAY_FULL[nd]}
                  </>
                )}
              </span>
            </span>
          )}

          {!disabled && (
            <span className="absolute bottom-1.5 right-1.5 w-8 h-8 rounded-full grid place-items-center grad-accent text-accent-ink shadow-lg opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200 pointer-events-none">
              <IPlus size={16} />
            </span>
          )}
        </div>

        <div className={d.pad}>
          <p
            className={`font-bold leading-tight ${d.name}`}
            style={{
              display: "-webkit-box",
              WebkitLineClamp: d.lines,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              minHeight: d.lines === 1 ? "1.3em" : "2.5em",
            }}
          >
            {p.name}
          </p>

          {d.min > 130 && (
            <div className="flex items-center gap-1.5 mt-1">
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ background: CATEGORY_COLORS[p.category] }}
              />
              <span className="text-[9.5px] text-faint font-mono truncate">
                {p.sku}
              </span>
            </div>
          )}

          <div className="flex items-baseline gap-1.5 mt-1.5 flex-wrap">
            <span
              className={`font-display font-bold text-accent tabular-nums ${d.price}`}
            >
              {rupiah(eff)}
            </span>
            {hasDiscount(p) && (
              <span className="text-[10px] text-faint line-through">
                {rupiah(p.price)}
              </span>
            )}
          </div>

          <div className="flex items-center justify-between gap-1 mt-1">
            <span
              className={`text-[10px] font-bold ${
                out ? "text-chili" : low ? "text-amber" : "text-mute"
              }`}
            >
              {p.kind === "bundle" ? `${num(st)} porsi` : `Stok ${num(st)}`}
            </span>
            {promo ? (
              <span className="text-[9px] font-bold text-amber truncate">
                {promoLabel(p)}
              </span>
            ) : np !== null ? (
              <span className="text-[9px] text-faint truncate">
                promo {DAY_SHORT[np]}
              </span>
            ) : null}
          </div>

          {d.min >= 200 && comps.length > 0 && (
            <p className="text-[9.5px] text-faint mt-1.5 leading-snug line-clamp-2">
              Isi:{" "}
              {comps
                .map(
                  (c) =>
                    `${c.qty}× ${
                      products.find((x) => x.id === c.productId)?.name ?? "?"
                    }`,
                )
                .join(" · ")}
            </p>
          )}
        </div>
      </button>

      <button
        type="button"
        onClick={onInfo}
        aria-label={`Detail ${p.name}`}
        title="Lihat detail & stok akurat"
        className="absolute top-1.5 left-1.5 w-7 h-7 rounded-lg grid place-items-center border border-line2 bg-overlay/85 text-mute hover:text-accent hover:border-accent transition-colors backdrop-blur-sm"
      >
        <IInfo size={14} />
      </button>
    </div>
  );
}

function ProductRow({
  p,
  products,
  settings,
  fit,
  qty,
  index,
  onAdd,
  onInfo,
}: {
  p: Product;
  products: Product[];
  settings: { lowStock: number };
  fit: Fit;
  qty: number;
  index: number;
  onAdd: () => void;
  onInfo: () => void;
}) {
  const st = stockOf(p, products);
  const out = st <= 0;
  const low = !out && st <= settings.lowStock;
  const avail = isAvailableToday(p);
  const eff = effectivePrice(p);
  const promo = todayPromo(p);
  const nd = nextAvailableDay(p);
  const disabled = out || !avail;

  return (
    <div
      className={`card p-2.5 flex items-center gap-3 rise ${
        qty > 0 ? "ring-2 ring-accent" : ""
      } ${disabled ? "opacity-65" : ""}`}
      style={{ animationDelay: `${Math.min(index, 16) * 20}ms` }}
    >
      <ProductThumb
        name={p.name}
        photo={p.photo}
        category={p.category}
        size={48}
        rounded={12}
        fit={fit}
      />

      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-bold leading-tight truncate flex items-center gap-1.5">
          {p.name}
          {qty > 0 && (
            <span className="text-[10px] font-bold text-accent">×{qty}</span>
          )}
        </p>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
          <span className="text-[10px] text-faint font-mono">{p.sku}</span>
          <span
            className={`text-[10px] font-bold ${
              out ? "text-chili" : low ? "text-amber" : "text-mute"
            }`}
          >
            {p.kind === "bundle" ? `${num(st)} porsi` : `Stok ${num(st)}`}
          </span>
          {p.kind === "bundle" && <Badge color="var(--violet)">Paket</Badge>}
          {isLimited(p) && <Badge color="var(--magenta)">Limited</Badge>}
          {promo && <Badge color="var(--amber)">{promoLabel(p)}</Badge>}
          {!avail && (
            <Badge color="var(--chili)">
              Libur{nd !== null ? ` · ${DAY_SHORT[nd]}` : ""}
            </Badge>
          )}
        </div>
      </div>

      <div className="text-right shrink-0">
        <p className="font-display font-bold text-accent text-sm tabular-nums">
          {rupiah(eff)}
        </p>
        {hasDiscount(p) && (
          <p className="text-[10px] text-faint line-through">
            {rupiah(p.price)}
          </p>
        )}
      </div>

      <IconBtn
        label={`Detail ${p.name}`}
        className="!p-1.5 shrink-0"
        onClick={onInfo}
      >
        <IInfo size={15} />
      </IconBtn>

      <Button
        size="sm"
        className="shrink-0"
        disabled={disabled}
        onClick={onAdd}
      >
        <IPlus size={14} />
      </Button>
    </div>
  );
}

function QuickView({
  product,
  products,
  transactions,
  settings,
  qty,
  onAdd,
  onQty,
  onClose,
}: {
  product: Product | null;
  products: Product[];
  transactions: Transaction[];
  settings: { taxPct: number; servicePct: number; lowStock: number };
  qty: number;
  onAdd: (p: Product) => void;
  onQty: (id: string, delta: number) => void;
  onClose: () => void;
}) {
  const p = product;

  const sold = useMemo(() => {
    if (!p) return 0;
    return transactions.reduce(
      (a, t) =>
        t.status === "Selesai"
          ? a +
            t.items
              .filter((i) => i.productId === p.id)
              .reduce((b, i) => b + i.qty, 0)
          : a,
      0,
    );
  }, [p, transactions]);

  if (!p) {
    return (
      <Drawer open={false} onClose={onClose} title="Detail produk">
        <span />
      </Drawer>
    );
  }

  const eff = effectivePrice(p);
  const st = stockOf(p, products);
  const avail = isAvailableToday(p);
  const nd = nextAvailableDay(p);
  const tax = Math.round((eff * settings.taxPct) / 100);

  return (
    <Drawer
      open={!!product}
      onClose={onClose}
      title="Detail produk"
      footer={
        <div className="flex items-center gap-2">
          {qty > 0 && (
            <div className="flex items-center gap-1.5 rounded-xl border border-line bg-surface px-2 py-1.5">
              <IconBtn
                label="Kurangi"
                className="!p-1"
                onClick={() => onQty(p.id, -1)}
              >
                <IMinus size={13} />
              </IconBtn>
              <span className="w-6 text-center font-mono font-bold text-sm">
                {qty}
              </span>
              <IconBtn
                label="Tambah"
                className="!p-1"
                onClick={() => onQty(p.id, 1)}
              >
                <IPlus size={13} />
              </IconBtn>
            </div>
          )}
          <Button
            className="flex-1"
            disabled={!avail || st <= 0}
            onClick={() => onAdd(p)}
          >
            <IPlus size={16} />{" "}
            {qty > 0 ? "Tambah lagi" : "Tambah ke keranjang"} · {rupiah(eff)}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div
          className="rounded-2xl border border-line overflow-hidden"
          style={{ aspectRatio: "16 / 10" }}
        >
          <ProductThumb
            name={p.name}
            photo={p.photo}
            category={p.category}
            fill
            rounded={0}
            fit="contain"
          />
        </div>

        <div>
          <h3 className="font-display font-bold text-lg leading-tight">
            {p.name}
          </h3>
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <Badge color={CATEGORY_COLORS[p.category]}>{p.category}</Badge>
            {p.kind === "bundle" && <Badge color="var(--violet)">Paket</Badge>}
            {isLimited(p) && <Badge color="var(--magenta)">Limited</Badge>}
            <span className="text-[11px] text-faint font-mono">{p.sku}</span>
          </div>
          {p.desc && (
            <p className="text-xs text-mute mt-2.5 leading-relaxed">{p.desc}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-line bg-surface p-3">
            <p className="text-[10px] text-faint font-bold uppercase tracking-wider">
              Harga hari ini
            </p>
            <p className="font-display font-bold text-xl mt-1 text-accent">
              {rupiah(eff)}
            </p>
            <p className="text-[10px] text-faint mt-0.5">
              +PPN ≈ {rupiah(tax)}
            </p>
          </div>
          <div className="rounded-xl border border-line bg-surface p-3">
            <p className="text-[10px] text-faint font-bold uppercase tracking-wider">
              Tersedia
            </p>
            <p
              className={`font-display font-bold text-xl mt-1 ${
                st <= 0
                  ? "text-chili"
                  : st <= settings.lowStock
                    ? "text-amber"
                    : ""
              }`}
            >
              {num(st)}
            </p>
            <p className="text-[10px] text-faint mt-0.5">
              {avail
                ? `terjual ${num(sold)} porsi`
                : `kembali ${nd !== null ? DAY_FULL[nd] : "—"}`}
            </p>
          </div>
        </div>

        {p.kind === "bundle" && (
          <div className="rounded-2xl border border-line bg-surface p-4">
            <p className="text-xs font-bold mb-2">Isi paket</p>
            <ul className="space-y-2">
              {p.bundleItems.map((c) => {
                const cp = products.find((x) => x.id === c.productId);
                if (!cp) return null;
                return (
                  <li key={c.productId} className="flex items-center gap-2.5">
                    <ProductThumb
                      name={cp.name}
                      photo={cp.photo}
                      category={cp.category}
                      size={30}
                      rounded={9}
                    />
                    <span className="text-xs font-bold flex-1 truncate">
                      {c.qty}× {cp.name}
                    </span>
                    <span className="text-[10px] font-mono text-faint">
                      stok {cp.stock}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </Drawer>
  );
}

function CartPanel({
  items,
  customer,
  settings,
  mPct,
  willEarn,
  onPickCustomer,
  onRegister,
  onBenefits,
  disc,
  setDisc,
  totals,
  savings,
  setQty,
  remove,
  onHold,
  onClear,
  onCharge,
  stockOf: stockOfFn,
}: {
  items: TxItem[];
  customer: Customer;
  settings: Settings;
  mPct: number;
  willEarn: number;
  onPickCustomer: () => void;
  onRegister: () => void;
  onBenefits: () => void;
  disc: Discount;
  setDisc: (d: Discount) => void;
  totals: {
    subtotal: number;
    discount: number;
    memberDiscount: number;
    tax: number;
    service: number;
    total: number;
  };
  savings: number;
  setQty: (id: string, d: number) => void;
  remove: (id: string) => void;
  onHold: () => void;
  onClear: () => void;
  onCharge: () => void;
  stockOf: (id: string) => number;
}) {
  const count = items.reduce((a, i) => a + i.qty, 0);
  const tier = tierOf(customer.spend ?? 0, settings);
  const bday = isBirthday(customer);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="p-4 border-b border-line shrink-0">
        <div className="flex items-center justify-between mb-2.5">
          <p className="font-display font-bold text-sm flex items-center gap-2">
            <ICart size={15} className="text-accent" /> Keranjang
          </p>
          <Badge color={count ? "var(--accent)" : "var(--faint)"}>
            {count} item
          </Badge>
        </div>

        <button
          onClick={onPickCustomer}
          className="w-full rounded-xl border p-2.5 flex items-center gap-2.5 text-left transition-colors hover:border-line2"
          style={{
            borderColor: customer.member
              ? "color-mix(in srgb, var(--violet) 40%, transparent)"
              : "var(--line)",
            background: customer.member
              ? "color-mix(in srgb, var(--violet) 8%, var(--surface))"
              : "var(--surface)",
          }}
        >
          <span
            className="w-9 h-9 rounded-lg grid place-items-center text-[11px] font-bold shrink-0"
            style={{
              color: customer.member ? TIER_COLOR[tier] : "var(--muted)",
              background: `color-mix(in srgb, ${
                customer.member ? TIER_COLOR[tier] : "var(--muted)"
              } 15%, transparent)`,
            }}
          >
            {initials(customer.name)}
          </span>

          <span className="min-w-0 flex-1">
            <span className="block text-xs font-bold truncate">
              {customer.name}
            </span>
            <span className="block text-[10px] text-faint font-mono truncate">
              {customer.member
                ? `${customer.memberNo} · ${num(customer.points ?? 0)} poin`
                : customer.phone !== "-"
                  ? customer.phone
                  : "non-member · klik untuk ganti"}
            </span>
          </span>

          {customer.member ? (
            <Badge color={TIER_COLOR[tier]}>
              <IStar size={9} /> {tier}
            </Badge>
          ) : (
            <IUser size={14} className="text-faint shrink-0" />
          )}
        </button>

        <div className="flex flex-wrap items-center gap-1.5 mt-2">
          {customer.member && mPct > 0 && (
            <Badge color="var(--pandan)">member −{mPct}%</Badge>
          )}
          {customer.member && (
            <Badge color={TIER_COLOR[tier]}>
              tier {totalTierPct(tier, settings)}%
            </Badge>
          )}
          {bday && (
            <Badge color="var(--magenta)">
              🎂 +{settings.memberBirthdayPct}%
            </Badge>
          )}
          {customer.member && customer.memberActive === false && (
            <Badge color="var(--chili)">nonaktif</Badge>
          )}
          <button
            onClick={onBenefits}
            className="chip !py-1 !px-2 !text-[10px] ml-auto"
          >
            <IInfo size={11} /> Benefit
          </button>
          <button
            onClick={onRegister}
            className="chip !py-1 !px-2 !text-[10px]"
          >
            <IUserPlus size={11} /> Baru
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2.5 min-h-0">
        {items.length === 0 ? (
          <EmptyState
            emoji="🛒"
            title="Keranjang kosong"
            desc="Klik kartu produk untuk mulai transaksi."
          />
        ) : (
          items.map((i) => {
            const cut = itemSavings(i);
            return (
              <div
                key={i.productId}
                className="rounded-2xl border border-line bg-surface p-2.5 rise"
              >
                <div className="flex items-start gap-2.5">
                  <ProductThumb
                    name={i.name}
                    photo={i.photo}
                    category={i.category}
                    size={40}
                    rounded={11}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold leading-tight flex items-center gap-1">
                      {i.kind === "bundle" && (
                        <ITag size={11} className="text-violet shrink-0" />
                      )}
                      <span className="line-clamp-2">{i.name}</span>
                    </p>
                    <p className="text-[10px] text-faint font-mono mt-0.5">
                      {rupiah(i.price)}
                      {cut > 0 && (
                        <span className="line-through ml-1">
                          {rupiah(i.basePrice ?? i.price)}
                        </span>
                      )}
                      {i.qty >= stockOfFn(i.productId) && (
                        <span className="text-amber"> · maks</span>
                      )}
                    </p>
                  </div>
                  <button
                    aria-label="Hapus item"
                    onClick={() => remove(i.productId)}
                    className="text-faint hover:text-chili shrink-0"
                  >
                    <IX size={14} />
                  </button>
                </div>

                {i.components && (
                  <p className="text-[9px] text-faint mt-1.5 leading-snug">
                    {i.components.map((c) => `${c.qty}× ${c.name}`).join(" · ")}
                  </p>
                )}

                <div className="flex items-center gap-1.5 mt-2">
                  <IconBtn
                    label="Kurangi"
                    className="!p-1"
                    onClick={() => setQty(i.productId, -1)}
                  >
                    <IMinus size={13} />
                  </IconBtn>
                  <span className="w-7 text-center font-mono font-bold text-sm">
                    {i.qty}
                  </span>
                  <IconBtn
                    label="Tambah"
                    className="!p-1"
                    onClick={() => setQty(i.productId, 1)}
                  >
                    <IPlus size={13} />
                  </IconBtn>
                  {cut > 0 && (
                    <Badge color="var(--pandan)">hemat {rupiah(cut)}</Badge>
                  )}
                  <span className="font-mono text-xs font-bold ml-auto">
                    {rupiah(i.price * i.qty)}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="p-4 border-t border-line space-y-3 shrink-0 bg-bg2/60">
        <div className="flex items-center gap-2">
          <div className="inline-flex bg-bg2 border border-line rounded-lg p-0.5 gap-0.5">
            {(["rp", "pct"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setDisc({ type: t, value: 0 })}
                className="px-2.5 py-1 text-[11px] font-bold rounded-md"
                style={
                  disc.type === t
                    ? {
                        background: "var(--accent)",
                        color: "var(--accent-ink)",
                      }
                    : { color: "var(--muted)" }
                }
              >
                {t === "rp" ? "Rp" : "%"}
              </button>
            ))}
          </div>
          <Input
            type="number"
            min={0}
            inputMode="numeric"
            placeholder="Diskon transaksi"
            value={disc.value || ""}
            onChange={(e) =>
              setDisc({
                ...disc,
                value: Math.max(0, Number(e.target.value) || 0),
              })
            }
            className="py-2"
          />
        </div>

        <div className="space-y-1 text-xs text-mute">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span className="font-mono">{rupiah(totals.subtotal)}</span>
          </div>
          {savings > 0 && (
            <div className="flex justify-between text-pandan">
              <span>Hemat promo produk</span>
              <span className="font-mono">−{rupiah(savings)}</span>
            </div>
          )}
          {totals.discount > 0 && (
            <div className="flex justify-between text-amber">
              <span>Diskon transaksi</span>
              <span className="font-mono">−{rupiah(totals.discount)}</span>
            </div>
          )}
          {totals.memberDiscount > 0 && (
            <div
              className="flex justify-between"
              style={{ color: "var(--violet)" }}
            >
              <span>Potongan member {mPct}%</span>
              <span className="font-mono">
                −{rupiah(totals.memberDiscount)}
              </span>
            </div>
          )}
          {settings.taxPct > 0 && (
            <div className="flex justify-between">
              <span>PPN {settings.taxPct}%</span>
              <span className="font-mono">{rupiah(totals.tax)}</span>
            </div>
          )}
          {settings.servicePct > 0 && (
            <div className="flex justify-between">
              <span>Service {settings.servicePct}%</span>
              <span className="font-mono">{rupiah(totals.service)}</span>
            </div>
          )}
        </div>

        {willEarn > 0 && (
          <div
            className="rounded-xl border px-3 py-2 flex items-center gap-2 text-[11px]"
            style={{
              borderColor: "color-mix(in srgb, var(--violet) 35%, transparent)",
              background: "color-mix(in srgb, var(--violet) 8%, transparent)",
            }}
          >
            <IHeart size={13} style={{ color: "var(--violet)" }} />
            <span className="text-mute">Poin didapat</span>
            <span
              className="ml-auto font-bold"
              style={{ color: "var(--violet)" }}
            >
              +{willEarn}
            </span>
          </div>
        )}

        <div className="flex items-baseline justify-between border-t border-dashed border-line2 pt-2">
          <span className="text-xs font-bold text-mute">TOTAL</span>
          <span className="font-display font-bold text-2xl text-accent tabular-nums">
            {rupiah(totals.total)}
          </span>
        </div>

        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1"
            disabled={!items.length}
            onClick={onHold}
          >
            <IPause size={14} /> Tahan
          </Button>
          <IconBtn label="Kosongkan keranjang" onClick={onClear}>
            <ITrash size={15} />
          </IconBtn>
        </div>

        <Button
          className="w-full py-3"
          disabled={!items.length}
          onClick={onCharge}
        >
          Bayar • {rupiah(totals.total)}
        </Button>
      </div>
    </div>
  );
}

function PaymentSheet({
  open,
  onClose,
  totals,
  customerName,
  settings,
  lastTx,
  onConfirm,
  isAdmin,
  tables,
}: {
  open: boolean;
  onClose: () => void;
  totals: {
    subtotal: number;
    discount: number;
    memberDiscount: number;
    tax: number;
    service: number;
    total: number;
  };
  customerName: string;
  settings: Settings;
  lastTx: Transaction | null;
  onConfirm: (
    method: PayMethod,
    tendered: number,
    orderType: OrderType,
    tableId: string | null,
  ) => void;
  isAdmin: boolean;
  tables: DiningTable[];
}) {
  const [method, setMethod] = useState<PayMethod>("Tunai");
  const [tendered, setTendered] = useState("");
  const [processing, setProcessing] = useState(false);
  const [orderType, setOrderType] = useState<OrderType>("dinein");
  const [tableId, setTableId] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  useEffect(() => {
    if (open && !lastTx) {
      setMethod("Tunai");
      setTendered("");
      setProcessing(false);
      setOrderType("dinein");
      setTableId(null);
    }

    if (!open) {
      if (timer.current) clearTimeout(timer.current);
      setProcessing(false);
    }
  }, [open, lastTx]);

  const total = totals.total;
  const cash = Number(tendered) || 0;
  const change = cash - total;

  const activeTables = tables.filter((t) => t.active);
  const freeCount = activeTables.filter((t) => t.status === "kosong").length;
  const selectedTable = tableId
    ? activeTables.find((t) => t.id === tableId) ?? null
    : null;
  const tableOk = orderType === "takeaway" || !!selectedTable;
  const canPay = (method !== "Tunai" || cash >= total) && tableOk;

  const quickAmounts = useMemo(() => {
    if (total <= 0) return [];
    const raw = [
      total,
      roundUp(total, 5000),
      roundUp(total, 10000),
      roundUp(total, 50000),
      roundUp(total, 100000),
    ];
    const out: number[] = [];
    raw.forEach((v) => {
      if (v >= total && v > 0 && !out.includes(v)) out.push(v);
    });
    return out.slice(0, 5);
  }, [total]);

  const pay = () => {
    if (!canPay || processing) return;

    setProcessing(true);
    const amount = method === "Tunai" ? cash : total;

    timer.current = setTimeout(() => {
      onConfirm(
        method,
        amount,
        orderType,
        orderType === "dinein" ? tableId : null,
      );
      setProcessing(false);
    }, 320);
  };

  if (lastTx) {
    return (
      <Modal
        open={open}
        onClose={onClose}
        title={lastTx.isTest ? "Hasil transaksi uji" : "Transaksi selesai"}
        footer={
          <div className="flex justify-end">
            <Button onClick={onClose}>Selesai</Button>
          </div>
        }
      >
        <div className="text-center py-2">
          <span
            className="w-14 h-14 rounded-2xl grid place-items-center mx-auto"
            style={{
              color: lastTx.isTest ? "var(--amber)" : "var(--pandan)",
              background: `color-mix(in srgb, ${
                lastTx.isTest ? "var(--amber)" : "var(--pandan)"
              } 14%, transparent)`,
            }}
          >
            <ICheckCircle size={28} />
          </span>

          <h3 className="font-display font-bold text-xl mt-4">
            {lastTx.isTest ? "Transaksi uji selesai" : "Pembayaran berhasil"}
          </h3>

          <p className="text-[11px] text-faint font-mono mt-1">{lastTx.id}</p>

          <p className="font-display font-bold text-3xl mt-4 tabular-nums">
            {rupiah(lastTx.total)}
          </p>

          <div className="flex flex-wrap justify-center gap-1.5 mt-3">
            <Badge color={lastTx.orderType === "dinein" ? "var(--accent)" : "var(--amber)"}>
              {lastTx.orderType === "dinein" ? <IStore size={10} /> : <IBox size={10} />}
              {lastTx.orderType === "dinein" ? " Makan di sini" : " Bawa pulang"}
            </Badge>
            {lastTx.orderType === "dinein" && lastTx.tableLabel && (
              <Badge color="var(--violet)">Meja {lastTx.tableLabel}</Badge>
            )}
          </div>

          {lastTx.isTest && (
            <div
              className="mt-4 rounded-xl border px-3 py-2.5 text-[11px] text-left"
              style={{
                borderColor:
                  "color-mix(in srgb, var(--amber) 38%, transparent)",
                background: "color-mix(in srgb, var(--amber) 8%, transparent)",
              }}
            >
              <p className="font-bold" style={{ color: "var(--amber)" }}>
                Mode uji admin
              </p>
              <p className="text-mute mt-1 leading-relaxed">
                Transaksi ini hanya untuk testing fitur. Tidak tercatat di
                riwayat transaksi, tidak mengurangi stok, tidak menambah omzet,
                tidak memberi poin member, tidak memengaruhi shift, dan tidak
                mengisi meja.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 mt-5 text-left">
            <div className="rounded-xl border border-line bg-surface p-3">
              <p className="text-[10px] text-faint font-bold uppercase tracking-wider">
                Metode
              </p>
              <p className="text-sm font-bold mt-1">{lastTx.method}</p>
            </div>
            <div className="rounded-xl border border-line bg-surface p-3">
              <p className="text-[10px] text-faint font-bold uppercase tracking-wider">
                Pelanggan
              </p>
              <p className="text-sm font-bold mt-1 truncate">
                {lastTx.customerName}
              </p>
            </div>
            <div className="rounded-xl border border-line bg-surface p-3">
              <p className="text-[10px] text-faint font-bold uppercase tracking-wider">
                Kasir
              </p>
              <p className="text-sm font-bold mt-1 truncate">
                {lastTx.cashier}
              </p>
            </div>
            <div className="rounded-xl border border-line bg-surface p-3">
              <p className="text-[10px] text-faint font-bold uppercase tracking-wider">
                Waktu
              </p>
              <p className="text-sm font-bold mt-1">
                {new Date(lastTx.ts).toLocaleTimeString("id-ID", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>

          {lastTx.method === "Tunai" && (
            <div className="rounded-xl border border-line bg-surface p-3 mt-3 text-left text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-mute">Uang diterima</span>
                <span className="font-mono font-bold">
                  {rupiah(lastTx.tendered)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-mute">Kembalian</span>
                <span className="font-mono font-bold text-pandan">
                  {rupiah(Math.max(0, lastTx.change))}
                </span>
              </div>
            </div>
          )}

          {(lastTx.memberPoints ?? 0) > 0 && (
            <div
              className="rounded-xl border px-3 py-2.5 mt-3 text-left text-[11px] flex items-center gap-2"
              style={{
                borderColor:
                  "color-mix(in srgb, var(--violet) 35%, transparent)",
                background: "color-mix(in srgb, var(--violet) 8%, transparent)",
              }}
            >
              <IHeart size={14} style={{ color: "var(--violet)" }} />
              <span className="text-mute">Member mendapat</span>
              <span
                className="ml-auto font-bold"
                style={{ color: "var(--violet)" }}
              >
                +{lastTx.memberPoints} poin
              </span>
            </div>
          )}

          {(lastTx.memberDiscount ?? 0) > 0 && (
            <p className="text-[11px] text-pandan mt-2">
              Hemat member {rupiah(lastTx.memberDiscount ?? 0)}
            </p>
          )}

          {settings.receiptFooter && (
            <p className="text-[11px] text-faint mt-4 leading-relaxed">
              {settings.receiptFooter}
            </p>
          )}
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Pembayaran • ${customerName}`}
      wide={orderType === "dinein"}
      footer={
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={onClose} disabled={processing}>
            Batal
          </Button>
          <Button onClick={pay} disabled={!canPay || processing}>
            {processing
              ? "Memproses…"
              : method === "Tunai"
                ? `Bayar Tunai • ${rupiah(total)}`
                : `Konfirmasi ${method} • ${rupiah(total)}`}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {isAdmin && (
          <div
            className="rounded-xl border px-3 py-2.5 text-[11px] flex items-start gap-2"
            style={{
              borderColor: "color-mix(in srgb, var(--amber) 38%, transparent)",
              background: "color-mix(in srgb, var(--amber) 8%, transparent)",
            }}
          >
            <IShield
              size={14}
              className="shrink-0 mt-0.5"
              style={{ color: "var(--amber)" }}
            />
            <span className="text-mute">
              <b className="text-ink">Mode uji admin.</b> Pembayaran ini hanya
              untuk testing alur, struk, QRIS, dan member. Tidak akan dicatat ke
              sistem dan tidak mengisi meja.
            </span>
          </div>
        )}

        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-faint mb-1.5">
            Tipe pesanan
          </label>
          <Segmented
            value={orderType}
            onChange={(v) => {
              setOrderType(v as OrderType);
              setTableId(null);
              sfx.tap();
            }}
            className="w-full"
            options={[
              {
                v: "dinein",
                l: (
                  <span className="inline-flex items-center gap-1.5">
                    <IStore size={13} /> Makan di sini
                  </span>
                ),
              },
              {
                v: "takeaway",
                l: (
                  <span className="inline-flex items-center gap-1.5">
                    <IBox size={13} /> Bawa pulang
                  </span>
                ),
              },
            ]}
          />
        </div>

        {orderType === "dinein" && (
          <div className="rounded-2xl border border-line bg-surface p-3.5">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <p className="text-xs font-bold flex items-center gap-1.5">
                <IStore size={13} className="text-accent" /> Pilih meja
              </p>
              {selectedTable ? (
                <Badge color="var(--accent)">Terpilih: {selectedTable.label}</Badge>
              ) : (
                <Badge color="var(--amber)">Belum pilih meja</Badge>
              )}
              <span className="ml-auto text-[10.5px] text-faint">
                {freeCount} meja kosong
              </span>
            </div>

            {freeCount === 0 ? (
              <div
                className="rounded-xl border px-3 py-2.5 text-[11px]"
                style={{
                  borderColor: "color-mix(in srgb, var(--chili) 38%, transparent)",
                  background: "color-mix(in srgb, var(--chili) 8%, transparent)",
                }}
              >
                <p className="font-bold text-chili">Semua meja sedang terisi.</p>
                <p className="text-mute mt-1 leading-relaxed">
                  Pilih <b className="text-ink">Bawa pulang</b>, atau kosongkan
                  meja dulu di halaman Member → Meja.
                </p>
              </div>
            ) : (
              <TableGrid
                tables={tables}
                selectable
                selectedId={tableId}
                onSelect={(id) => {
                  setTableId(id);
                  sfx.tap();
                }}
              />
            )}
          </div>
        )}

        <Segmented
          value={method}
          onChange={(v) => {
            setMethod(v as PayMethod);
            setTendered("");
          }}
          className="w-full"
          options={PAY_METHODS.map((m) => ({
            v: m,
            l: (
              <span className="inline-flex items-center gap-1.5">
                {m === "Tunai" ? (
                  <ICash size={13} />
                ) : m === "QRIS" ? (
                  <IQR size={13} />
                ) : (
                  <ICard size={13} />
                )}
                {m}
              </span>
            ),
          }))}
        />

        <div className="rounded-2xl border border-line bg-surface p-3.5 text-xs space-y-1.5">
          <div className="flex justify-between">
            <span className="text-mute">Subtotal</span>
            <span className="font-mono">{rupiah(totals.subtotal)}</span>
          </div>

          {totals.discount > 0 && (
            <div className="flex justify-between text-amber">
              <span>Diskon transaksi</span>
              <span className="font-mono">−{rupiah(totals.discount)}</span>
            </div>
          )}

          {totals.memberDiscount > 0 && (
            <div
              className="flex justify-between"
              style={{ color: "var(--violet)" }}
            >
              <span>Potongan member</span>
              <span className="font-mono">
                −{rupiah(totals.memberDiscount)}
              </span>
            </div>
          )}

          {totals.tax > 0 && (
            <div className="flex justify-between">
              <span>PPN {settings.taxPct}%</span>
              <span className="font-mono">{rupiah(totals.tax)}</span>
            </div>
          )}

          {totals.service > 0 && (
            <div className="flex justify-between">
              <span>Service {settings.servicePct}%</span>
              <span className="font-mono">{rupiah(totals.service)}</span>
            </div>
          )}

          <div className="flex items-baseline justify-between border-t border-dashed border-line2 pt-2 mt-1">
            <span className="font-bold text-mute">TOTAL BAYAR</span>
            <span className="font-display font-bold text-2xl text-accent tabular-nums">
              {rupiah(total)}
            </span>
          </div>
        </div>

        {method === "QRIS" && (
          <div className="rounded-2xl border border-line bg-surface p-4">
            <QRISCenter
              amount={total}
              storeName={settings.storeName}
              src="/qris.png"
            />
            <p className="text-[11px] text-faint text-center mt-2 leading-relaxed">
              Scan QRIS dengan aplikasi bank / e-wallet favorit. Setelah bayar,
              tekan konfirmasi di bawah.
            </p>
          </div>
        )}

        {method === "Tunai" && (
          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-faint mb-1.5">
                Uang diterima
              </label>
              <Input
                type="number"
                min={0}
                inputMode="numeric"
                value={tendered}
                onChange={(e) => setTendered(e.target.value)}
                placeholder={String(total)}
                className="py-3 text-base font-bold"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {quickAmounts.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => {
                    setTendered(String(v));
                    sfx.tap();
                  }}
                  className="rounded-xl border border-line bg-surface px-3 py-2.5 text-xs font-bold hover:border-accent hover:text-accent transition-colors"
                >
                  {rupiah(v)}
                </button>
              ))}
            </div>

            <div
              className="rounded-xl border px-3 py-2.5 flex items-center justify-between text-xs"
              style={{
                borderColor:
                  change >= 0
                    ? "color-mix(in srgb, var(--pandan) 35%, transparent)"
                    : "var(--line)",
                background:
                  change >= 0
                    ? "color-mix(in srgb, var(--pandan) 8%, transparent)"
                    : "var(--surface)",
              }}
            >
              <span className="text-mute font-bold">Kembalian</span>
              <span
                className={`font-mono font-bold ${
                  change >= 0 ? "text-pandan" : "text-chili"
                }`}
              >
                {change >= 0
                  ? rupiah(change)
                  : `kurang ${rupiah(Math.abs(change))}`}
              </span>
            </div>
          </div>
        )}

        {method === "Kartu" && (
          <div className="rounded-2xl border border-line bg-surface p-5 text-center">
            <span
              className="w-12 h-12 rounded-xl grid place-items-center mx-auto"
              style={{
                color: "var(--laut)",
                background: "color-mix(in srgb, var(--laut) 14%, transparent)",
              }}
            >
              <ICard size={24} />
            </span>
            <p className="text-sm font-bold mt-3">
              Pembayaran kartu debit / kredit
            </p>
            <p className="text-[11px] text-mute mt-1.5 leading-relaxed">
              Masukkan kartu ke EDC, pilih nominal, lalu tekan konfirmasi di
              bawah untuk simulasi approval.
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}