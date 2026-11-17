"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth, useStore } from "@/lib/store";
import { useToast } from "@/components/Toasts";
import { buildSeed } from "@/lib/seed";
import { DEMO_SETTINGS } from "@/lib/demo-data";
import { setSoundEnabled, sfx } from "@/lib/sound";
import type { Accent, LogoShape, Settings, ThemeMode, User } from "@/lib/types";
import { clamp, dateID, download, num, uid } from "@/lib/format";
import {
  ACCENTS, LOGO_LIMITS, THEME_OPTIONS, applyTheme, downloadDataUrl, formatBytes, processLogoFile, resolveTheme,
} from "@/lib/brand";
import type { LogoResult } from "@/lib/brand";
import { PERM_LABELS, ROLE_PERMS, hashPassword, isProtectedUser, roleLabel, verifyPassword } from "@/lib/auth";
import { MemberBenefitsPanel } from "@/components/MemberBenefits";
import { Badge, Button, Confirm, Field, IconBtn, Input, Modal, PageSkel, Select, Textarea, Toggle } from "@/components/ui";
import { BrandLockup } from "@/components/Brand";
import {
  IAlert, ICheckCircle, IDatabase, IDownload, IHeart, IImage, IInfo, IKey, IMonitor, IMoon,
  IPalette, IRefresh, IShield, IStar, ISun, ITrash, IUpload, IUserPlus, IUsers, IVolume, IVolumeX,
} from "@/components/icons";

const THEME_ICON: Record<ThemeMode, typeof ISun> = { dark: IMoon, light: ISun, system: IMonitor };

