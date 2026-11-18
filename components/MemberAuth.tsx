"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore, verifyMemberPin } from "@/lib/store";
import { useToast } from "./Toasts";
import { sfx } from "@/lib/sound";
import { DEMO_MEMBER_PIN } from "@/lib/demo-data";
import { initials } from "@/lib/member";
import { relTime } from "@/lib/format";
import {
  clearMemberLogins,
  loadSavedMemberLogins,
  removeMemberLogin,
  saveMemberLogin,
  type SavedMemberLogin,
} from "@/lib/member-login";
import { AuthField } from "./AuthField";
import { Badge, Button, IconBtn } from "./ui";
import { IAlert, IArrowRight, ICheck, ICheckCircle, IHeart, ILock, ITrash, IUser } from "./icons";

export function MemberLoginForm({
  embedded = false,
  redirect = "/memberku",
}: {
  embedded?: boolean;
  redirect?: string | null;
}) {
  const { state, dispatch } = useStore();
  const { push } = useToast();
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [remember, setRemember] = useState(false);
  const [saved, setSaved] = useState<SavedMemberLogin[]>([]);

  useEffect(() => {
    setSaved(loadSavedMemberLogins());
  }, []);

  const demoMember = useMemo(
    () => state.customers.find((c) => c.member && c.pinHash && c.username),
    [state.customers]
  );

  const runLogin = (u: string, p: string, rememberIt: boolean) => {
    if (busy) return;
    if (!u.trim() || !p.trim()) {
      setErr("Username dan PIN wajib diisi.");
      sfx.error();
      return;
    }

    setBusy(true);
    setErr("");

    setTimeout(() => {
      const c = verifyMemberPin(state, u, p);
      if (!c) {
        setBusy(false);
        setErr("Username atau PIN salah, atau member belum diaktifkan.");
        sfx.error();
        return;
      }

      dispatch({ type: "MEMBER_LOGIN", customerId: c.id });

      if (rememberIt) {
        const next = saveMemberLogin({
          username: c.username ?? u,
          pin: p,
          name: c.name,
          memberNo: c.memberNo,
        });
        setSaved(next);
      }

      sfx.success();
      push({ msg: `Halo, ${c.name} — selamat datang di portal member`, type: "ok" });
      setBusy(false);
      setPin("");

      if (redirect) router.replace(redirect);
    }, 360);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    runLogin(username, pin, remember);
  };

  const quickLogin = (s: SavedMemberLogin) => {
    setUsername(s.username);
    setPin(s.pin);
    runLogin(s.username, s.pin, true);
  };

  const fillDemo = () => {
    if (!demoMember) return;
    setUsername(demoMember.username ?? "");
    setPin(DEMO_MEMBER_PIN);
    setErr("");
    sfx.tap();
  };

  const removeSaved = (id: string) => {
    removeMemberLogin(id);
    setSaved(loadSavedMemberLogins());
    sfx.remove();
    push({ msg: "Login tersimpan dihapus dari perangkat", type: "info" });
  };

  const clearAll = () => {
    clearMemberLogins();
    setSaved([]);
    sfx.remove();
    push({ msg: "Semua login tersimpan dibersihkan", type: "info" });
  };

  return (
    <div className={embedded ? "space-y-4" : "space-y-5"}>
      <form onSubmit={submit} className="space-y-3.5">
        <AuthField
          label="Username member"
          value={username}
          onChange={(v) => { setUsername(v); setErr(""); }}
          icon={<IUser size={17} />}
          placeholder="cth. siti"
          autoComplete="username"
        />

        <AuthField
          label="PIN"
          type="password"
          value={pin}
          onChange={(v) => { setPin(v); setErr(""); }}
          icon={<ILock size={17} />}
          placeholder="••••••"
          inputMode="numeric"
          autoComplete="current-password"
          error={err}
          onEnter={() => runLogin(username, pin, remember)}
        />

        <div className="flex items-center justify-between gap-3 pt-1">
          <button
            type="button"
            onClick={() => { setRemember((v) => !v); sfx.tap(); }}
            className="group inline-flex items-center gap-2 text-[11.5px] font-bold text-mute hover:text-ink transition-colors"
            aria-pressed={remember}
          >
            <span
              className={`w-5 h-5 rounded-lg border grid place-items-center transition-all ${
                remember ? "border-accent bg-accent text-accent-ink" : "border-line2 bg-surface group-hover:border-accent"
              }`}
            >
              {remember && <ICheck size={13} />}
            </span>
            Simpan login di perangkat ini
          </button>

          {demoMember && (
            <button
              type="button"
              onClick={fillDemo}
              className="text-[10.5px] font-bold text-accent hover:underline"
            >
              Isi akun demo
            </button>
          )}
        </div>

        <Button
          type="submit"
          className="w-full py-3.5"
          disabled={busy}
          style={{ background: "linear-gradient(135deg, var(--violet), color-mix(in srgb, var(--violet) 65%, #000))" }}
        >
          {busy ? "Memverifikasi…" : <>Masuk portal member <IArrowRight size={16} /></>}
        </Button>
      </form>

      <div className="rounded-2xl border border-line bg-surface p-3.5">
        <div className="flex items-center gap-2 mb-2.5">
          <IHeart size={15} className="text-violet" />
          <p className="text-xs font-bold">Login tersimpan</p>
          <Badge color="var(--violet)">{saved.length}</Badge>
          {saved.length > 0 && (
            <button onClick={clearAll} className="ml-auto text-[10px] font-bold text-faint hover:text-chili transition-colors">
              Hapus semua
            </button>
          )}
        </div>

        {saved.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line2 bg-bg2/50 p-4 text-center">
            <p className="text-[11px] font-bold text-mute">Belum ada login tersimpan</p>
            <p className="text-[10px] text-faint mt-1 leading-snug">
              Centang <b className="text-ink">Simpan login</b> saat masuk, lalu lain kali cukup klik akun tersimpan.
            </p>
            {demoMember && (
              <Button variant="ghost" size="sm" className="mt-3" onClick={fillDemo}>
                <IUser size={13} /> Coba @{demoMember.username}
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-2">
            {saved.map((s) => (
              <div
                key={s.id}
                className="rounded-xl border border-line bg-bg2 p-2.5 flex items-center gap-2.5 hover:border-line2 transition-colors"
              >
                <span
                  className="w-9 h-9 rounded-xl grid place-items-center text-[10px] font-bold shrink-0"
                  style={{ color: "var(--violet)", background: "color-mix(in srgb, var(--violet) 14%, transparent)" }}
                >
                  {initials(s.name || s.username)}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold truncate">{s.name || s.username}</p>
                  <p className="text-[10px] text-faint font-mono truncate">
                    @{s.username}{s.memberNo ? ` · ${s.memberNo}` : ""}
                  </p>
                  <p className="text-[9px] text-faint mt-0.5">terakhir {relTime(s.updatedAt)}</p>
                </div>

                <Button size="sm" variant="soft" disabled={busy} onClick={() => quickLogin(s)}>
                  <ICheckCircle size={13} /> Masuk
                </Button>

                <IconBtn label="Hapus login tersimpan" className="!p-1.5 hover:!text-chili" onClick={() => removeSaved(s.id)}>
                  <ITrash size={13} />
                </IconBtn>
              </div>
            ))}
          </div>
        )}

        <p className="text-[9.5px] text-faint mt-2.5 leading-snug flex gap-1.5">
          <IAlert size={11} className="shrink-0 mt-0.5" />
          Penyimpanan login ini untuk kenyamanan demo lokal. PIN disimpan ter-enkode sederhana di perangkat, bukan di server.
        </p>
      </div>
    </div>
  );
}