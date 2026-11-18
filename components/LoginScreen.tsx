"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { useToast } from "./Toasts";
import { sfx, setSoundEnabled } from "@/lib/sound";
import { hashPassword, homeFor, roleLabel, verifyPassword } from "@/lib/auth";
import { DEFAULT_DEMO_PASSWORDS, STORE_CLOSE, STORE_OPEN } from "@/lib/demo-data";
import { applyTheme, resolveTheme } from "@/lib/brand";
import { dateFull } from "@/lib/format";
import type { User } from "@/lib/types";
import { AuthField } from "./AuthField";
import { MemberLoginForm } from "./MemberAuth";
import { Badge, Button, IconBtn } from "./ui";
import { BrandLockup } from "./Brand";
import {
  IAlert, IArrowRight, ICheckCircle, IHeart, ILock, IMoon, IRegister,
  IShield, IStore, ISun, IUser, IUsers, IVolume, IVolumeX,
} from "./icons";

type LoginMode = "staf" | "member";

export function LoginScreen() {
  const { state, dispatch } = useStore();
  const { push } = useToast();
  const router = useRouter();

  const [mode, setMode] = useState<LoginMode>("staf");

  /* staf */
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [filling, setFilling] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [hint, setHint] = useState("");

  const [now, setNow] = useState<number | null>(null);
  const userRef = useRef<HTMLInputElement>(null);
  const passRef = useRef<HTMLInputElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(t);
      clearTimers();
    };
  }, []);

  useEffect(() => {
    applyTheme(state.settings.theme);
  }, [state.settings.theme]);

  useEffect(() => {
    setSoundEnabled(state.settings.sound);
  }, [state.settings.sound]);

  const accounts = useMemo(() => state.users.filter((u) => u.active), [state.users]);
  const adminCount = accounts.filter((u) => u.role === "admin").length;
  const kasirCount = accounts.filter((u) => u.role === "kasir").length;
  const memberCount = state.customers.filter((c) => c.member).length;

  const demoPasswordOf = (u: User) =>
    DEFAULT_DEMO_PASSWORDS.find((p) => hashPassword(p) === u.passHash) ?? null;

  const resolved = resolveTheme(state.settings.theme);

  const toggleTheme = () => {
    const next = resolved === "dark" ? "light" : "dark";
    dispatch({ type: "UPDATE_SETTINGS", patch: { theme: next } });
    applyTheme(next);
    sfx.tap();
  };

  const toggleSound = () => {
    const next = !state.settings.sound;
    dispatch({ type: "UPDATE_SETTINGS", patch: { sound: next } });
    setSoundEnabled(next);
    if (next) sfx.tap();
  };

  const typeField = (
    set: (v: string) => void,
    text: string,
    which: string,
    delay: number,
    done?: () => void
  ) => {
    setFilling(which);
    text.split("").forEach((_, i) => {
      timers.current.push(
        setTimeout(() => {
          set(text.slice(0, i + 1));
          if (i % 2 === 0) sfx.tap();
        }, delay + i * 34)
      );
    });
    timers.current.push(
      setTimeout(() => {
        setFilling(null);
        done?.();
      }, delay + text.length * 34 + 90)
    );
  };

  const autoFillStaff = (u: User) => {
    clearTimers();
    setError("");
    setHint("");
    setPicked(u.id);
    setUsername("");
    setPassword("");

    const pw = demoPasswordOf(u);
    typeField(setUsername, u.username, "username", 90, () => {
      if (pw) {
        typeField(setPassword, pw, "password", 60, () => sfx.add());
      } else {
        setHint(`Akun @${u.username} memakai password khusus. Silakan ketik passwordnya sendiri.`);
        passRef.current?.focus();
        sfx.add();
      }
    });
  };

  const submitStaff = () => {
    if (busy || filling) return;
    const uname = username.trim().toLowerCase();
    if (!uname || !password) {
      setError("Username dan password wajib diisi.");
      sfx.error();
      return;
    }

    setBusy(true);
    setError("");

    timers.current.push(
      setTimeout(() => {
        const u = state.users.find((x) => x.username.toLowerCase() === uname);
        if (!u || !verifyPassword(password, u.passHash)) {
          setBusy(false);
          setError("Username atau password salah.");
          sfx.error();
          return;
        }
        if (!u.active) {
          setBusy(false);
          setError("Akun ini dinonaktifkan. Hubungi administrator.");
          sfx.error();
          return;
        }

        dispatch({ type: "LOGIN", userId: u.id });
        dispatch({ type: "UPDATE_SETTINGS", patch: { cashier: u.name.split(" ")[0] } });
        sfx.success();
        push({ msg: `Selamat datang, ${u.name} — ${roleLabel(u.role)}`, type: "ok" });
        setBusy(false);
        router.replace(homeFor(u.role));
      }, 420)
    );
  };

  const already = state.session ? state.users.find((u) => u.id === state.session!.userId) : null;
  const hour = now ? new Date(now).getHours() : null;
  const open = hour !== null && hour >= parseInt(STORE_OPEN) && hour < parseInt(STORE_CLOSE);

  return (
    <div className="relative min-h-dvh flex flex-col">
      <div className="aurora" aria-hidden><i /><i /><i /></div>
      <div className="grain" aria-hidden />

      <header className="relative z-10 flex items-center justify-between gap-3 px-5 md:px-8 h-16 border-b border-line bg-bg/70 backdrop-blur-xl">
        <BrandLockup settings={state.settings} size={30} />
        <div className="flex items-center gap-2">
          <Link href="/beranda" className="btn btn-ghost btn-sm hidden sm:inline-flex">
            <IStore size={14} /> Halaman pelanggan
          </Link>
          <span className="hidden lg:inline-flex items-center gap-2 text-[11px] text-faint font-mono">
            {now
              ? new Date(now).toLocaleTimeString("id-ID", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })
              : "--.--.--"}
          </span>
          <IconBtn label={resolved === "dark" ? "Mode terang" : "Mode gelap"} onClick={toggleTheme}>
            {resolved === "dark" ? <IMoon size={17} /> : <ISun size={17} />}
          </IconBtn>
          <IconBtn
            label={state.settings.sound ? "Matikan suara" : "Nyalakan suara"}
            active={state.settings.sound}
            onClick={toggleSound}
          >
            {state.settings.sound ? <IVolume size={17} /> : <IVolumeX size={17} />}
          </IconBtn>
        </div>
      </header>

      <main className="relative z-10 flex-1 grid lg:grid-cols-[1.05fr_1fr] gap-8 lg:gap-14 items-center px-5 md:px-8 py-10 max-w-[1240px] w-full mx-auto">
        <section className="rise">
          <Badge color="var(--accent)">
            <IShield size={11} /> Login terpadu · staf & member
          </Badge>
          <h1 className="font-display font-bold text-3xl md:text-5xl leading-[1.05] mt-4">
            Masuk ke <span className="text-grad">{state.settings.brandName}</span>
            <br />sesuai peranmu.
          </h1>
          <p className="text-sm md:text-base text-mute mt-4 max-w-lg leading-relaxed">
            {state.settings.storeName} — {state.settings.tagline}. Staf mengelola kasir & shift, member memantau poin dan hadiah.
          </p>

          <div className="grid sm:grid-cols-3 gap-3 mt-7 max-w-2xl">
            <div className="card p-4">
              <span className="w-9 h-9 rounded-xl grid place-items-center" style={{ color: "var(--accent)", background: "var(--accent-soft)" }}>
                <IShield size={16} />
              </span>
              <p className="text-sm font-bold mt-2.5">Administrator · {adminCount}</p>
              <p className="text-[11px] text-mute mt-1 leading-snug">Semua fitur, termasuk jadwal shift & benefit member.</p>
            </div>
            <div className="card p-4">
              <span className="w-9 h-9 rounded-xl grid place-items-center" style={{ color: "var(--amber)", background: "color-mix(in srgb, var(--amber) 14%, transparent)" }}>
                <IRegister size={16} />
              </span>
              <p className="text-sm font-bold mt-2.5">Kasir · {kasirCount}</p>
              <p className="text-[11px] text-mute mt-1 leading-snug">Jualan, daftarkan member, shift sendiri.</p>
            </div>
            <div className="card p-4" style={{ borderColor: "color-mix(in srgb, var(--violet) 32%, transparent)" }}>
              <span className="w-9 h-9 rounded-xl grid place-items-center" style={{ color: "var(--violet)", background: "color-mix(in srgb, var(--violet) 14%, transparent)" }}>
                <IHeart size={16} />
              </span>
              <p className="text-sm font-bold mt-2.5">Member · {memberCount}</p>
              <p className="text-[11px] text-mute mt-1 leading-snug">Login username + PIN, cek poin, tier, dan hadiah.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-6 text-[11px] text-faint">
            <span className="inline-flex items-center gap-1.5" style={{ color: open ? "var(--pandan)" : "var(--amber)" }}>
              <span className="w-1.5 h-1.5 rounded-full pulse-dot" style={{ background: "currentColor" }} />
              {open ? "Kedai sedang buka" : "Kedai sedang tutup"} · {STORE_OPEN}–{STORE_CLOSE}
            </span>
            {now && <span className="hidden md:inline">{dateFull(now)}</span>}
          </div>
        </section>

        <section className="card p-6 md:p-7 rise w-full max-w-md justify-self-center lg:justify-self-end" style={{ animationDelay: "90ms" }}>
          {already ? (
            <div className="text-center py-4">
              <span className="w-14 h-14 rounded-2xl grid place-items-center mx-auto grad-accent text-accent-ink">
                <ICheckCircle size={26} />
              </span>
              <h2 className="font-display font-bold text-xl mt-4">Sudah masuk</h2>
              <p className="text-sm text-mute mt-1">{already.name} · {roleLabel(already.role)}</p>
              <Button className="w-full mt-5" onClick={() => router.replace(homeFor(already.role))}>
                Lanjut ke ruang kerja <IArrowRight size={16} />
              </Button>
              <Button variant="ghost" className="w-full mt-2" onClick={() => { dispatch({ type: "LOGOUT" }); sfx.remove(); }}>
                Keluar & ganti akun
              </Button>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex rounded-xl border border-line bg-bg2 p-1 gap-1">
                {(["staf", "member"] as LoginMode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => { setMode(m); sfx.tap(); }}
                    className="flex-1 rounded-lg px-3 py-2 text-xs font-bold transition-all inline-flex items-center justify-center gap-1.5"
                    style={
                      mode === m
                        ? { background: "linear-gradient(135deg, var(--accent), var(--accent2))", color: "var(--accent-ink)" }
                        : { color: "var(--muted)" }
                    }
                  >
                    {m === "staf" ? <><IRegister size={14} /> Staf</> : <><IHeart size={14} /> Member</>}
                  </button>
                ))}
              </div>

              {mode === "staf" ? (
                <form onSubmit={(e) => { e.preventDefault(); submitStaff(); }} className="space-y-4">
                  <div className="flex items-center gap-2.5">
                    <span className="w-10 h-10 rounded-xl grid place-items-center bg-accent-soft text-accent">
                      <ILock size={19} />
                    </span>
                    <div>
                      <h2 className="font-display font-bold text-lg leading-none">Masuk staf</h2>
                      <p className="text-[11px] text-faint mt-1">Admin & kasir yang terdaftar di perangkat ini</p>
                    </div>
                  </div>

                  <AuthField
                    ref={userRef}
                    label="Username"
                    value={username}
                    onChange={(v) => { setUsername(v); setError(""); setPicked(null); setHint(""); }}
                    icon={<IUser size={17} />}
                    placeholder="ketik username akun"
                    autoComplete="username"
                    filling={filling === "username"}
                    onEnter={submitStaff}
                  />
                  <AuthField
                    ref={passRef}
                    label="Password"
                    type="password"
                    value={password}
                    onChange={(v) => { setPassword(v); setError(""); }}
                    icon={<ILock size={17} />}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    filling={filling === "password"}
                    error={error}
                    hint={hint}
                    onEnter={submitStaff}
                  />

                  <Button type="submit" className="w-full py-3.5" disabled={busy || !!filling}>
                    {busy ? "Memverifikasi…" : filling ? "Mengisi akun…" : <>Masuk staf <IArrowRight size={16} /></>}
                  </Button>

                  <div className="pt-4 border-t border-line">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-faint flex items-center gap-1.5">
                      <IUsers size={12} /> Akun terdaftar — klik untuk isi otomatis
                    </p>
                    {accounts.length === 0 ? (
                      <p className="text-[11px] text-amber mt-3 flex gap-1.5">
                        <IAlert size={13} className="shrink-0 mt-0.5" /> Belum ada akun aktif.
                      </p>
                    ) : (
                      <div className="grid gap-2 mt-2.5">
                        {accounts.map((u) => {
                          const on = picked === u.id;
                          const pw = demoPasswordOf(u);
                          const color = u.role === "admin" ? "var(--accent)" : "var(--amber)";
                          return (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => autoFillStaff(u)}
                              className="group relative flex items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-all duration-300 active:scale-[.98] overflow-hidden"
                              style={{
                                borderColor: on ? color : "var(--line)",
                                background: on ? `color-mix(in srgb, ${color} 10%, var(--surface))` : "var(--surface)",
                                boxShadow: on ? `0 12px 30px -18px ${color}` : "none",
                              }}
                            >
                              <span
                                className="w-9 h-9 rounded-xl grid place-items-center shrink-0 transition-transform duration-300 group-hover:scale-110"
                                style={{
                                  color: on ? "var(--accent-ink)" : color,
                                  background: on
                                    ? `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 60%, #000))`
                                    : `color-mix(in srgb, ${color} 14%, transparent)`,
                                }}
                              >
                                {u.role === "admin" ? <IShield size={16} /> : <IRegister size={16} />}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block text-xs font-bold truncate">{u.name}</span>
                                <span className="block text-[10px] text-faint font-mono truncate">
                                  @{u.username} · {pw ? "password bawaan terdeteksi" : "password khusus"}
                                </span>
                              </span>
                              <span className="text-[10px] font-bold shrink-0" style={{ color: on ? color : "var(--faint)" }}>
                                {on ? (filling ? "mengetik…" : pw ? "terisi ✓" : "isi password") : <IArrowRight size={14} />}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </form>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-2.5">
                    <span className="w-10 h-10 rounded-xl grid place-items-center" style={{ color: "var(--violet)", background: "color-mix(in srgb, var(--violet) 14%, transparent)" }}>
                      <IHeart size={19} />
                    </span>
                    <div>
                      <h2 className="font-display font-bold text-lg leading-none">Masuk portal member</h2>
                      <p className="text-[11px] text-faint mt-1">Gunakan username & PIN yang dibuatkan kasir</p>
                    </div>
                  </div>

                  <MemberLoginForm embedded redirect="/memberku" />
                </div>
              )}
            </div>
          )}
        </section>
      </main>

      <footer className="relative z-10 px-5 md:px-8 py-4 border-t border-line text-[10px] text-faint flex flex-wrap gap-x-4 gap-y-1 justify-between">
        <span>{state.settings.brandName} · {state.settings.brandTagline}</span>
        <Link href="/beranda" className="hover:text-accent font-bold">Lihat halaman pelanggan →</Link>
      </footer>
    </div>
  );
}