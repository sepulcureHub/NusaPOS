"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth, useStore } from "@/lib/store";
import { useToast } from "@/components/Toasts";
import { sfx } from "@/lib/sound";
import type { Customer, DiningTable, MemberTier, PointReward } from "@/lib/types";
import { CATEGORIES, CATEGORY_COLORS } from "@/lib/types";
import { DEMO_SETTINGS } from "@/lib/demo-data";
import { clamp, dateShort, download, num, rupiah, timeID, toCSV, uid } from "@/lib/format";
import {
  TIER_COLOR,
  initials,
  isBirthday,
  memberDiscountPct,
  memberStats,
  nextTier,
  tierOf,
  tierProgress,
  tierThresholds,
} from "@/lib/member";
import {
  activeDiscount,
  discountLabel,
  effectivePrice,
  hasDiscount,
  isAvailableToday,
  isLimited,
  stockOf,
  todayPromo,
} from "@/lib/pricing";
import { DEFAULT_AREAS, makeTable, nextTableLabel, tableStats } from "@/lib/tables";
import { ProductThumb } from "@/components/ProductThumb";
import { SearchField } from "@/components/SearchField";
import { MemberForm } from "@/components/MemberForm";
import { MemberBenefitsPanel, TierLadder } from "@/components/MemberBenefits";
import { TableGrid } from "@/components/TableGrid";
import {
  Badge,
  Button,
  Confirm,
  Drawer,
  EmptyState,
  Field,
  IconBtn,
  Input,
  Modal,
  PageSkel,
  Segmented,
  Select,
  Textarea,
  Toggle,
} from "@/components/ui";
import {
  IBox,
  ICalendar,
  ICheckCircle,
  IDownload,
  IGift,
  IHeart,
  IInfo,
  IPen,
  IPercent,
  IPhone,
  IPlus,
  IReceipt,
  IShield,
  IStar,
  IStore,
  ITag,
  ITrash,
  ITrendUp,
  IUser,
  IUserPlus,
} from "@/components/icons";
import { IHistory } from "@/components/icons-extra";

type PageTab = "benefit" | "member" | "produk" | "meja" | "hadiah" | "penukaran";

const VALID_TABS: PageTab[] = ["benefit", "member", "produk", "meja", "hadiah", "penukaran"];

const SORTS = [
  { v: "points", l: "Poin terbanyak" },
  { v: "spend", l: "Belanja terbesar" },
  { v: "visits", l: "Paling sering datang" },
  { v: "new", l: "Terbaru bergabung" },
  { v: "name", l: "Nama A–Z" },
];

export default function MemberPage() {
  return (
    <Suspense fallback={<PageSkel />}>
      <Members />
    </Suspense>
  );
}

function Members() {
  const { state } = useStore();
  const { can, isAdmin } = useAuth();
  const sp = useSearchParams();

  const [tab, setTab] = useState<PageTab>(() => {
    const q = sp.get("tab") as PageTab | null;
    return q && VALID_TABS.includes(q) ? q : "member";
  });

  useEffect(() => {
    const q = sp.get("tab") as PageTab | null;
    if (q && VALID_TABS.includes(q)) setTab(q);
  }, [sp]);

  if (!state.hydrated) return <PageSkel />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3 rise">
        <div>
          <h1 className="font-display font-bold text-2xl flex items-center gap-2">
            Member & Benefit
            <Badge color="var(--violet)">
              <IHeart size={10} /> {state.customers.filter((c) => c.member).length} member
            </Badge>
          </h1>
          <p className="text-sm text-mute mt-0.5">
            Benefit member, data member, produk tersedia, denah meja, katalog hadiah, dan riwayat penukaran.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {isAdmin && (
            <Badge color="var(--accent)">
              <IShield size={10} /> Admin bisa atur benefit
            </Badge>
          )}
          {!isAdmin && (
            <Badge color="var(--amber)">
              <IInfo size={10} /> Benefit baca-saja
            </Badge>
          )}
        </div>
      </div>

      <Segmented
        value={tab}
        onChange={(v) => {
          setTab(v as PageTab);
          sfx.tap();
        }}
        className="w-fit"
        options={[
          { v: "benefit", l: <><IHeart size={13} /> Benefit Member</> },
          { v: "member", l: <><IUserPlus size={13} /> Member</> },
          { v: "produk", l: <><IBox size={13} /> Produk Tersedia</> },
          { v: "meja", l: <><IStore size={13} /> Meja</> },
          { v: "hadiah", l: <><IGift size={13} /> Katalog Hadiah</> },
          { v: "penukaran", l: <><IHistory size={13} /> Penukaran</> },
        ]}
      />

      {tab === "benefit" && <BenefitTab />}
      {tab === "member" && <MemberTab canManage={can("members.manage")} canDelete={can("members.delete")} isAdmin={isAdmin} />}
      {tab === "produk" && <ProductCatalog />}
      {tab === "meja" && <TableTab isAdmin={isAdmin} />}
      {tab === "hadiah" && <RewardCatalog isAdmin={isAdmin} />}
      {tab === "penukaran" && <RedemptionHistory />}
    </div>
  );
}