export default function Pengaturan() {
  const { state, dispatch } = useStore();
  const { user, role, isAdmin, can } = useAuth();
  const { push } = useToast();
  const sp = useSearchParams();

  const [resetOpen, setResetOpen] = useState(false);
  const [wipeOpen, setWipeOpen] = useState(false);
  const [wipeText, setWipeText] = useState("");
  const [logoResetOpen, setLogoResetOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [logoInfo, setLogoInfo] = useState<LogoResult | null>(null);
  const [userForm, setUserForm] = useState<{ open: boolean; edit: User | null }>({ open: false, edit: null });
  const [delUser, setDelUser] = useState<User | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const memberRef = useRef<HTMLDivElement>(null);

  const sizeKB = useMemo(() => {
    if (!state.hydrated) return 0;
    try { return Math.round(JSON.stringify(state).length / 1024); } catch { return 0; }
  }, [state]);

  useEffect(() => {
    if (state.hydrated && sp.get("focus") === "member") {
      memberRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [state.hydrated, sp]);

  if (!state.hydrated) return <PageSkel />;

  const s = state.settings;
  const set = (patch: Partial<Settings>) => dispatch({ type: "UPDATE_SETTINGS", patch });
  const resolved = resolveTheme(s.theme);
  const memberCount = state.customers.filter((c) => c.member).length;

  const pickTheme = (mode: ThemeMode) => {
    set({ theme: mode });
    applyTheme(mode);
    sfx.tap();
    push({ msg: `Tema: ${THEME_OPTIONS.find((t) => t.v === mode)?.label}`, type: "ok", dur: 2000 });
  };

  const pickAccent = (v: Accent) => {
    set({ accent: v });
    document.documentElement.dataset.accent = v;
    sfx.tap();
  };

  const handleLogo = async (file?: File | null) => {
    if (!file) return;
    setBusy(true);
    try {
      const res = await processLogoFile(file);
      set({ logo: res.dataUrl });
      setLogoInfo(res);
      sfx.success();
      push({ msg: `Logo terpasang • ${res.width}×${res.height} • ${formatBytes(res.bytes)}`, type: res.lowRes ? "info" : "ok" });
    } catch (e) {
      sfx.error();
      push({ msg: e instanceof Error ? e.message : "Gagal memproses gambar", type: "err" });
    } finally {
      setBusy(false);
      if (logoRef.current) logoRef.current.value = "";
    }
  };

  const exportJSON = () => {
    download(`nusapos-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ v: 1, state: { ...state, hydrated: false } }, null, 2), "application/json");
    push({ msg: "Backup JSON diunduh", type: "ok" });
  };

  const importJSON = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const p = JSON.parse(String(reader.result));
        if (p?.v === 1 && p.state) {
          const merged: Settings = { ...DEMO_SETTINGS, ...(p.state.settings ?? {}) };
          dispatch({ type: "HYDRATE", state: { ...state, ...p.state, settings: merged, users: state.users, session: state.session, memberSession: state.memberSession, hydrated: true } });
          applyTheme(merged.theme);
          sfx.success();
          push({ msg: "Backup dipulihkan · akun terdaftar tetap dipakai", type: "ok" });
        } else throw new Error("format");
      } catch {
        sfx.error();
        push({ msg: "File backup tidak valid", type: "err" });
      }
    };
    reader.readAsText(file);
  };

  const reseed = () => {
    const fresh = buildSeed(Math.floor(Math.random() * 1e9));
    /* SeedData = AppState tanpa "hydrated".
       DemoData   = AppState tanpa "hydrated" | "users" | "session" | "memberSession".
       Jadi cukup lepas users, session, memberSession — "hydrated" memang tidak ada di SeedData. */
    const { users: _u, session: _sess, memberSession: _mem, ...demo } = fresh;
    dispatch({ type: "RESET", data: { ...demo, settings: s } });
    sfx.success();
    push({ msg: "Data demo diacak ulang ✨ akun & benefit tetap aman", type: "ok" });
  };

  const wipeDemo = () => {
    const snapshot = state;
    dispatch({ type: "WIPE_DEMO" });
    setWipeText("");
    sfx.remove();
    push({
      msg: `Semua data demo dihapus · ${snapshot.users.length} akun tetap tersimpan`,
      type: "info", dur: 9000, actionLabel: "Urungkan",
      onAction: () => { dispatch({ type: "HYDRATE", state: { ...snapshot, hydrated: true } }); sfx.success(); },
    });
  };

  const removeUser = (u: User) => {
    if (isProtectedUser(u)) {
      sfx.error();
      push({ msg: "Akun administrator dilindungi — tidak bisa dihapus", type: "err" });
      return;
    }
    dispatch({ type: "DELETE_USERS", ids: [u.id] });
    sfx.remove();
    push({ msg: `Akun ${u.name} dihapus`, type: "info", actionLabel: "Urungkan", onAction: () => dispatch({ type: "ADD_USER", user: u }) });
  };

  const numField = (label: string, hint: string, value: number, onChange: (n: number) => void, min: number, max: number, step = 1) => (
    <Field label={label} hint={hint}>
      <Input type="number" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(clamp(Number(e.target.value) || 0, min, max))} />
    </Field>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rise">
        <div>
          <h1 className="font-display font-bold text-2xl">Pengaturan</h1>
          <p className="text-sm text-mute mt-0.5">
            {isAdmin ? "Tema, brand, operasional, benefit member, pengguna, dan data." : "Preferensi tampilan, keamanan akun, dan ringkasan benefit member."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge color={role === "admin" ? "var(--accent)" : "var(--amber)"}>
            {role === "admin" ? <IShield size={11} /> : <IUsers size={11} />} {roleLabel(role)}
          </Badge>
          <Badge color="var(--pandan)"><ICheckCircle size={12} /> Tersimpan otomatis</Badge>
        </div>
      </div>

      {/* TEMA & AKSEN */}
      <div className="card p-5 space-y-5 rise" style={{ animationDelay: "40ms" }}>
        <div className="flex items-center gap-2">
          <IPalette size={18} className="text-accent" />
          <h2 className="font-display font-bold">Tema & Warna</h2>
          <span className="ml-auto text-[11px] text-faint">Aktif: <b className="text-ink">{resolved === "dark" ? "Gelap" : "Terang"}</b>{s.theme === "system" && " (sistem)"}</span>
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          {THEME_OPTIONS.map((t) => {
            const Icon = THEME_ICON[t.v];
            const active = s.theme === t.v;
            return (
              <button key={t.v} onClick={() => pickTheme(t.v)}
                className={`rounded-2xl border p-4 text-left transition-all ${active ? "border-accent ring-2 ring-accent-soft" : "border-line hover:border-line2"}`}>
                <div className="flex items-center gap-2">
                  <span className="w-9 h-9 rounded-xl grid place-items-center"
                    style={{ color: active ? "var(--accent-ink)" : "var(--accent)", background: active ? "linear-gradient(135deg, var(--accent), var(--accent2))" : "var(--accent-soft)" }}>
                    <Icon size={17} />
                  </span>
                  <p className="text-sm font-bold">{t.label}</p>
                  {active && <ICheckCircle size={16} className="ml-auto text-accent" />}
                </div>
                <p className="text-[11px] text-faint mt-2 leading-snug">{t.desc}</p>
                <div className="flex gap-1 mt-3" data-theme={t.v === "system" ? resolved : t.v} data-accent={s.accent}>
                  {["--bg", "--surface", "--surface2", "--accent", "--amber", "--chili", "--laut", "--violet"].map((v) => (
                    <span key={v} className="h-4 flex-1 rounded-[4px] border border-line" style={{ background: `var(${v})` }} />
                  ))}
                </div>
              </button>
            );
          })}
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <p className="text-xs font-bold text-mute">Warna Aksen</p>
            <Badge color="var(--violet)"><IStar size={10} /> Tosca + keluarga ungu</Badge>
            <span className="text-[10.5px] text-faint ml-auto">Klik untuk menerapkan langsung ke seluruh aplikasi</span>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {ACCENTS.map((a) => {
              const pair = resolved === "light" ? a.light : a.dark;
              const active = s.accent === a.v;
              return (
                <button key={a.v} onClick={() => pickAccent(a.v)}
                  className={`rounded-2xl border p-3.5 text-left transition-all relative overflow-hidden ${active ? "ring-2" : "hover:border-line2"}`}
                  style={{
                    borderColor: active ? pair[0] : "var(--line)",
                    background: active ? `color-mix(in srgb, ${pair[0]} 9%, var(--surface))` : "var(--surface)",
                    boxShadow: active ? `0 12px 30px -20px ${pair[0]}` : "none",
                  }}>
                  <div className="flex items-center gap-2.5">
                    <span className="w-10 h-10 rounded-xl shrink-0" style={{ background: `linear-gradient(135deg, ${pair[0]}, ${pair[1]})` }} />
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate">{a.name}</p>
                      <p className="text-[9.5px] text-faint uppercase tracking-wider">{a.family}</p>
                    </div>
                    {active && <ICheckCircle size={16} className="ml-auto shrink-0" style={{ color: pair[0] }} />}
                  </div>
                  <p className="text-[10.5px] text-mute mt-2 leading-snug">{a.desc}</p>
                  <div className="flex gap-1 mt-2.5">
                    {[pair[0], pair[1], "var(--violet)", "var(--laut)", "var(--amber)"].map((c, i) => (
                      <span key={i} className="h-2 flex-1 rounded-full" style={{ background: c }} />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-3">
          <div className="flex items-center gap-3">
            {s.sound ? <IVolume size={17} className="text-accent" /> : <IVolumeX size={17} className="text-faint" />}
            <div>
              <p className="text-sm font-bold">Efek Suara</p>
              <p className="text-[11px] text-faint">Bunyi saat tambah item, bayar, dan aksi lain</p>
            </div>
          </div>
          <Toggle checked={s.sound} label="Suara" onChange={(v) => { set({ sound: v }); setSoundEnabled(v); if (v) sfx.tap(); }} />
        </div>
      </div>

      {/* AKUN SAYA */}
      {user && (
        <div className="card p-5 space-y-4 rise" style={{ animationDelay: "70ms" }}>
          <div className="flex items-center gap-2">
            <IShield size={18} className="text-accent" />
            <h2 className="font-display font-bold">Akun Saya & Hak Akses</h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-line bg-surface p-3">
              <p className="text-[10px] text-faint font-bold uppercase tracking-wider">Nama</p>
              <p className="text-sm font-bold mt-1 truncate">{user.name}</p>
            </div>
            <div className="rounded-xl border border-line bg-surface p-3">
              <p className="text-[10px] text-faint font-bold uppercase tracking-wider">Username</p>
              <p className="text-sm font-mono font-bold mt-1">@{user.username}</p>
            </div>
            <div className="rounded-xl border border-line bg-surface p-3">
              <p className="text-[10px] text-faint font-bold uppercase tracking-wider">Peran & shift</p>
              <p className="text-sm font-bold mt-1">{roleLabel(user.role)}</p>
              <p className="text-[10px] text-faint">{isAdmin ? "Tanpa shift · kasir admin = mode uji" : "Wajib shift saat berjaga"}</p>
            </div>
          </div>

          <div className="rounded-xl border p-3 text-[11.5px] flex gap-2"
            style={{ borderColor: "color-mix(in srgb, var(--accent) 30%, transparent)", background: "var(--accent-soft)" }}>
            <IShield size={14} className="text-accent shrink-0 mt-0.5" />
            <span className="text-mute">
              {isAdmin
                ? "Administrator mewarisi seluruh fitur kasir dan menambah kendali penuh: jadwal shift, analitik, refund, katalog, benefit & katalog hadiah member, pengguna, dan data. Transaksi di kasir admin bersifat uji — tidak tercatat."
                : "Kasir berfokus pada operasional: jualan, mendaftarkan & melayani member, shift sendiri, serta struk miliknya. Benefit member bersifat baca-saja."}
            </span>
          </div>

          <div className="rounded-xl border border-line bg-surface p-4">
            <p className="text-xs font-bold mb-2">Rincian hak akses {roleLabel(user.role)}</p>
            <div className="flex flex-wrap gap-1.5">
              {PERM_LABELS.map((p) => {
                const ok = ROLE_PERMS[user.role].includes(p.perm);
                return (
                  <span key={p.perm} className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold"
                    style={{
                      color: ok ? "var(--pandan)" : "var(--faint)",
                      borderColor: ok ? "color-mix(in srgb, var(--pandan) 30%, transparent)" : "var(--line)",
                      background: ok ? "color-mix(in srgb, var(--pandan) 8%, transparent)" : "transparent",
                    }}>
                    {ok ? <ICheckCircle size={11} /> : <IAlert size={11} />} {p.label}
                  </span>
                );
              })}
            </div>
          </div>
          <p className="text-[11px] text-faint flex gap-1.5">
            <IKey size={13} className="shrink-0 mt-0.5" /> Ganti password lewat menu profil di kanan atas atau tombol di sidebar.
          </p>
        </div>
      )}

      {/* PROGRAM MEMBER */}
      <div ref={memberRef} style={{ scrollMarginTop: 90 }} className="card p-5 space-y-4 rise">
        <div className="flex flex-wrap items-center gap-2">
          <IHeart size={18} style={{ color: "var(--violet)" }} />
          <h2 className="font-display font-bold">Program Member</h2>
          <Badge color="var(--violet)">{memberCount} member</Badge>
          <Badge color={isAdmin ? "var(--accent)" : "var(--amber)"}>
            {isAdmin ? <><IShield size={10} /> bisa diatur</> : <><IInfo size={10} /> baca-saja</>}
          </Badge>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setPreviewOpen(true)}><IInfo size={14} /> Pratinjau benefit</Button>
            {isAdmin && <Toggle checked={s.memberEnabled} label="Program member" onChange={(v) => { set({ memberEnabled: v }); sfx.tap(); }} />}
          </div>
        </div>

        {isAdmin ? (
          <>
            <p className="text-[11.5px] text-mute">
              Tier naik otomatis dari <b className="text-ink">akumulasi belanja</b>; poin adalah <b className="text-ink">mata hadiah</b> yang bisa ditukar di katalog. Semua angka langsung dipakai kasir, portal member, dan halaman pelanggan.
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {numField("Rp per 1 poin", "1000 = 1 poin / Rp 1.000", s.memberPointRate, (n) => set({ memberPointRate: Math.max(100, n) }), 100, 1000000, 100)}
              {numField("Potongan dasar (%)", "Semua member aktif", s.memberDiscountPct, (n) => set({ memberDiscountPct: n }), 0, 25)}
              {numField("Bonus ulang tahun (%)", "Tambahan di hari H", s.memberBirthdayPct, (n) => set({ memberBirthdayPct: n }), 0, 25)}
              {numField("Poin sambutan", "Saat pertama mendaftar", s.memberWelcomePoints, (n) => set({ memberWelcomePoints: n }), 0, 100000, 10)}
            </div>

            <div className="rounded-2xl border border-line bg-surface p-4 space-y-3">
              <p className="text-xs font-bold flex items-center gap-1.5"><IStar size={13} className="text-amber" /> Ambang tier — total belanja kumulatif (Rp)</p>
              <div className="grid sm:grid-cols-3 gap-3">
                {numField("Belanja → Silver", "Contoh: 1.500.000", s.memberTierSilver, (n) => set({ memberTierSilver: n, memberTierGold: Math.max(n + 1, s.memberTierGold), memberTierPlatinum: Math.max(n + 2, s.memberTierPlatinum) }), 1, 100000000, 50000)}
                {numField("Belanja → Gold", `Di atas Silver (${num(s.memberTierSilver)})`, s.memberTierGold, (n) => set({ memberTierGold: Math.max(s.memberTierSilver + 1, n), memberTierPlatinum: Math.max(Math.max(s.memberTierSilver + 1, n) + 1, s.memberTierPlatinum) }), s.memberTierSilver + 1, 100000000, 50000)}
                {numField("Belanja → Platinum", `Di atas Gold (${num(s.memberTierGold)})`, s.memberTierPlatinum, (n) => set({ memberTierPlatinum: Math.max(s.memberTierGold + 1, n) }), s.memberTierGold + 1, 100000000, 50000)}
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                {numField("Bonus Silver (%)", "Di atas potongan dasar", s.memberBonusSilver, (n) => set({ memberBonusSilver: n }), 0, 25)}
                {numField("Bonus Gold (%)", "Di atas potongan dasar", s.memberBonusGold, (n) => set({ memberBonusGold: n }), 0, 25)}
                {numField("Bonus Platinum (%)", "Di atas potongan dasar", s.memberBonusPlatinum, (n) => set({ memberBonusPlatinum: n }), 0, 25)}
              </div>
              <p className="text-[11px] text-faint">Bronze otomatis untuk semua member baru (ambang 0). Kelola isi katalog hadiah di halaman <b className="text-ink">Member → Katalog Hadiah</b>.</p>
            </div>

            <Field label="Catatan benefit untuk pelanggan" hint="Tampil di halaman pelanggan dan portal member">
              <Textarea rows={2} value={s.memberBenefitNotes} onChange={(e) => set({ memberBenefitNotes: e.target.value })} />
            </Field>

            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" size="sm" onClick={() => {
                set({
                  memberPointRate: DEMO_SETTINGS.memberPointRate, memberDiscountPct: DEMO_SETTINGS.memberDiscountPct,
                  memberBirthdayPct: DEMO_SETTINGS.memberBirthdayPct, memberWelcomePoints: DEMO_SETTINGS.memberWelcomePoints,
                  memberTierSilver: DEMO_SETTINGS.memberTierSilver, memberTierGold: DEMO_SETTINGS.memberTierGold,
                  memberTierPlatinum: DEMO_SETTINGS.memberTierPlatinum,
                  memberBonusSilver: DEMO_SETTINGS.memberBonusSilver, memberBonusGold: DEMO_SETTINGS.memberBonusGold,
                  memberBonusPlatinum: DEMO_SETTINGS.memberBonusPlatinum, memberBenefitNotes: DEMO_SETTINGS.memberBenefitNotes,
                });
                sfx.tap();
                push({ msg: "Benefit member dikembalikan ke bawaan", type: "ok" });
              }}><IRefresh size={14} /> Reset benefit</Button>
              <Button variant="soft" size="sm" onClick={() => setPreviewOpen(true)}><IHeart size={14} /> Lihat seperti pelanggan</Button>
            </div>
          </>
        ) : (
          <p className="text-[11.5px] text-mute">
            Kamu bisa mendaftarkan member dan menerapkan benefitnya di kasir. Angka benefit ditetapkan administrator dan tidak bisa diubah dari akun kasir.
          </p>
        )}

        <MemberBenefitsPanel settings={s} dense showSteps={false} />
      </div>

      {/* PENGGUNA */}
      {can("settings.users") && (
        <div className="card p-5 space-y-4 rise" style={{ animationDelay: "100ms" }}>
          <div className="flex flex-wrap items-center gap-2">
            <IUsers size={18} className="text-accent" />
            <h2 className="font-display font-bold">Pengguna & Akses</h2>
            <Badge color="var(--accent)">{state.users.length} akun</Badge>
            <Button size="sm" className="ml-auto" onClick={() => setUserForm({ open: true, edit: null })}><IUserPlus size={14} /> Tambah Kasir</Button>
          </div>
          <div className="rounded-xl border p-3 text-[11px] flex gap-2"
            style={{ borderColor: "color-mix(in srgb, var(--accent) 30%, transparent)", background: "var(--accent-soft)" }}>
            <IShield size={14} className="text-accent shrink-0 mt-0.5" />
            <span className="text-mute">
              Administrator dilindungi sistem — tidak bisa dihapus, dinonaktifkan, atau diturunkan perannya, dan tidak memiliki shift.
              Akun kasir yang dihapus <b className="text-ink">tidak akan pernah dibuat ulang</b> oleh sistem.
            </span>
          </div>
          <ul className="space-y-2">
            {state.users.map((u) => {
              const locked = isProtectedUser(u);
              const isMe = u.id === user?.id;
              const shifts = state.shiftPlans.filter((p) => p.userId === u.id && p.active).length;
              return (
                <li key={u.id} className="rounded-2xl border border-line bg-surface p-3.5 flex flex-wrap items-center gap-3">
                  <span className="w-10 h-10 rounded-xl grid place-items-center text-xs font-bold shrink-0"
                    style={{ color: u.role === "admin" ? "var(--accent-ink)" : "var(--amber-ink)", background: u.role === "admin" ? "linear-gradient(135deg, var(--accent), var(--accent2))" : "linear-gradient(135deg, var(--amber), color-mix(in srgb, var(--amber) 70%, #000))" }}>
                    {u.name.split(" ").slice(0, 2).map((w: string) => w[0]).join("").toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold truncate flex items-center gap-1.5">
                      {u.name}
                      {isMe && <Badge color="var(--pandan)">sedang masuk</Badge>}
                    </p>
                    <p className="text-[11px] text-faint font-mono">@{u.username} · dibuat {dateID(u.createdAt)}</p>
                    <p className="text-[10px] text-faint">{u.role === "admin" ? "Tanpa shift · kasir = mode uji" : `${shifts} shift terjadwal / minggu`}</p>
                  </div>
                  <Badge color={u.role === "admin" ? "var(--accent)" : "var(--amber)"}>
                    {u.role === "admin" ? <IShield size={10} /> : <IUsers size={10} />} {roleLabel(u.role)}
                  </Badge>
                  {locked ? (
                    <Badge color="var(--violet)"><IShield size={10} /> Dilindungi</Badge>
                  ) : (
                    <label className="flex items-center gap-2 text-[11px] font-bold text-mute">
                      {u.active ? "Aktif" : "Nonaktif"}
                      <Toggle small checked={u.active} label={`Aktifkan ${u.name}`}
                        onChange={(v) => { dispatch({ type: "SET_USER_ACTIVE", ids: [u.id], active: v }); sfx.tap(); push({ msg: `${u.name} ${v ? "diaktifkan" : "dinonaktifkan"}`, type: "ok" }); }} />
                    </label>
                  )}
                  <div className="flex gap-1">
                    <IconBtn label="Edit akun" className="!p-1.5" onClick={() => setUserForm({ open: true, edit: u })}><IKey size={14} /></IconBtn>
                    <IconBtn label={locked ? "Akun admin tidak bisa dihapus" : "Hapus akun"}
                      className={`!p-1.5 ${locked ? "opacity-35 cursor-not-allowed" : "hover:!text-chili"}`}
                      onClick={() => { if (locked) { sfx.error(); push({ msg: "Akun administrator dilindungi — tidak bisa dihapus", type: "err" }); } else setDelUser(u); }}>
                      <ITrash size={14} />
                    </IconBtn>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* BRAND */}
      {can("settings.store") && (
        <div className="card p-5 space-y-5 rise" style={{ animationDelay: "130ms" }}>
          <div className="flex items-center gap-2">
            <IImage size={18} className="text-accent" />
            <h2 className="font-display font-bold">Brand & Logo</h2>
            <span className="ml-auto text-[11px] text-faint">Tampil di sidebar, header, menu HP, dan struk</span>
          </div>
          <div className="grid lg:grid-cols-2 gap-5">
            <div className="space-y-4">
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); void handleLogo(e.dataTransfer.files?.[0]); }}
                className={`rounded-2xl border-2 border-dashed p-5 text-center transition-all ${dragOver ? "border-accent bg-accent-soft" : "border-line2 bg-surface"}`}>
                <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={(e) => void handleLogo(e.target.files?.[0])} />
                <div className="flex justify-center mb-2">
                  <span className="w-11 h-11 rounded-xl grid place-items-center bg-accent-soft text-accent">
                    {busy ? <IRefresh size={20} className="spin" /> : <IUpload size={20} />}
                  </span>
                </div>
                <p className="text-sm font-bold">{busy ? "Memproses gambar…" : "Unggah logo dari galeri / laptop"}</p>
                <p className="text-[11px] text-faint mt-1">Tarik & lepas atau pilih file · PNG / JPG / WebP · maks {formatBytes(LOGO_LIMITS.maxInputBytes)}</p>
                <div className="flex flex-wrap justify-center gap-2 mt-3">
                  <Button size="sm" disabled={busy} onClick={() => logoRef.current?.click()}><IUpload size={14} /> Pilih Foto</Button>
                  {s.logo && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => downloadDataUrl(`${s.brandName.toLowerCase()}-logo.webp`, s.logo!)}><IDownload size={14} /> Unduh</Button>
                      <Button size="sm" variant="danger" onClick={() => setLogoResetOpen(true)}><ITrash size={14} /> Hapus</Button>
                    </>
                  )}
                </div>
              </div>
              {logoInfo && (
                <div className="rounded-xl border border-line bg-surface p-3 text-[11px] space-y-1">
                  <p className="font-bold text-xs flex items-center gap-1.5"><ICheckCircle size={13} className="text-pandan" /> Hasil pemrosesan</p>
                  <p className="text-mute">Asli: {logoInfo.source.width}×{logoInfo.source.height} · {formatBytes(logoInfo.source.bytes)} · {logoInfo.source.type}</p>
                  <p className="text-mute">Dipakai: <b className="text-ink">{logoInfo.width}×{logoInfo.height}</b> · <b className="text-ink">{formatBytes(logoInfo.bytes)}</b> · {logoInfo.format}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nama Brand"><Input value={s.brandName} onChange={(e) => set({ brandName: e.target.value })} /></Field>
                <Field label="Tagline Bawah Logo"><Input value={s.brandTagline} onChange={(e) => set({ brandTagline: e.target.value })} /></Field>
              </div>
              <Field label={`Ukuran Logo — ${s.logoSize}px`}>
                <input type="range" min={LOGO_LIMITS.minSize} max={LOGO_LIMITS.maxSize} step={1} value={s.logoSize}
                  onChange={(e) => set({ logoSize: clamp(Number(e.target.value), LOGO_LIMITS.minSize, LOGO_LIMITS.maxSize) })}
                  className="w-full cursor-pointer" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Bentuk Logo">
                  <Select value={s.logoShape} onChange={(v) => set({ logoShape: v as LogoShape })}
                    options={[{ v: "rounded", l: "Sudut membulat" }, { v: "circle", l: "Bulat" }, { v: "square", l: "Kotak" }]} />
                </Field>
                <div className="flex flex-col justify-end gap-2">
                  <label className="flex items-center justify-between text-xs font-bold">
                    Tulisan brand <Toggle small checked={s.showWordmark} label="Tulisan brand" onChange={(v) => set({ showWordmark: v })} />
                  </label>
                  <label className="flex items-center justify-between text-xs font-bold">
                    Tagline <Toggle small checked={s.showTagline} label="Tagline" onChange={(v) => set({ showTagline: v })} />
                  </label>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-3">
                <div>
                  <p className="text-sm font-bold">Latar putih di belakang logo</p>
                  <p className="text-[11px] text-faint">Nyalakan kalau logo berwarna gelap / transparan</p>
                </div>
                <Toggle checked={s.logoPlate} label="Latar logo" onChange={(v) => set({ logoPlate: v })} />
              </div>
            </div>
            <div className="space-y-3">
              <p className="text-xs font-bold text-mute">Pratinjau di kedua tema</p>
              {(["dark", "light"] as const).map((mode) => (
                <div key={mode} data-theme={mode} data-accent={s.accent} className="rounded-2xl border p-4"
                  style={{ background: "var(--bg)", borderColor: "var(--line)" }}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--faint)" }}>
                      {mode === "dark" ? "Mode Gelap" : "Mode Terang"}
                    </span>
                    <span style={{ color: "var(--muted)" }}>{mode === "dark" ? <IMoon size={13} /> : <ISun size={13} />}</span>
                  </div>
                  <div className="rounded-xl border p-3" style={{ background: "var(--bg2)", borderColor: "var(--line)" }}>
                    <BrandLockup settings={s} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TOKO & PAJAK */}
      {can("settings.store") && (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="card p-5 space-y-4 rise" style={{ animationDelay: "160ms" }}>
            <h2 className="font-display font-bold">Profil Toko</h2>
            <Field label="Nama Toko"><Input value={s.storeName} onChange={(e) => set({ storeName: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tagline Toko"><Input value={s.tagline} onChange={(e) => set({ tagline: e.target.value })} /></Field>
              <Field label="Nama Kasir di Struk"><Input value={s.cashier} onChange={(e) => set({ cashier: e.target.value })} /></Field>
            </div>
            <Field label="Alamat" hint="Dipakai Google Maps di halaman pelanggan — semakin spesifik semakin presisi">
              <Input value={s.address} onChange={(e) => set({ address: e.target.value })} />
            </Field>
            <Field label="No. Telepon"><Input value={s.phone} onChange={(e) => set({ phone: e.target.value })} /></Field>
            <Field label="Footer Struk"><Textarea rows={2} value={s.receiptFooter} onChange={(e) => set({ receiptFooter: e.target.value })} /></Field>
          </div>
          <div className="card p-5 space-y-4 rise" style={{ animationDelay: "190ms" }}>
            <h2 className="font-display font-bold">Pajak & Biaya</h2>
            <div className="grid grid-cols-3 gap-3">
              <Field label="PPN (%)"><Input type="number" min={0} max={100} value={s.taxPct} onChange={(e) => set({ taxPct: clamp(Number(e.target.value) || 0, 0, 100) })} /></Field>
              <Field label="Service (%)"><Input type="number" min={0} max={100} value={s.servicePct} onChange={(e) => set({ servicePct: clamp(Number(e.target.value) || 0, 0, 100) })} /></Field>
              <Field label="Batas Stok Menipis"><Input type="number" min={0} value={s.lowStock} onChange={(e) => set({ lowStock: clamp(Number(e.target.value) || 0, 0, 999) })} /></Field>
            </div>
            <div className="rounded-xl border border-line bg-surface p-4">
              <p className="text-xs font-bold mb-2">Contoh: member Gold belanja Rp 100.000</p>
              {(() => {
                const sub = 100000;
                const pctGold = clamp(s.memberDiscountPct + s.memberBonusGold, 0, 40);
                const md = Math.round(sub * pctGold / 100);
                const base = sub - md;
                const tax = Math.round(base * s.taxPct / 100);
                return (
                  <div className="text-xs text-mute space-y-1 font-mono">
                    <div className="flex justify-between"><span>Subtotal</span><span>Rp 100.000</span></div>
                    <div className="flex justify-between" style={{ color: "var(--violet)" }}><span>Member Gold {pctGold}%</span><span>−Rp {md.toLocaleString("id-ID")}</span></div>
                    <div className="flex justify-between"><span>PPN {s.taxPct}%</span><span>Rp {tax.toLocaleString("id-ID")}</span></div>
                    <div className="flex justify-between font-bold text-accent border-t border-line pt-1"><span>Total</span><span>Rp {(base + tax).toLocaleString("id-ID")}</span></div>
                    <div className="flex justify-between"><span>Poin</span><span>+{Math.floor((base + tax) / Math.max(100, s.memberPointRate))}</span></div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* DATA */}
      {can("data.manage") && (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="card p-5 space-y-4 rise" style={{ animationDelay: "220ms" }}>
            <div className="flex items-center gap-2">
              <IDatabase size={18} className="text-accent" />
              <h2 className="font-display font-bold">Data & Backup</h2>
            </div>
            <p className="text-xs text-mute">
              localStorage · {sizeKB} KB. Isi demo terpusat di <code className="kbd">lib/demo-data.ts</code>.
              Saat ini: <b className="text-ink">{state.products.length}</b> produk · <b className="text-ink">{state.transactions.length}</b> transaksi · <b className="text-ink">{memberCount}</b> member · <b className="text-ink">{state.rewards.length}</b> hadiah · <b className="text-ink">{state.shiftPlans.length}</b> jadwal shift · <b className="text-ink">{state.users.length}</b> akun · <b className="text-ink">{state.notifications.length}</b> log.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" onClick={exportJSON}><IDownload size={16} /> Ekspor JSON</Button>
              <Button variant="ghost" onClick={() => fileRef.current?.click()}><IUpload size={16} /> Impor JSON</Button>
              <input ref={fileRef} type="file" accept="application/json" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) importJSON(f); e.target.value = ""; }} />
            </div>
            <div className="rounded-2xl border border-line bg-surface p-4">
              <p className="text-sm font-bold flex items-center gap-1.5"><IRefresh size={15} className="text-accent" /> Acak Ulang Data Demo</p>
              <p className="text-[11px] text-mute mt-1 mb-3">Buat ulang 90 hari transaksi, produk, promo, member, hadiah, jadwal & sesi shift. Pengaturan, brand, dan akun terdaftar tetap.</p>
              <Button variant="soft" size="sm" onClick={() => setResetOpen(true)}><IRefresh size={14} /> Acak Ulang</Button>
            </div>
            <div className="rounded-2xl border p-4" style={{ borderColor: "color-mix(in srgb, var(--chili) 38%, transparent)", background: "color-mix(in srgb, var(--chili) 7%, transparent)" }}>
              <p className="text-sm font-bold text-chili flex items-center gap-1.5"><ITrash size={15} /> Hapus Seluruh Data Demo</p>
              <p className="text-[11px] text-mute mt-1">
                Menghapus produk, paket, promo, transaksi, pelanggan & member, hadiah, order ditahan, view, jadwal shift, dan log notifikasi.
                Tetap tersimpan: akun admin & kasir terdaftar, sesi login, pengaturan toko, brand, logo, tema, dan benefit member.
              </p>
              <Button variant="danger" size="sm" className="mt-3" onClick={() => { setWipeText(""); setWipeOpen(true); }}>
                <ITrash size={14} /> Hapus Semua Data Demo
              </Button>
            </div>
          </div>
          <div className="card p-5 rise" style={{ animationDelay: "250ms" }}>
            <h2 className="font-display font-bold mb-3">Tentang {s.brandName}</h2>
            <p className="text-sm text-mute leading-relaxed">
              POS untuk UMKM Indonesia — kasir cepat, katalog foto, paket bundling, promo terjadwal, member bertier berbasis akumulasi belanja dengan poin yang bisa ditukar hadiah,
              shift khusus kasir dengan tutup otomatis, portal member mandiri, log aktivitas sistem, dan Google Maps pada halaman pelanggan.
            </p>
            <div className="flex flex-wrap gap-2 mt-4">
              <Badge color="var(--accent)">Next.js 16</Badge>
              <Badge color="var(--laut)">React 19</Badge>
              <Badge color="var(--amber)">Tailwind v4</Badge>
              <Badge color="var(--magenta)">TypeScript 5</Badge>
              <Badge color="var(--violet)">Tier & poin hadiah</Badge>
              <Badge color="var(--pandan)">Portal member</Badge>
            </div>
            <p className="text-[11px] text-faint mt-4">v1.8 · demo lokal. Pembayaran QRIS/Kartu simulasi; geocoding lewat route server agar tetap jalan di Vercel.</p>
          </div>
        </div>
      )}

      {!can("settings.store") && (
        <div className="card p-5 rise" style={{ animationDelay: "120ms" }}>
          <h2 className="font-display font-bold mb-2">Ruang kerja kasir</h2>
          <p className="text-sm text-mute">
            Kamu masuk sebagai <b className="text-ink">Kasir</b>: kasir, member pelanggan, shift sendiri, dan struk milikmu.
            Katalog produk, analitik bisnis, refund, benefit member, pengguna, dan data demo dikelola administrator — yang mewarisi seluruh fitur kasir juga.
          </p>
        </div>
      )}

      <Modal open={previewOpen} onClose={() => setPreviewOpen(false)} wide title="Benefit member — seperti dilihat pelanggan"
        footer={<div className="flex justify-end"><Button onClick={() => setPreviewOpen(false)}>Tutup</Button></div>}>
        <MemberBenefitsPanel settings={s} dense />
      </Modal>

      <Confirm open={resetOpen} onClose={() => setResetOpen(false)} onConfirm={reseed}
        title="Acak ulang data demo?" confirmLabel="Ya, Acak Ulang"
        desc="Produk, transaksi, pelanggan & member, hadiah, order ditahan, jadwal shift, dan sesi shift diganti dengan data demo baru. Pengaturan, tema, logo, benefit member, dan akun terdaftar tidak berubah." />

      <Modal open={wipeOpen} onClose={() => setWipeOpen(false)} title="Hapus seluruh data demo?"
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setWipeOpen(false)}>Batal</Button>
            <Button variant="danger" disabled={wipeText.trim().toUpperCase() !== "HAPUS"}
              onClick={() => { wipeDemo(); setWipeOpen(false); }}><ITrash size={15} /> Hapus Permanen</Button>
          </div>
        }>
        <div className="space-y-4">
          <div className="rounded-xl border p-3 text-[12px]"
            style={{ borderColor: "color-mix(in srgb, var(--chili) 40%, transparent)", background: "color-mix(in srgb, var(--chili) 8%, transparent)" }}>
            <p className="font-bold text-chili flex items-center gap-1.5">
              <IAlert size={14} /> {state.products.length} produk, {state.transactions.length} transaksi, {memberCount} member, {state.rewards.length} hadiah, {state.shiftPlans.length} jadwal shift, dan {state.shiftSessions.length} sesi shift akan dihapus.
            </p>
          </div>
          <div className="rounded-xl border border-line bg-surface p-3 text-[12px] text-mute">
            <p className="font-bold text-ink mb-1.5">Tidak ikut terhapus:</p>
            <ul className="space-y-1">
              {state.users.map((u) => (
                <li key={u.id} className="flex items-center gap-1.5 flex-wrap">
                  <ICheckCircle size={12} className="text-pandan" />
                  {u.name} <span className="font-mono text-faint">@{u.username}</span>
                  <Badge color={u.role === "admin" ? "var(--accent)" : "var(--amber)"}>{roleLabel(u.role)}</Badge>
                </li>
              ))}
              <li className="flex items-center gap-1.5"><ICheckCircle size={12} className="text-pandan" /> Pengaturan toko, brand, logo, tema, benefit member, dan sesi login</li>
            </ul>
          </div>
          <Field label='Ketik "HAPUS" untuk konfirmasi'>
            <Input value={wipeText} onChange={(e) => setWipeText(e.target.value)} placeholder="HAPUS" autoFocus />
          </Field>
        </div>
      </Modal>

      <Confirm open={logoResetOpen} onClose={() => setLogoResetOpen(false)}
        onConfirm={() => { set({ logo: null }); setLogoInfo(null); sfx.remove(); push({ msg: "Logo dihapus, kembali ke logo bawaan", type: "info" }); }}
        title="Hapus logo unggahan?" confirmLabel="Ya, Hapus"
        desc="Logo kembali ke lambang bawaan. Tulisan brand dan tagline tetap dipertahankan." />

      <UserFormModal open={userForm.open} edit={userForm.edit} onClose={() => setUserForm({ open: false, edit: null })} />

      <Confirm open={!!delUser} onClose={() => setDelUser(null)} onConfirm={() => delUser && removeUser(delUser)}
        title={`Hapus akun ${delUser?.name ?? ""}?`} confirmLabel="Ya, Hapus Akun"
        desc={`Akun @${delUser?.username ?? ""} tidak bisa masuk lagi dan jadwal shiftnya dihapus. Riwayat transaksi tetap tersimpan. Bisa diurungkan lewat notifikasi.`} />
    </div>
  );
}

function UserFormModal({ open, edit, onClose }: { open: boolean; edit: User | null; onClose: () => void }) {
  const { state, dispatch } = useStore();
  const { push } = useToast();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(edit?.name ?? "");
    setUsername(edit?.username ?? "");
    setPw(""); setPw2(""); setErr("");
  }, [open, edit]);

  const locked = edit ? isProtectedUser(edit) : false;

  const save = () => {
    const nm = name.trim();
    const un = username.trim().toLowerCase();
    if (!nm) { setErr("Nama wajib diisi"); sfx.error(); return; }
    if (!/^[a-z0-9._-]{3,20}$/.test(un)) { setErr("Username 3–20 karakter: huruf, angka, titik, - atau _"); sfx.error(); return; }
    if (state.users.some((u) => u.id !== edit?.id && u.username.toLowerCase() === un)) { setErr("Username sudah dipakai"); sfx.error(); return; }
    if (!edit && pw.length < 6) { setErr("Password minimal 6 karakter"); sfx.error(); return; }
    if (pw && pw.length < 6) { setErr("Password minimal 6 karakter"); sfx.error(); return; }
    if (pw && pw !== pw2) { setErr("Konfirmasi password tidak sama"); sfx.error(); return; }

    if (edit) {
      dispatch({ type: "UPDATE_USER", user: { ...edit, name: nm, username: locked ? edit.username : un, passHash: pw ? hashPassword(pw) : edit.passHash } });
      push({ msg: `Akun ${nm} diperbarui${pw ? " · password diganti" : ""}`, type: "ok" });
    } else {
      dispatch({ type: "ADD_USER", user: { id: uid(), name: nm, username: un, role: "kasir", passHash: hashPassword(pw), active: true, createdAt: Date.now(), isRoot: false } });
      push({ msg: `Akun kasir ${nm} dibuat — bisa langsung dijadwalkan shift`, type: "ok" });
    }
    sfx.success();
    onClose();
  };

  const sameAsOld = edit && pw ? verifyPassword(pw, edit.passHash) : false;

  return (
    <Modal open={open} onClose={onClose} title={edit ? `Edit Akun · ${edit.name}` : "Tambah Akun Kasir"}
      footer={<div className="flex gap-2 justify-end"><Button variant="ghost" onClick={onClose}>Batal</Button><Button onClick={save}>{edit ? "Simpan" : "Buat Akun"}</Button></div>}>
      <div className="space-y-4">
        {locked && (
          <div className="rounded-xl border p-3 text-[11px] flex gap-2"
            style={{ borderColor: "color-mix(in srgb, var(--accent) 30%, transparent)", background: "var(--accent-soft)" }}>
            <IShield size={14} className="text-accent shrink-0 mt-0.5" />
            <span className="text-mute">Administrator dilindungi: username & peran terkunci, tidak bisa dinonaktifkan atau dihapus, dan tidak memiliki shift.</span>
          </div>
        )}
        <Field label="Nama Lengkap *"><Input value={name} onChange={(e) => { setName(e.target.value); setErr(""); }} placeholder="cth. Sari Wulandari" autoFocus /></Field>
        <Field label="Username *" hint={locked ? "Terkunci untuk akun admin" : "Huruf kecil, tanpa spasi"}>
          <Input value={username} disabled={locked} onChange={(e) => { setUsername(e.target.value); setErr(""); }} placeholder="sari" />
        </Field>
        <Field label="Peran">
          <div className="input flex items-center justify-between py-2">
            <span className="text-sm font-bold">{edit ? roleLabel(edit.role) : "Kasir"}</span>
            <Badge color={edit?.role === "admin" ? "var(--accent)" : "var(--amber)"}>
              {edit?.role === "admin" ? <IShield size={10} /> : <IUsers size={10} />} {edit ? roleLabel(edit.role) : "Kasir"}
            </Badge>
          </div>
        </Field>
        <Field label={edit ? "Password baru (opsional)" : "Password *"} hint="Minimal 6 karakter" error={err}>
          <Input type="password" value={pw} onChange={(e) => { setPw(e.target.value); setErr(""); }} placeholder="••••••••" />
        </Field>
        {pw && <Field label="Ulangi password"><Input type="password" value={pw2} onChange={(e) => { setPw2(e.target.value); setErr(""); }} placeholder="••••••••" /></Field>}
        {sameAsOld && <p className="text-[11px] text-amber">Password baru sama dengan yang lama.</p>}
        {!edit && (
          <p className="text-[11px] text-faint">
            Kasir mendapat akses: kasir, daftarkan & layani member, shift sendiri, dan transaksi miliknya.
            Benefit member bersifat baca-saja; katalog, analitik, refund, dan pengaturan toko tetap milik administrator.
          </p>
        )}
      </div>
    </Modal>
  );
}