function BenefitTab() {
  const { state, dispatch } = useStore();
  const { isAdmin } = useAuth();
  const { push } = useToast();
  const s = state.settings;
  const [preview, setPreview] = useState(false);

  const set = (patch: Partial<typeof s>) => dispatch({ type: "UPDATE_SETTINGS", patch });

  const thresholds = tierThresholds(s);

  const resetBenefit = () => {
    set({
      memberEnabled: DEMO_SETTINGS.memberEnabled,
      memberPointRate: DEMO_SETTINGS.memberPointRate,
      memberDiscountPct: DEMO_SETTINGS.memberDiscountPct,
      memberBirthdayPct: DEMO_SETTINGS.memberBirthdayPct,
      memberWelcomePoints: DEMO_SETTINGS.memberWelcomePoints,
      memberTierSilver: DEMO_SETTINGS.memberTierSilver,
      memberTierGold: DEMO_SETTINGS.memberTierGold,
      memberTierPlatinum: DEMO_SETTINGS.memberTierPlatinum,
      memberBonusBronze: DEMO_SETTINGS.memberBonusBronze,
      memberBonusSilver: DEMO_SETTINGS.memberBonusSilver,
      memberBonusGold: DEMO_SETTINGS.memberBonusGold,
      memberBonusPlatinum: DEMO_SETTINGS.memberBonusPlatinum,
      memberBenefitNotes: DEMO_SETTINGS.memberBenefitNotes,
    });
    sfx.tap();
    push({ msg: "Benefit member dikembalikan ke bawaan", type: "ok" });
  };

  return (
    <div className="space-y-4">
      <div className="card p-5 rise">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <IHeart size={18} style={{ color: "var(--violet)" }} />
          <h2 className="font-display font-bold text-lg">Benefit Member</h2>
          <Badge color={s.memberEnabled ? "var(--pandan)" : "var(--chili)"}>
            {s.memberEnabled ? "Aktif" : "Nonaktif"}
          </Badge>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setPreview(true)}>
              <IInfo size={14} /> Pratinjau
            </Button>
            {isAdmin && (
              <Toggle
                checked={s.memberEnabled}
                label="Program member"
                onChange={(v) => {
                  set({ memberEnabled: v });
                  sfx.tap();
                }}
              />
            )}
          </div>
        </div>

        {!isAdmin && (
          <div
            className="rounded-xl border p-3 text-[11.5px] mb-4 flex gap-2"
            style={{
              borderColor: "color-mix(in srgb, var(--amber) 32%, transparent)",
              background: "color-mix(in srgb, var(--amber) 8%, transparent)",
            }}
          >
            <IInfo size={14} className="text-amber shrink-0 mt-0.5" />
            <span className="text-mute">
              Kamu masuk sebagai kasir. Benefit member hanya bisa dibaca. Administrator dapat mengatur angka benefit di tab ini.
            </span>
          </div>
        )}

        {isAdmin && (
          <div className="space-y-5">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <BenefitNum
                label="Rp per 1 poin"
                hint="1000 = 1 poin / Rp 1.000"
                value={s.memberPointRate}
                min={100}
                max={1000000}
                step={100}
                onChange={(n) => set({ memberPointRate: Math.max(100, n) })}
              />
              <BenefitNum
                label="Potongan dasar (%)"
                hint="Semua member aktif"
                value={s.memberDiscountPct}
                min={0}
                max={25}
                onChange={(n) => set({ memberDiscountPct: n })}
              />
              <BenefitNum
                label="Bonus ulang tahun (%)"
                hint="Tambahan di hari H"
                value={s.memberBirthdayPct}
                min={0}
                max={25}
                onChange={(n) => set({ memberBirthdayPct: n })}
              />
              <BenefitNum
                label="Poin sambutan"
                hint="Saat pertama mendaftar"
                value={s.memberWelcomePoints}
                min={0}
                max={100000}
                step={10}
                onChange={(n) => set({ memberWelcomePoints: n })}
              />
            </div>

            <div className="rounded-2xl border border-line bg-surface p-4 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-bold flex items-center gap-1.5">
                  <IStar size={13} className="text-amber" /> Ambang tier — total belanja kumulatif (Rp)
                </p>
                <span className="text-[10.5px] text-faint ml-auto">Tier naik otomatis saat member melewati ambang ini</span>
              </div>

              <div className="grid sm:grid-cols-3 gap-3">
                <BenefitNum
                  label="Belanja → Silver"
                  hint={`Contoh: ${rupiah(thresholds.Silver)}`}
                  value={s.memberTierSilver}
                  min={1}
                  max={100000000}
                  step={50000}
                  onChange={(n) => {
                    const silver = clamp(n, 1, 100000000);
                    const gold = Math.max(silver + 1, s.memberTierGold);
                    const platinum = Math.max(gold + 1, s.memberTierPlatinum);
                    set({ memberTierSilver: silver, memberTierGold: gold, memberTierPlatinum: platinum });
                  }}
                />
                <BenefitNum
                  label="Belanja → Gold"
                  hint={`Di atas Silver (${rupiah(s.memberTierSilver)})`}
                  value={s.memberTierGold}
                  min={s.memberTierSilver + 1}
                  max={100000000}
                  step={50000}
                  onChange={(n) => {
                    const gold = Math.max(s.memberTierSilver + 1, clamp(n, s.memberTierSilver + 1, 100000000));
                    const platinum = Math.max(gold + 1, s.memberTierPlatinum);
                    set({ memberTierGold: gold, memberTierPlatinum: platinum });
                  }}
                />
                <BenefitNum
                  label="Belanja → Platinum"
                  hint={`Di atas Gold (${rupiah(s.memberTierGold)})`}
                  value={s.memberTierPlatinum}
                  min={s.memberTierGold + 1}
                  max={100000000}
                  step={50000}
                  onChange={(n) => set({ memberTierPlatinum: Math.max(s.memberTierGold + 1, clamp(n, s.memberTierGold + 1, 100000000)) })}
                />
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <BenefitNum
                  label="Bonus Bronze (%)"
                  hint="Di atas potongan dasar"
                  value={s.memberBonusBronze}
                  min={0}
                  max={25}
                  onChange={(n) => set({ memberBonusBronze: n })}
                />
                <BenefitNum
                  label="Bonus Silver (%)"
                  hint="Di atas potongan dasar"
                  value={s.memberBonusSilver}
                  min={0}
                  max={25}
                  onChange={(n) => set({ memberBonusSilver: n })}
                />
                <BenefitNum
                  label="Bonus Gold (%)"
                  hint="Di atas potongan dasar"
                  value={s.memberBonusGold}
                  min={0}
                  max={25}
                  onChange={(n) => set({ memberBonusGold: n })}
                />
                <BenefitNum
                  label="Bonus Platinum (%)"
                  hint="Di atas potongan dasar"
                  value={s.memberBonusPlatinum}
                  min={0}
                  max={25}
                  onChange={(n) => set({ memberBonusPlatinum: n })}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-line bg-surface p-4">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <p className="text-xs font-bold flex items-center gap-1.5">
                  <IShield size={13} className="text-accent" /> Pratinjau penjelasan tier
                </p>
                <span className="text-[10.5px] text-faint ml-auto">Angka bonus = persis yang kamu atur di atas</span>
              </div>
              <TierLadder settings={s} />
              <p className="text-[11px] text-faint mt-3 flex gap-1.5">
                <IInfo size={12} className="shrink-0 mt-0.5" />
                Bonus tier dijumlahkan dengan potongan dasar {s.memberDiscountPct}% saat transaksi (maks 40%). Tampilan lengkap pelanggan bisa dicek lewat tombol pratinjau.
              </p>
            </div>

            <Field label="Catatan benefit untuk pelanggan" hint="Tampil di halaman pelanggan, portal member, dan pratinjau benefit">
              <Textarea rows={2} value={s.memberBenefitNotes} onChange={(e) => set({ memberBenefitNotes: e.target.value })} />
            </Field>

            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" size="sm" onClick={resetBenefit}>
                <IRefreshLike /> Reset benefit
              </Button>
              <Button variant="soft" size="sm" onClick={() => setPreview(true)}>
                <IHeart size={14} /> Lihat seperti pelanggan
              </Button>
            </div>
          </div>
        )}

        {!isAdmin && <MemberBenefitsPanel settings={s} dense showSteps />}
      </div>

      <Modal
        open={preview}
        onClose={() => setPreview(false)}
        wide
        title="Benefit member — seperti dilihat pelanggan"
        footer={
          <div className="flex justify-end">
            <Button onClick={() => setPreview(false)}>Tutup</Button>
          </div>
        }
      >
        <MemberBenefitsPanel settings={s} dense />
      </Modal>
    </div>
  );
}

function IRefreshLike() {
  return <IRefreshIcon />;
}

function IRefreshIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7v6h6" />
      <path d="M21 17a9 9 0 0 0-15-6.7L3 13" />
    </svg>
  );
}

function BenefitNum({
  label,
  hint,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (n: number) => void;
}) {
  return (
    <Field label={label} hint={hint}>
      <Input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(clamp(Number(e.target.value) || 0, min, max))}
      />
    </Field>
  );
}

/* ---------- MEJA: pemantauan live + kosongkan (staf) + kelola denah (admin) ---------- */
function TableTab({ isAdmin }: { isAdmin: boolean }) {
  const { state, dispatch } = useStore();
  const { push } = useToast();
  const [form, setForm] = useState<{ open: boolean; edit: DiningTable | null }>({ open: false, edit: null });
  const [del, setDel] = useState<DiningTable | null>(null);

  const stats = tableStats(state.tables);
  const occupied = state.tables.filter((t) => t.active && t.status === "terisi");

  const freeTable = (t: DiningTable) => {
    dispatch({ type: "FREE_TABLE", id: t.id });
    sfx.remove();
    push({ msg: `Meja ${t.label} dikosongkan — siap dipakai lagi`, type: "ok" });
  };

  const removeTable = (t: DiningTable) => {
    dispatch({ type: "DELETE_TABLES", ids: [t.id] });
    sfx.remove();
    push({
      msg: `Meja ${t.label} dihapus`,
      type: "info",
      actionLabel: "Urungkan",
      onAction: () => dispatch({ type: "RESTORE_TABLES", tables: [t] }),
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { l: "Total meja", v: num(stats.total), c: "var(--accent)", i: <IStore size={15} /> },
          { l: "Kosong", v: num(stats.free), c: "var(--pandan)", i: <ICheckCircle size={15} /> },
          { l: "Terisi", v: num(stats.busy), c: "var(--chili)", i: <IUser size={15} /> },
          { l: "Kursi tersedia", v: num(stats.freeSeats), c: "var(--violet)", i: <IUser size={15} /> },
        ].map((x, i) => (
          <div key={x.l} className="card p-4 rise" style={{ animationDelay: `${i * 40}ms` }}>
            <span className="w-8 h-8 rounded-lg grid place-items-center" style={{ color: x.c, background: `color-mix(in srgb, ${x.c} 14%, transparent)` }}>{x.i}</span>
            <p className="text-[10px] font-bold uppercase tracking-wider text-faint mt-2.5">{x.l}</p>
            <p className="font-display font-bold text-lg mt-0.5 tabular-nums" style={{ color: x.c }}>{x.v}</p>
          </div>
        ))}
      </div>

      <div className="card p-5">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <p className="text-sm font-bold flex items-center gap-1.5"><IStore size={16} className="text-accent" /> Denah meja</p>
          <Badge color="var(--pandan)">live</Badge>
          <span className="text-[11px] text-faint">Terisi otomatis saat pembayaran dine-in selesai.</span>
          {isAdmin && (
            <Button size="sm" className="ml-auto" onClick={() => setForm({ open: true, edit: null })}>
              <IPlus size={14} /> Tambah meja
            </Button>
          )}
        </div>
        <TableGrid tables={state.tables} />
      </div>

      <div className="card p-5">
        <p className="text-sm font-bold mb-3 flex items-center gap-1.5"><IUser size={16} className="text-chili" /> Meja sedang terisi ({occupied.length})</p>
        {occupied.length === 0 ? (
          <p className="text-[11.5px] text-faint py-3 text-center">Semua meja kosong. Meja akan muncul di sini setelah pembayaran dine-in.</p>
        ) : (
          <ul className="space-y-2">
            {occupied.map((t) => (
              <li key={t.id} className="rounded-xl border border-line bg-surface p-3 flex flex-wrap items-center gap-3">
                <span className="w-9 h-9 rounded-lg grid place-items-center text-[11px] font-bold shrink-0" style={{ color: "var(--chili)", background: "color-mix(in srgb, var(--chili) 14%, transparent)" }}>{t.label}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-bold truncate">{t.customerName ?? "Tamu"}</span>
                  <span className="block text-[10px] text-faint">{t.area} · {t.seats} kursi{t.occupiedAt ? ` · sejak ${timeID(t.occupiedAt)}` : ""}</span>
                </span>
                <Button size="sm" variant="soft" onClick={() => freeTable(t)}>
                  <ICheckCircle size={13} /> Kosongkan
                </Button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-[11px] text-faint mt-3 flex gap-1.5"><IInfo size={12} className="shrink-0 mt-0.5" /> Kosongkan meja saat tamu selesai / pulang. Refund transaksi dine-in juga otomatis mengosongkan mejanya.</p>
      </div>

      {isAdmin && (
        <div className="card p-5">
          <p className="text-sm font-bold mb-3 flex items-center gap-1.5"><IShield size={16} className="text-accent" /> Kelola denah meja</p>
          <ul className="space-y-2">
            {state.tables.map((t) => (
              <li key={t.id} className="rounded-xl border border-line bg-surface p-3 flex flex-wrap items-center gap-3">
                <span className="w-9 h-9 rounded-lg grid place-items-center text-[11px] font-bold shrink-0" style={{ color: t.status === "terisi" ? "var(--chili)" : "var(--pandan)", background: `color-mix(in srgb, ${t.status === "terisi" ? "var(--chili)" : "var(--pandan)"} 14%, transparent)` }}>{t.label}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-bold truncate">{t.label} · {t.area}</span>
                  <span className="block text-[10px] text-faint">{t.seats} kursi · {t.status === "terisi" ? "terisi" : "kosong"}{t.active ? "" : " · nonaktif"}</span>
                </span>
                <label className="flex items-center gap-2 text-[11px] font-bold text-mute">
                  {t.active ? "Aktif" : "Nonaktif"}
                  <Toggle small checked={t.active} label={`Aktifkan ${t.label}`} onChange={(v) => { dispatch({ type: "SET_TABLE_ACTIVE", ids: [t.id], active: v }); sfx.tap(); }} />
                </label>
                <span className="flex gap-1">
                  <IconBtn label="Edit meja" className="!p-1.5" onClick={() => setForm({ open: true, edit: t })}><IPen size={14} /></IconBtn>
                  <IconBtn label="Hapus meja" className="!p-1.5 hover:!text-chili" onClick={() => setDel(t)}><ITrash size={14} /></IconBtn>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <TableFormModal open={form.open} edit={form.edit} onClose={() => setForm({ open: false, edit: null })} />

      <Confirm
        open={!!del}
        onClose={() => setDel(null)}
        onConfirm={() => del && removeTable(del)}
        title={`Hapus meja ${del?.label ?? ""}?`}
        confirmLabel="Ya, Hapus"
        desc="Meja dihapus dari denah. Bisa diurungkan lewat notifikasi."
      />
    </div>
  );
}

function TableFormModal({ open, edit, onClose }: { open: boolean; edit: DiningTable | null; onClose: () => void }) {
  const { state, dispatch } = useStore();
  const { push } = useToast();
  const [label, setLabel] = useState("");
  const [area, setArea] = useState(DEFAULT_AREAS[0]);
  const [seats, setSeats] = useState("2");
  const [err, setErr] = useState("");

  /* Denah terbaru disimpan di ref, bukan jadi dependency form.
     Kalau state.tables ikut jadi dependency, sinkron antar tab (kasir lain
     mengisi meja) akan mereset form yang sedang diisi admin. */
  const tablesRef = useRef(state.tables);
  useEffect(() => {
    tablesRef.current = state.tables;
  }, [state.tables]);

  useEffect(() => {
    if (!open) return;
    if (edit) {
      setLabel(edit.label);
      setArea(edit.area);
      setSeats(String(edit.seats));
    } else {
      setArea(DEFAULT_AREAS[0]);
      setLabel(nextTableLabel(tablesRef.current, DEFAULT_AREAS[0]));
      setSeats("2");
    }
    setErr("");
  }, [open, edit]);

  const areaOptions = useMemo(() => {
    const list = [...DEFAULT_AREAS];
    state.tables.forEach((t) => { if (!list.includes(t.area)) list.push(t.area); });
    if (edit && !list.includes(edit.area)) list.push(edit.area);
    return list.map((a) => ({ v: a, l: a }));
  }, [state.tables, edit]);

  const save = () => {
    const lb = label.trim();
    if (!lb) { setErr("Label meja wajib diisi"); sfx.error(); return; }
    if (state.tables.some((t) => t.id !== edit?.id && t.label.toLowerCase() === lb.toLowerCase())) { setErr("Label meja sudah dipakai"); sfx.error(); return; }
    const n = Math.max(1, Math.min(20, Number(seats) || 2));
    if (edit) {
      dispatch({ type: "UPDATE_TABLE", table: { ...edit, label: lb, area, seats: n } });
      push({ msg: `Meja ${lb} diperbarui`, type: "ok" });
    } else {
      dispatch({ type: "ADD_TABLE", table: makeTable({ label: lb, area, seats: n }) });
      push({ msg: `Meja ${lb} ditambahkan (${area} · ${n} kursi)`, type: "ok" });
    }
    sfx.success();
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={edit ? `Edit meja · ${edit.label}` : "Tambah meja"}
      footer={<div className="flex gap-2 justify-end"><Button variant="ghost" onClick={onClose}>Batal</Button><Button onClick={save}>{edit ? "Simpan" : "Tambah meja"}</Button></div>}>
      <div className="space-y-4">
        <Field label="Label meja *" error={err} hint="Contoh: T07, O05, B04">
          <Input value={label} onChange={(e) => { setLabel(e.target.value); setErr(""); }} placeholder="cth. T07" autoFocus />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Area">
            <Select value={area} onChange={setArea} options={areaOptions} />
          </Field>
          <Field label="Jumlah kursi" hint="1–20">
            <Input type="number" min={1} max={20} inputMode="numeric" value={seats} onChange={(e) => setSeats(e.target.value)} />
          </Field>
        </div>
        {edit && edit.status === "terisi" && (
          <p className="text-[11px] text-faint flex gap-1.5"><IInfo size={12} className="shrink-0 mt-0.5" /> Meja ini sedang terisi. Mengubah label/area/kursi tidak mengosongkannya.</p>
        )}
      </div>
    </Modal>
  );
}

function MemberTab({ canManage, canDelete, isAdmin }: { canManage: boolean; canDelete: boolean; isAdmin: boolean }) {
  const { state, dispatch } = useStore();
  const { push } = useToast();
  const s = state.settings;

  const [q, setQ] = useState("");
  const [tier, setTier] = useState("Semua");
  const [status, setStatus] = useState("Semua");
  const [sort, setSort] = useState("points");
  const [form, setForm] = useState<{ open: boolean; edit: Customer | null }>({ open: false, edit: null });
  const [detail, setDetail] = useState<string | null>(null);
  const [del, setDel] = useState<Customer | null>(null);

  const members = useMemo(() => state.customers.filter((c) => c.member), [state.customers]);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let out = members.filter((c) => {
      if (tier !== "Semua" && tierOf(c.spend ?? 0, s) !== tier) return false;
      if (status !== "Semua" && (status === "Aktif" ? c.memberActive === false : c.memberActive !== false)) return false;
      if (!needle) return true;
      return (
        c.name.toLowerCase().includes(needle) ||
        (c.memberNo ?? "").toLowerCase().includes(needle) ||
        (c.username ?? "").toLowerCase().includes(needle) ||
        c.phone.includes(needle) ||
        (c.email ?? "").toLowerCase().includes(needle)
      );
    });

    switch (sort) {
      case "spend":
        out = [...out].sort((a, b) => (b.spend ?? 0) - (a.spend ?? 0));
        break;
      case "visits":
        out = [...out].sort((a, b) => (b.visits ?? 0) - (a.visits ?? 0));
        break;
      case "new":
        out = [...out].sort((a, b) => (b.joinedAt ?? 0) - (a.joinedAt ?? 0));
        break;
      case "name":
        out = [...out].sort((a, b) => a.name.localeCompare(b.name));
        break;
      default:
        out = [...out].sort((a, b) => (b.points ?? 0) - (a.points ?? 0));
    }

    return out;
  }, [members, q, tier, status, sort, s]);

  const totals = {
    count: members.length,
    active: members.filter((c) => c.memberActive !== false).length,
    points: members.reduce((a, c) => a + (c.points ?? 0), 0),
    spend: members.reduce((a, c) => a + (c.spend ?? 0), 0),
    visits: members.reduce((a, c) => a + (c.visits ?? 0), 0),
  };

  const tiersArr: MemberTier[] = ["Bronze", "Silver", "Gold", "Platinum"];
  const birthdays = members.filter((c) => isBirthday(c));
  const detailMember = detail ? state.customers.find((c) => c.id === detail) ?? null : null;

  const exportCSV = () => {
    const rows: (string | number)[][] = [
      ["No Member", "Username", "Nama", "HP", "Email", "Lahir", "Tier", "Poin", "Kunjungan", "Belanja", "Bergabung", "Status", "PIN", "Didaftarkan oleh"],
    ];
    list.forEach((c) =>
      rows.push([
        c.memberNo ?? "-",
        c.username ?? "-",
        c.name,
        c.phone,
        c.email ?? "",
        c.birthDate ?? "",
        tierOf(c.spend ?? 0, s),
        c.points ?? 0,
        c.visits ?? 0,
        c.spend ?? 0,
        dateShort(c.joinedAt ?? Date.now()),
        c.memberActive === false ? "Nonaktif" : "Aktif",
        c.pinHash ? "Ada" : "Belum",
        c.createdByName ?? "-",
      ])
    );
    download(`nusapos-member-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(rows), "text/csv");
    push({ msg: `${list.length} member diekspor`, type: "ok" });
  };

  const removeMember = (c: Customer) => {
    if (!canDelete) return;
    dispatch({ type: "DELETE_CUSTOMERS", ids: [c.id] });
    sfx.remove();
    push({
      msg: `Member ${c.name} dihapus`,
      type: "info",
      actionLabel: "Urungkan",
      onAction: () => dispatch({ type: "RESTORE_CUSTOMERS", customers: [c] }),
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { l: "Member aktif", v: `${totals.active}/${totals.count}`, c: "var(--pandan)", i: <ICheckCircle size={15} /> },
          { l: "Poin beredar", v: num(totals.points), c: "var(--violet)", i: <IStar size={15} /> },
          { l: "Belanja member", v: rupiah(totals.spend), c: "var(--accent)", i: <IReceipt size={15} /> },
          { l: "Kunjungan", v: num(totals.visits), c: "var(--laut)", i: <ITrendUp size={15} /> },
          { l: "Ultah hari ini", v: `${birthdays.length} orang`, c: "var(--magenta)", i: <ICalendar size={15} /> },
        ].map((x, i) => (
          <div key={x.l} className="card p-4 rise" style={{ animationDelay: `${i * 45}ms` }}>
            <span className="w-8 h-8 rounded-lg grid place-items-center" style={{ color: x.c, background: `color-mix(in srgb, ${x.c} 14%, transparent)` }}>
              {x.i}
            </span>
            <p className="text-[10px] font-bold uppercase tracking-wider text-faint mt-2.5">{x.l}</p>
            <p className="font-display font-bold text-lg mt-0.5 tabular-nums truncate" style={{ color: x.c }}>{x.v}</p>
          </div>
        ))}
      </div>

      <div className="card p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-bold flex items-center gap-1.5">
            <IUserPlus size={16} className="text-accent" /> Data member
          </p>
          <div className="ml-auto flex flex-wrap gap-2">
            {isAdmin && (
              <Button variant="ghost" size="sm" onClick={exportCSV}>
                <IDownload size={14} /> CSV
              </Button>
            )}
            {canManage && (
              <Button size="sm" onClick={() => setForm({ open: true, edit: null })}>
                <IUserPlus size={14} /> Daftarkan member
              </Button>
            )}
          </div>
        </div>

        <SearchField
          value={q}
          onChange={setQ}
          size="lg"
          count={list.length}
          countLabel="member"
          ariaLabel="Cari member"
          placeholder="Cari nama, username, nomor HP, email, atau No. member…"
          onEscape={() => setQ("")}
        />

        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setTier("Semua")} className={`chip ${tier === "Semua" ? "chip-on" : ""}`}>
            Semua tier
          </button>
          {tiersArr.map((t) => (
            <button key={t} onClick={() => { setTier(t); sfx.tap(); }} className={`chip ${tier === t ? "chip-on" : ""}`}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: TIER_COLOR[t] }} /> {t}
              <span className="opacity-60">{members.filter((c) => tierOf(c.spend ?? 0, s) === t).length}</span>
            </button>
          ))}
          <span className="w-px bg-line mx-1 h-6" />
          <Select
            label="Status"
            value={status}
            onChange={setStatus}
            className="w-32"
            options={[
              { v: "Semua", l: "Semua status" },
              { v: "Aktif", l: "Aktif" },
              { v: "Nonaktif", l: "Nonaktif" },
            ]}
          />
          <Select label="Urutkan" value={sort} onChange={setSort} className="w-48" options={SORTS} />
        </div>
      </div>

      {list.length === 0 ? (
        <div className="card">
          <EmptyState
            emoji="🧑‍🤝‍🧑"
            title="Tidak ada member yang cocok"
            desc={members.length === 0 ? "Daftarkan member pertama lewat tombol di atas atau dari kasir." : "Coba kata kunci atau filter lain."}
          >
            {canManage && (
              <Button size="sm" onClick={() => setForm({ open: true, edit: null })}>
                <IUserPlus size={14} /> Daftarkan member
              </Button>
            )}
          </EmptyState>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {list.map((c, i) => {
            const t = tierOf(c.spend ?? 0, s);
            const nt = nextTier(c.spend ?? 0, s);
            const pctM = memberDiscountPct(c, s);
            return (
              <div
                key={c.id}
                className="card p-4 rise flex flex-col"
                style={{
                  animationDelay: `${Math.min(i, 12) * 30}ms`,
                  borderColor: `color-mix(in srgb, ${TIER_COLOR[t]} 30%, transparent)`,
                }}
              >
                <div className="flex items-start gap-3">
                  <span
                    className="w-11 h-11 rounded-xl grid place-items-center text-xs font-bold shrink-0"
                    style={{ color: TIER_COLOR[t], background: `color-mix(in srgb, ${TIER_COLOR[t]} 15%, transparent)` }}
                  >
                    {initials(c.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold truncate">{c.name}</p>
                    <p className="text-[10px] text-faint font-mono truncate">@{c.username ?? c.memberNo}</p>
                  </div>
                  <Badge color={TIER_COLOR[t]}>
                    <IStar size={9} /> {t}
                  </Badge>
                </div>

                <div className="flex items-baseline gap-1.5 mt-3">
                  <span className="font-display font-bold text-2xl" style={{ color: TIER_COLOR[t] }}>
                    {num(c.points ?? 0)}
                  </span>
                  <span className="text-[10px] text-faint">poin</span>
                  {pctM > 0 && <span className="ml-auto text-[11px] font-bold text-pandan">−{pctM}%</span>}
                </div>

                <div className="h-1.5 rounded-full bg-surface2 mt-2 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${tierProgress(c.spend ?? 0, s)}%`, background: TIER_COLOR[t] }} />
                </div>
                <p className="text-[10px] text-faint mt-1">
                  {nt ? `${rupiah(nt.need)} belanja lagi ke ${nt.tier}` : "Tier tertinggi"}
                </p>

                <div className="grid grid-cols-2 gap-2 mt-3 text-[10.5px]">
                  <div className="rounded-lg border border-line bg-surface p-2">
                    <p className="text-faint">Kunjungan</p>
                    <p className="font-bold">{num(c.visits ?? 0)}</p>
                  </div>
                  <div className="rounded-lg border border-line bg-surface p-2">
                    <p className="text-faint">Belanja</p>
                    <p className="font-bold truncate">{rupiah(c.spend ?? 0)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1 mt-3 pt-2.5 border-t border-line">
                  {c.memberActive === false ? <Badge color="var(--chili)">Nonaktif</Badge> : <Badge color="var(--pandan)">Aktif</Badge>}
                  {!c.pinHash && <Badge color="var(--amber)">PIN belum dibuat</Badge>}
                  {isBirthday(c) && <Badge color="var(--magenta)">🎂</Badge>}
                  <span className="ml-auto flex gap-1">
                    <IconBtn label="Detail" className="!p-1.5" onClick={() => { setDetail(c.id); sfx.tap(); }}>
                      <IInfo size={14} />
                    </IconBtn>
                    {canManage && (
                      <IconBtn label="Edit / ganti username & PIN" className="!p-1.5" onClick={() => setForm({ open: true, edit: c })}>
                        <IPen size={14} />
                      </IconBtn>
                    )}
                    {canDelete && (
                      <IconBtn label="Hapus" className="!p-1.5 hover:!text-chili" onClick={() => setDel(c)}>
                        <ITrash size={14} />
                      </IconBtn>
                    )}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <MemberForm open={form.open} edit={form.edit} onClose={() => setForm({ open: false, edit: null })} />
      <MemberDetail id={detailMember} onClose={() => setDetail(null)} onEdit={(c) => { setDetail(null); setForm({ open: true, edit: c }); }} />

      <Confirm
        open={!!del}
        onClose={() => setDel(null)}
        onConfirm={() => del && removeMember(del)}
        title={`Hapus member ${del?.name ?? ""}?`}
        confirmLabel="Ya, Hapus"
        desc={`Kartu ${del?.memberNo ?? ""} beserta ${del?.points ?? 0} poin akan dihapus. Riwayat transaksi tetap tersimpan.`}
      />
    </div>
  );
}

function ProductCatalog() {
  const { state } = useStore();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("Semua");
  const [promoOnly, setPromoOnly] = useState(false);

  const allActive = useMemo(() => state.products.filter((p) => p.active), [state.products]);

  const products = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return allActive.filter((p) => {
      if (cat !== "Semua" && p.category !== cat) return false;
      if (promoOnly && !hasDiscount(p)) return false;
      if (!needle) return true;
      return (
        p.name.toLowerCase().includes(needle) ||
        p.sku.toLowerCase().includes(needle) ||
        p.category.toLowerCase().includes(needle) ||
        p.desc.toLowerCase().includes(needle)
      );
    });
  }, [allActive, q, cat, promoOnly]);

  const promoTodayCount = allActive.filter((p) => isAvailableToday(p) && hasDiscount(p)).length;
  const outTodayCount = allActive.filter((p) => isAvailableToday(p) && stockOf(p, state.products) <= 0).length;
  const bundleCount = allActive.filter((p) => p.kind === "bundle").length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { l: "Produk aktif", v: num(allActive.length), c: "var(--accent)", i: <IBox size={15} /> },
          { l: "Promo hari ini", v: num(promoTodayCount), c: "var(--amber)", i: <IPercent size={15} /> },
          { l: "Habis hari ini", v: num(outTodayCount), c: "var(--chili)", i: <ITrash size={15} /> },
          { l: "Paket bundling", v: num(bundleCount), c: "var(--violet)", i: <ITag size={15} /> },
        ].map((x, i) => (
          <div key={x.l} className="card p-4 rise" style={{ animationDelay: `${i * 40}ms` }}>
            <span className="w-8 h-8 rounded-lg grid place-items-center" style={{ color: x.c, background: `color-mix(in srgb, ${x.c} 14%, transparent)` }}>
              {x.i}
            </span>
            <p className="text-[10px] font-bold uppercase tracking-wider text-faint mt-2.5">{x.l}</p>
            <p className="font-display font-bold text-lg mt-0.5 tabular-nums" style={{ color: x.c }}>{x.v}</p>
          </div>
        ))}
      </div>

      <div className="card p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-bold flex items-center gap-1.5">
            <IBox size={16} className="text-accent" /> Produk tersedia
          </p>
          <Badge color="var(--pandan)">live</Badge>
          <span className="text-[11px] text-faint ml-auto">
            Tersinkron otomatis dengan seluruh data produk sistem — produk yang dihapus/dinonaktifkan admin langsung tidak tampil di sini.
          </span>
        </div>

        <SearchField
          value={q}
          onChange={setQ}
          size="lg"
          count={products.length}
          countLabel="produk"
          ariaLabel="Cari produk"
          placeholder="Cari nama, SKU, kategori, atau deskripsi produk…"
          onEscape={() => setQ("")}
        />

        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setCat("Semua")} className={`chip ${cat === "Semua" ? "chip-on" : ""}`}>
            Semua
          </button>
          {CATEGORIES.map((c) => (
            <button key={c} onClick={() => setCat(c)} className={`chip ${cat === c ? "chip-on" : ""}`}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: CATEGORY_COLORS[c] }} /> {c}
            </button>
          ))}
          <span className="w-px bg-line mx-1 h-6" />
          <button onClick={() => setPromoOnly((v) => !v)} className={`chip ${promoOnly ? "chip-on" : ""}`}>
            <IPercent size={12} /> Promo hari ini
          </button>
        </div>
      </div>

      {products.length === 0 ? (
        <div className="card">
          <EmptyState emoji="📦" title="Tidak ada produk" desc="Semua produk nonaktif, dihapus, atau tidak cocok dengan filter." />
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {products.map((p, i) => {
            const eff = effectivePrice(p);
            const st = stockOf(p, state.products);
            const promo = todayPromo(p);
            const avail = isAvailableToday(p);
            return (
              <div key={p.id} className="card overflow-hidden flex flex-col rise" style={{ animationDelay: `${Math.min(i, 14) * 26}ms` }}>
                <div className="relative" style={{ aspectRatio: "4 / 3" }}>
                  <ProductThumb name={p.name} photo={p.photo} category={p.category} fill rounded={0} />
                  <span className="absolute top-1.5 left-1.5 flex flex-col items-start gap-1 pointer-events-none">
                    {promo && (
                      <Badge color="var(--amber)">
                        <IPercent size={9} /> {discountLabel(activeDiscount(p))}
                      </Badge>
                    )}
                    {!promo && hasDiscount(p) && <Badge color="var(--amber)">{discountLabel(p.discount)}</Badge>}
                  </span>
                  <span className="absolute top-1.5 right-1.5 flex flex-col items-end gap-1 pointer-events-none">
                    {p.kind === "bundle" && (
                      <Badge color="var(--violet)">
                        <ITag size={9} /> Paket
                      </Badge>
                    )}
                    {isLimited(p) && <Badge color="var(--magenta)">Limited</Badge>}
                  </span>
                  {!avail && (
                    <span
                      className="absolute inset-0 grid place-items-center pointer-events-none"
                      style={{ background: "color-mix(in srgb, var(--bg) 66%, transparent)" }}
                    >
                      <span className="text-[9.5px] font-bold px-2 py-1 rounded-full bg-overlay border border-line2">Libur hari ini</span>
                    </span>
                  )}
                </div>
                <div className="p-2.5 flex flex-col flex-1">
                  <p className="text-[12px] font-bold leading-tight line-clamp-2">{p.name}</p>
                  <p className="text-[9px] text-faint font-mono mt-0.5">{p.sku}</p>
                  <div className="flex items-baseline gap-1 mt-1.5">
                    <span className="font-display font-bold text-accent text-[13px]">{rupiah(eff)}</span>
                    {hasDiscount(p) && <span className="text-[9px] text-faint line-through">{rupiah(p.price)}</span>}
                  </div>
                  <div className="flex items-center justify-between mt-auto pt-1.5">
                    <span className={`text-[9.5px] font-bold ${st <= 0 ? "text-chili" : "text-mute"}`}>
                      {st <= 0 ? "Habis" : p.kind === "bundle" ? `${num(st)} porsi` : `Stok ${num(st)}`}
                    </span>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: CATEGORY_COLORS[p.category] }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RewardCatalog({ isAdmin }: { isAdmin: boolean }) {
  const { state, dispatch } = useStore();
  const { push } = useToast();
  const s = state.settings;
  const [rewardForm, setRewardForm] = useState<{ open: boolean; edit: PointReward | null }>({ open: false, edit: null });
  const [delReward, setDelReward] = useState<PointReward | null>(null);

  const removeReward = (r: PointReward) => {
    dispatch({ type: "DELETE_REWARDS", ids: [r.id] });
    sfx.remove();
    push({
      msg: `Hadiah ${r.name} dihapus`,
      type: "info",
      actionLabel: "Urungkan",
      onAction: () => dispatch({ type: "ADD_REWARD", reward: r }),
    });
  };

  return (
    <div className="space-y-4">
      <div className="card p-4 flex flex-wrap items-center gap-2">
        <p className="text-sm font-bold flex items-center gap-1.5">
          <IGift size={16} className="text-violet" /> Katalog hadiah poin
        </p>
        <span className="text-[11px] text-faint">
          1 poin = belanja {rupiah(Math.max(100, s.memberPointRate))} · hadiah dikelola admin
        </span>
        {isAdmin && (
          <Button size="sm" className="ml-auto" onClick={() => setRewardForm({ open: true, edit: null })}>
            <IPlus size={14} /> Tambah hadiah
          </Button>
        )}
      </div>

      {state.rewards.length === 0 ? (
        <div className="card">
          <EmptyState
            emoji="🎁"
            title="Belum ada hadiah"
            desc={isAdmin ? "Tambahkan hadiah pertama supaya member bisa menukar poin." : "Admin belum menambahkan hadiah."}
          />
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {state.rewards.map((r, i) => (
            <div key={r.id} className="card p-4 flex flex-col rise" style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}>
              <div className="flex items-start gap-3">
                <span className="text-3xl">{r.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold leading-tight">{r.name}</p>
                  <p className="text-[11px] text-mute mt-1 leading-snug">{r.desc}</p>
                </div>
              </div>
              <div className="flex items-center justify-between mt-3">
                <span className="font-display font-bold text-violet">{num(r.cost)} poin</span>
                <Badge color={r.active ? "var(--pandan)" : "var(--chili)"}>{r.active ? "Aktif" : "Nonaktif"}</Badge>
              </div>
              {isAdmin && (
                <div className="flex items-center gap-1 mt-3 pt-2.5 border-t border-line">
                  <Toggle
                    small
                    checked={r.active}
                    label={`Aktifkan ${r.name}`}
                    onChange={(v) => {
                      dispatch({ type: "SET_REWARD_ACTIVE", ids: [r.id], active: v });
                      sfx.tap();
                    }}
                  />
                  <span className="ml-auto flex gap-1">
                    <IconBtn label="Edit" className="!p-1.5" onClick={() => setRewardForm({ open: true, edit: r })}>
                      <IPen size={14} />
                    </IconBtn>
                    <IconBtn label="Hapus" className="!p-1.5 hover:!text-chili" onClick={() => setDelReward(r)}>
                      <ITrash size={14} />
                    </IconBtn>
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <RewardFormModal open={rewardForm.open} edit={rewardForm.edit} onClose={() => setRewardForm({ open: false, edit: null })} />

      <Confirm
        open={!!delReward}
        onClose={() => setDelReward(null)}
        onConfirm={() => delReward && removeReward(delReward)}
        title={`Hapus hadiah ${delReward?.name ?? ""}?`}
        confirmLabel="Ya, Hapus"
        desc="Hadiah akan hilang dari katalog poin member. Bisa diurungkan lewat notifikasi."
      />
    </div>
  );
}

function RedemptionHistory() {
  const { state } = useStore();

  return (
    <div className="card overflow-hidden">
      {state.redemptions.length === 0 ? (
        <EmptyState emoji="🎟️" title="Belum ada penukaran" desc="Penukaran poin member akan tercatat di sini." />
      ) : (
        <div className="overflow-auto max-h-[64vh]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface2 text-left text-[11px] uppercase tracking-wider text-faint">
              <tr>
                <th className="px-3 py-3">Waktu</th>
                <th className="px-3 py-3">Member</th>
                <th className="px-3 py-3">Hadiah</th>
                <th className="px-3 py-3 text-right">Poin</th>
                <th className="px-3 py-3">Oleh</th>
                <th className="px-3 py-3">Via</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {state.redemptions.map((r) => (
                <tr key={r.id} className="hover:bg-surface2/60">
                  <td className="px-3 py-2.5 text-[11px] text-mute">{dateShort(r.ts)} {timeID(r.ts)}</td>
                  <td className="px-3 py-2.5">
                    <p className="text-xs font-bold">{r.customerName}</p>
                    <p className="text-[10px] text-faint font-mono">{r.memberNo}</p>
                  </td>
                  <td className="px-3 py-2.5 text-xs">{r.rewardEmoji} {r.rewardName}</td>
                  <td className="px-3 py-2.5 text-right font-mono font-bold text-violet">−{num(r.cost)}</td>
                  <td className="px-3 py-2.5 text-xs">{r.by}</td>
                  <td className="px-3 py-2.5">
                    <Badge color={r.channel === "portal" ? "var(--violet)" : "var(--laut)"}>{r.channel}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RewardFormModal({ open, edit, onClose }: { open: boolean; edit: PointReward | null; onClose: () => void }) {
  const { dispatch } = useStore();
  const { push } = useToast();
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🎁");
  const [desc, setDesc] = useState("");
  const [cost, setCost] = useState("200");
  const [active, setActive] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(edit?.name ?? "");
    setEmoji(edit?.emoji ?? "🎁");
    setDesc(edit?.desc ?? "");
    setCost(String(edit?.cost ?? 200));
    setActive(edit?.active !== false);
    setErr("");
  }, [open, edit]);

  const EMO = ["🎁", "🧋", "☕", "🥐", "🍵", "🏷️", "💳", "🍩", "🧁", "🏺", "👜", "🎟️"];

  const save = () => {
    if (name.trim().length < 3) {
      setErr("Nama hadiah minimal 3 karakter");
      sfx.error();
      return;
    }
    const c = Number(cost);
    if (!Number.isFinite(c) || c < 1) {
      setErr("Biaya poin harus lebih dari 0");
      sfx.error();
      return;
    }

    const reward: PointReward = {
      id: edit?.id ?? uid(),
      name: name.trim(),
      emoji,
      desc: desc.trim(),
      cost: Math.round(c),
      active,
      createdAt: edit?.createdAt ?? Date.now(),
    };

    dispatch({ type: edit ? "UPDATE_REWARD" : "ADD_REWARD", reward });
    sfx.success();
    push({
      msg: edit ? `Hadiah ${reward.name} diperbarui` : `Hadiah baru ${reward.name} · ${reward.cost} poin`,
      type: "ok",
    });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={edit ? `Edit hadiah · ${edit.name}` : "Tambah hadiah poin"}
      footer={
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={save}>{edit ? "Simpan" : "Tambah hadiah"}</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Nama hadiah *" error={err && err.includes("Nama") ? err : ""}>
          <Input value={name} onChange={(e) => { setName(e.target.value); setErr(""); }} placeholder="cth. Gratis Kopi Susu" autoFocus />
        </Field>

        <Field label="Ikon">
          <div className="flex flex-wrap gap-1.5">
            {EMO.map((em) => (
              <button
                key={em}
                onClick={() => { setEmoji(em); sfx.tap(); }}
                className={`w-9 h-9 rounded-lg grid place-items-center text-lg border transition-all ${
                  emoji === em ? "border-accent bg-accent-soft" : "border-line bg-surface"
                }`}
              >
                {em}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Deskripsi">
          <Textarea rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Jelaskan hadiahnya…" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Biaya (poin)" error={err && !err.includes("Nama") ? err : ""}>
            <Input type="number" min={1} inputMode="numeric" value={cost} onChange={(e) => { setCost(e.target.value); setErr(""); }} />
          </Field>
          <div className="flex items-end justify-between rounded-xl border border-line bg-surface px-3 py-2">
            <span className="text-xs font-bold">Aktif</span>
            <Toggle checked={active} onChange={setActive} label="Aktif" />
          </div>
        </div>
      </div>
    </Modal>
  );
}

function MemberDetail({ id, onClose, onEdit }: { id: Customer | null; onClose: () => void; onEdit: (c: Customer) => void }) {
  const { state } = useStore();
  const s = state.settings;
  const c = id;

  const stats = useMemo(() => (c ? memberStats(c, state.transactions) : null), [c, state.transactions]);
  const history = useMemo(
    () => (c ? state.transactions.filter((t) => t.customerId === c.id && !t.isTest).sort((a, b) => b.ts - a.ts).slice(0, 20) : []),
    [c, state.transactions]
  );
  const redeems = c ? state.redemptions.filter((r) => r.customerId === c.id) : [];

  if (!c) {
    return (
      <Drawer open={false} onClose={onClose} title="Member">
        <span />
      </Drawer>
    );
  }

  const t = tierOf(c.spend ?? 0, s);
  const nt = nextTier(c.spend ?? 0, s);

  return (
    <Drawer
      open={!!id}
      onClose={onClose}
      title={<span className="font-mono">{c.memberNo}</span>}
      footer={
        <div className="flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={() => onEdit(c)}>
            <IPen size={15} /> Edit username / PIN
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div
          className="rounded-2xl border p-4"
          style={{
            borderColor: `color-mix(in srgb, ${TIER_COLOR[t]} 40%, transparent)`,
            background: `color-mix(in srgb, ${TIER_COLOR[t]} 8%, transparent)`,
          }}
        >
          <div className="flex items-center gap-3">
            <span
              className="w-14 h-14 rounded-2xl grid place-items-center text-base font-bold shrink-0"
              style={{ color: TIER_COLOR[t], background: `color-mix(in srgb, ${TIER_COLOR[t]} 18%, transparent)` }}
            >
              {initials(c.name)}
            </span>
            <div className="min-w-0">
              <p className="font-display font-bold text-lg leading-tight truncate">{c.name}</p>
              <p className="text-[11px] text-faint font-mono">@{c.username ?? "-"} · gabung {dateShort(c.joinedAt ?? Date.now())}</p>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                <Badge color={TIER_COLOR[t]}>
                  <IStar size={10} /> {t}
                </Badge>
                {c.memberActive === false && <Badge color="var(--chili)">nonaktif</Badge>}
                {isBirthday(c) && <Badge color="var(--magenta)">🎂 hari ini</Badge>}
              </div>
            </div>
          </div>

          <div className="flex items-baseline gap-2 mt-3">
            <span className="font-display font-bold text-3xl" style={{ color: TIER_COLOR[t] }}>
              {num(c.points ?? 0)}
            </span>
            <span className="text-[11px] text-faint">poin</span>
          </div>

          <div className="h-2 rounded-full bg-surface2 mt-2 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${tierProgress(c.spend ?? 0, s)}%`, background: TIER_COLOR[t] }} />
          </div>
          <p className="text-[11px] text-mute mt-1.5">
            {nt ? `${rupiah(nt.need)} belanja lagi ke ${nt.tier}` : "Platinum tercapai"} · total belanja {rupiah(c.spend ?? 0)}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 text-[11px]">
          <div className="rounded-xl border border-line bg-surface p-3">
            <p className="text-faint text-[10px] uppercase font-bold">Username</p>
            <p className="font-mono font-bold mt-0.5 truncate">@{c.username ?? "-"}</p>
          </div>
          <div className="rounded-xl border border-line bg-surface p-3">
            <p className="text-faint text-[10px] uppercase font-bold">HP</p>
            <p className="font-mono font-bold mt-0.5 flex items-center gap-1">
              <IPhone size={11} /> {c.phone}
            </p>
          </div>
          <div className="rounded-xl border border-line bg-surface p-3">
            <p className="text-faint text-[10px] uppercase font-bold">Email</p>
            <p className="font-bold mt-0.5 truncate">{c.email || "—"}</p>
          </div>
          <div className="rounded-xl border border-line bg-surface p-3">
            <p className="text-faint text-[10px] uppercase font-bold">Lahir</p>
            <p className="font-bold mt-0.5">{c.birthDate ? dateShort(new Date(c.birthDate).getTime()) : "—"}</p>
          </div>
          <div className="rounded-xl border border-line bg-surface p-3 col-span-2">
            <p className="text-faint text-[10px] uppercase font-bold">PIN portal</p>
            <p className="font-bold mt-0.5">{c.pinHash ? "Sudah dibuat oleh kasir" : "Belum dibuat"}</p>
          </div>
        </div>

        {c.notes && <p className="text-xs text-mute rounded-xl border border-line bg-surface p-3 leading-relaxed">{c.notes}</p>}

        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { l: "Transaksi", v: num(stats.count) },
              { l: "Belanja", v: rupiah(stats.spend) },
              { l: "Rata-rata", v: rupiah(stats.avg) },
              { l: "Hemat member", v: rupiah(stats.saved) },
            ].map((x) => (
              <div key={x.l} className="rounded-xl border border-line bg-surface p-2.5">
                <p className="text-[9.5px] text-faint font-bold uppercase tracking-wider">{x.l}</p>
                <p className="text-xs font-bold mt-0.5 tabular-nums truncate">{x.v}</p>
              </div>
            ))}
          </div>
        )}

        <div className="rounded-2xl border border-line bg-surface p-3">
          <p className="text-xs font-bold mb-2">Transaksi terakhir ({history.length})</p>
          {history.length === 0 ? (
            <p className="text-[11px] text-faint py-3 text-center">Belum ada transaksi.</p>
          ) : (
            <ul className="divide-y divide-line max-h-56 overflow-y-auto">
              {history.map((tx) => (
                <li key={tx.id} className="py-2 flex items-center gap-2 text-[11px]">
                  <IReceipt size={12} className="text-faint shrink-0" />
                  <span className="font-mono font-bold truncate flex-1">{tx.id}</span>
                  <span className="text-faint">{dateShort(tx.ts)}</span>
                  {(tx.memberPoints ?? 0) > 0 && <Badge color="var(--violet)">+{tx.memberPoints}</Badge>}
                  <span className="font-mono font-bold w-20 text-right">{rupiah(tx.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {redeems.length > 0 && (
          <div className="rounded-2xl border border-line bg-surface p-3">
            <p className="text-xs font-bold mb-2">Penukaran poin ({redeems.length})</p>
            <ul className="divide-y divide-line">
              {redeems.map((r) => (
                <li key={r.id} className="py-2 flex items-center gap-2 text-[11px]">
                  <span className="text-lg">{r.rewardEmoji}</span>
                  <span className="font-bold truncate flex-1">{r.rewardName}</span>
                  <span className="text-faint">{dateShort(r.ts)}</span>
                  <Badge color="var(--violet)">−{num(r.cost)}</Badge>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Drawer>
  );
}