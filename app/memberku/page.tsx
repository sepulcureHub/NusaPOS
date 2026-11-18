"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { useToast } from "@/components/Toasts";
import { sfx } from "@/lib/sound";
import type { Customer } from "@/lib/types";
import { dateShort, num, rupiah, timeID } from "@/lib/format";
import { hashPassword } from "@/lib/auth";
import {
  TIER_COLOR, initials, isBirthday, memberDiscountPct, nextTier, normalizeUsername,
  tierOf, tierProgress, totalTierPct,
} from "@/lib/member";
import { MemberLoginForm } from "@/components/MemberAuth";
import { BrandLockup } from "@/components/Brand";
import { Badge, Button, Confirm, EmptyState, Field, Input, Modal, PageSkel, Segmented } from "@/components/ui";
import {
  ICalendar, ICheckCircle, IClock, IGift, IHeart, IInfo, ILogOut,
  IReceipt, IShield, IStar, IUser,
} from "@/components/icons";
import { IHistory } from "@/components/icons-extra";
import { MemberBenefitsPanel } from "@/components/MemberBenefits";

function MemberCode({ value }: { value: string }) {
  const cells = useMemo(() => {
    let h = 7;
    const arr: boolean[] = [];
    for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) >>> 0;
    let x = h;
    for (let i = 0; i < 25 * 25; i++) {
      x = (x * 1103515245 + 12345) >>> 0;
      arr.push(((x >> 16) & 1) === 1);
    }
    return arr;
  }, [value]);
  return (
    <svg viewBox="0 0 25 25" className="w-28 h-28 rounded-lg bg-white p-1.5" aria-label="Kode member">
      {cells.map((on, i) => (on ? <rect key={i} x={i % 25} y={Math.floor(i / 25)} width={1} height={1} fill="#111" /> : null))}
    </svg>
  );
}

export default function MemberKuPage() {
  return (
    <Suspense fallback={<PageSkel />}>
      <Portal />
    </Suspense>
  );
}

function Portal() {
  const { state, dispatch } = useStore();
  const { push } = useToast();
  const router = useRouter();
  const s = state.settings;
  const me = state.memberSession ? state.customers.find((c) => c.id === state.memberSession!.customerId) ?? null : null;

  const [tab, setTab] = useState<"ringkasan" | "poin" | "transaksi" | "profil">("ringkasan");
  const [redeem, setRedeem] = useState<string | null>(null);
  const [changePin, setChangePin] = useState(false);

  useEffect(() => { document.title = `Member · ${s.storeName}`; }, [s.storeName]);

  if (!state.hydrated) return <PageSkel />;

  /* ---------- LOGIN MEMBER ---------- */
  if (!me) {
    return (
      <div className="relative min-h-dvh grid place-items-center px-4 py-10">
        <div className="aurora" aria-hidden><i /><i /><i /></div>
        <div className="grain" aria-hidden />
        <div className="relative z-10 w-full max-w-md">
          <div className="card p-6 md:p-7">
            <div className="flex justify-center"><BrandLockup settings={s} size={34} /></div>
            <h1 className="font-display font-bold text-2xl text-center mt-5">Portal Member</h1>
            <p className="text-sm text-mute text-center mt-1.5 leading-relaxed">
              Masuk memakai <b className="text-ink">username</b> dan <b className="text-ink">PIN</b> yang dibuatkan kasir saat kamu mendaftar.
            </p>

            <div className="mt-6">
              <MemberLoginForm redirect={null} />
            </div>

            <div className="flex justify-center gap-4 mt-5">
              <Link href="/login" className="text-[11px] font-bold text-accent hover:underline">Login terpadu (staf & member)</Link>
              <Link href="/beranda" className="text-[11px] font-bold text-mute hover:underline">← Halaman kedai</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ---------- DASHBOARD MEMBER ---------- */
  const tier = tierOf(me.spend ?? 0, s);
  const nt = nextTier(me.spend ?? 0, s);
  const pct = memberDiscountPct(me, s);
  const myTx = state.transactions.filter((t) => t.customerId === me.id && !t.isTest).sort((a, b) => b.ts - a.ts);
  const myRedemptions = state.redemptions.filter((r) => r.customerId === me.id);
  const rewards = state.rewards.filter((r) => r.active);
  const bday = isBirthday(me);

  const doRedeem = () => {
    const r = rewards.find((x) => x.id === redeem);
    if (!r) return;
    if ((me.points ?? 0) < r.cost) { push({ msg: `Poin belum cukup untuk ${r.name}`, type: "err" }); sfx.error(); return; }
    dispatch({ type: "REDEEM_POINTS", customerId: me.id, rewardId: r.id, by: me.name, channel: "portal" });
    sfx.success();
    push({ msg: `${r.name} berhasil ditukar · −${r.cost} poin. Tunjukkan ke kasir untuk dipakai.`, type: "ok", dur: 6000 });
    setRedeem(null);
  };

  return (
    <div className="relative min-h-dvh pb-16">
      <div className="aurora" aria-hidden><i /><i /><i /></div>
      <div className="grain" aria-hidden />

      <header className="relative z-10 border-b border-line bg-bg/85 backdrop-blur-xl">
        <div className="mx-auto max-w-[900px] px-4 md:px-6 h-16 flex items-center gap-3">
          <a href="/beranda" className="shrink-0"><BrandLockup settings={s} size={28} compact /></a>
          <Badge color="var(--violet)"><IUser size={10} /> Portal member</Badge>
          <div className="ml-auto flex items-center gap-2">
            {bday && <Badge color="var(--magenta)">🎂 Hari ini ulang tahunmu!</Badge>}
            <Button variant="ghost" size="sm" onClick={() => { dispatch({ type: "MEMBER_LOGOUT" }); sfx.remove(); router.replace("/login"); }}>
              <ILogOut size={14} /> Keluar
            </Button>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-[900px] px-4 md:px-6 mt-6 space-y-5">
        <div className="card overflow-hidden rise" style={{ borderColor: `color-mix(in srgb, ${TIER_COLOR[tier]} 40%, transparent)` }}>
          <div className="p-5 md:p-6 flex flex-wrap gap-5 items-center"
            style={{ background: `linear-gradient(135deg, color-mix(in srgb, ${TIER_COLOR[tier]} 16%, var(--surface)), var(--surface) 55%, color-mix(in srgb, var(--violet) 10%, var(--surface)))` }}>
            <span className="w-16 h-16 rounded-2xl grid place-items-center text-xl font-bold shrink-0"
              style={{ color: TIER_COLOR[tier], background: `color-mix(in srgb, ${TIER_COLOR[tier]} 18%, transparent)` }}>
              {initials(me.name)}
            </span>
            <div className="min-w-0">
              <p className="font-display font-bold text-xl leading-tight">{me.name}</p>
              <p className="text-[11px] text-faint font-mono">@{me.username ?? me.memberNo} · {me.phone}</p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                <Badge color={TIER_COLOR[tier]}><IStar size={10} /> {tier}</Badge>
                {pct > 0 && <Badge color="var(--pandan)">potongan {pct}%</Badge>}
                <Badge color="var(--violet)">{num(me.points ?? 0)} poin</Badge>
              </div>
            </div>
            <div className="ml-auto hidden sm:block"><MemberCode value={me.memberNo ?? me.id} /></div>
          </div>

          <div className="p-5 md:p-6">
            <div className="flex items-center justify-between text-[11px] font-bold">
              <span className="text-mute">Progres menuju {nt ? nt.tier : "tier tertinggi"}</span>
              <span className="text-faint">{nt ? `butuh belanja ${rupiah(nt.need)} lagi` : "Platinum tercapai"}</span>
            </div>
            <div className="h-2.5 rounded-full bg-surface2 mt-2 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${tierProgress(me.spend ?? 0, s)}%`, background: TIER_COLOR[tier] }} />
            </div>
            <p className="text-[11px] text-faint mt-2">
              Total belanja kumulatif <b className="text-ink">{rupiah(me.spend ?? 0)}</b>. Tier naik otomatis saat melewati ambang yang diatur kedai.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
              {[
                { l: "Poin tersedia", v: num(me.points ?? 0), c: "var(--violet)", i: <IStar size={15} /> },
                { l: "Total belanja", v: rupiah(me.spend ?? 0), c: "var(--accent)", i: <IReceipt size={15} /> },
                { l: "Kunjungan", v: num(me.visits ?? 0), c: "var(--laut)", i: <IClock size={15} /> },
                { l: "Berikutnya", v: nt ? `→ ${nt.tier}` : "Maks", c: "var(--amber)", i: <IStar size={15} /> },
              ].map((x) => (
                <div key={x.l} className="rounded-xl border border-line bg-surface p-3">
                  <span className="w-7 h-7 rounded-lg grid place-items-center" style={{ color: x.c, background: `color-mix(in srgb, ${x.c} 14%, transparent)` }}>{x.i}</span>
                  <p className="text-[10px] text-faint font-bold uppercase tracking-wider mt-2">{x.l}</p>
                  <p className="font-display font-bold text-base mt-0.5 tabular-nums truncate" style={{ color: x.c }}>{x.v}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <Segmented value={tab} onChange={(v) => setTab(v as typeof tab)} className="w-full justify-center"
          options={[
            { v: "ringkasan", l: <>Ringkasan</> },
            { v: "poin", l: <><IGift size={13} /> Poin & Hadiah</> },
            { v: "transaksi", l: <><IReceipt size={13} /> Transaksi</> },
            { v: "profil", l: <><IUser size={13} /> Profil</> },
          ]} />

        {tab === "ringkasan" && (
          <div className="space-y-4">
            <div className="card p-5">
              <h2 className="font-display font-bold text-base flex items-center gap-2"><IHeart size={16} className="text-chili" /> Benefit kamu saat ini</h2>
              <div className="grid sm:grid-cols-3 gap-3 mt-4">
                {[
                  { l: "Potongan tiap belanja", v: `${pct}%`, d: `Dasar ${s.memberDiscountPct}% + bonus tier${bday ? ` + ultah ${s.memberBirthdayPct}%` : ""}` },
                  { l: "Poin bisa ditukar", v: `${num(me.points ?? 0)}`, d: `1 poin / ${rupiah(Math.max(100, s.memberPointRate))} belanja` },
                  { l: "Ulang tahun", v: bday ? "Hari ini! 🎉" : `+${s.memberBirthdayPct}%`, d: "Bonus otomatis di hari H" },
                ].map((x) => (
                  <div key={x.l} className="rounded-xl border border-line bg-surface p-3.5">
                    <p className="text-[10px] text-faint font-bold uppercase tracking-wider">{x.l}</p>
                    <p className="font-display font-bold text-xl mt-1 text-accent">{x.v}</p>
                    <p className="text-[10.5px] text-mute mt-1 leading-snug">{x.d}</p>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-faint mt-3 flex gap-1.5"><IInfo size={13} className="shrink-0 mt-0.5" /> Angka benefit diatur kedai dan berlaku otomatis — cukup sebut username-mu saat di kasir.</p>
            </div>
            <div className="card p-5">
              <h2 className="font-display font-bold text-base mb-3">Semua benefit member</h2>
              <MemberBenefitsPanel settings={s} dense showSteps={false} />
            </div>
          </div>
        )}

        {tab === "poin" && (
          <div className="space-y-4">
            <div className="card p-5">
              <div className="flex items-center justify-between gap-2 mb-3">
                <h2 className="font-display font-bold text-base flex items-center gap-2"><IGift size={16} className="text-violet" /> Katalog hadiah</h2>
                <Badge color="var(--violet)">{num(me.points ?? 0)} poin</Badge>
              </div>
              {rewards.length === 0 ? (
                <EmptyState emoji="🎁" title="Belum ada hadiah" desc="Kedai belum menambahkan katalog hadiah. Coba lagi nanti." />
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {rewards.map((r) => {
                    const enough = (me.points ?? 0) >= r.cost;
                    return (
                      <div key={r.id} className="rounded-2xl border border-line bg-surface p-4 flex flex-col">
                        <div className="text-3xl">{r.emoji}</div>
                        <p className="text-sm font-bold mt-2 leading-tight">{r.name}</p>
                        <p className="text-[11px] text-mute mt-1 leading-snug flex-1">{r.desc}</p>
                        <div className="flex items-center justify-between mt-3">
                          <span className="font-display font-bold text-violet">{num(r.cost)} poin</span>
                          <Button size="sm" variant={enough ? "primary" : "ghost"} disabled={!enough} onClick={() => setRedeem(r.id)}>
                            {enough ? "Tukar" : "Kurang poin"}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <p className="text-[11px] text-faint mt-3 flex gap-1.5"><IInfo size={13} className="shrink-0 mt-0.5" /> Setelah ditukar, tunjukkan riwayat penukaran ke kasir untuk klaim hadiahmu.</p>
            </div>

            <div className="card p-5">
              <h2 className="font-display font-bold text-base mb-3 flex items-center gap-2"><IHistory size={16} className="text-mute" /> Riwayat penukaran</h2>
              {myRedemptions.length === 0 ? (
                <p className="text-[11.5px] text-faint py-4 text-center">Belum ada penukaran. Tukar poin pertamamu di katalog hadiah.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {myRedemptions.map((r) => (
                    <li key={r.id} className="py-2.5 flex items-center gap-3 text-[12px]">
                      <span className="text-xl">{r.rewardEmoji}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-bold truncate">{r.rewardName}</span>
                        <span className="block text-[10.5px] text-faint">{dateShort(r.ts)} {timeID(r.ts)} · via {r.channel}</span>
                      </span>
                      <Badge color="var(--violet)">−{num(r.cost)} poin</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {tab === "transaksi" && (
          <div className="card p-5">
            <h2 className="font-display font-bold text-base mb-3">Riwayat belanja ({myTx.length})</h2>
            {myTx.length === 0 ? (
              <EmptyState emoji="🧾" title="Belum ada transaksi" desc="Transaksimu akan muncul di sini setelah belanja pertama." />
            ) : (
              <ul className="divide-y divide-line">
                {myTx.slice(0, 30).map((t) => (
                  <li key={t.id} className="py-3 flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold w-32 truncate">{t.id}</span>
                    <span className="text-[11px] text-faint">{dateShort(t.ts)} {timeID(t.ts)}</span>
                    <span className="flex gap-1 ml-auto">
                      {(t.memberPoints ?? 0) > 0 && <Badge color="var(--violet)">+{t.memberPoints}</Badge>}
                      {(t.memberDiscount ?? 0) > 0 && <Badge color="var(--pandan)">hemat {rupiah(t.memberDiscount ?? 0)}</Badge>}
                      {t.status === "Refund" && <Badge color="var(--chili)">refund</Badge>}
                    </span>
                    <span className="font-mono font-bold text-sm w-24 text-right">{rupiah(t.total)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {tab === "profil" && <ProfileTab me={me} onChangePin={() => setChangePin(true)} />}
      </main>

      <Confirm open={!!redeem} onClose={() => setRedeem(null)} onConfirm={doRedeem}
        title="Tukar poin dengan hadiah ini?" confirmLabel="Ya, Tukar" danger={false}
        desc={`Poin kamu akan dipotong ${num(rewards.find((r) => r.id === redeem)?.cost ?? 0)}. Hadiah diklaim dengan menunjukkan riwayat ini ke kasir.`} />

      <ChangePinModal open={changePin} onClose={() => setChangePin(false)} me={me} />
    </div>
  );
}

function ProfileTab({ me, onChangePin }: { me: Customer; onChangePin: () => void }) {
  const { state, dispatch } = useStore();
  const { push } = useToast();
  const s = state.settings;

  const [name, setName] = useState(me.name);
  const [username, setUsername] = useState(me.username ?? "");
  const [email, setEmail] = useState(me.email ?? "");
  const [birthDate, setBirthDate] = useState(me.birthDate ?? "");
  const [err, setErr] = useState("");

  const save = () => {
    const uname = normalizeUsername(username);
    if (!/^[a-z0-9._-]{3,20}$/.test(uname)) {
      setErr("Username 3–20 karakter: huruf kecil, angka, titik, - atau _");
      sfx.error();
      return;
    }
    if (state.customers.some((c) => c.member && c.id !== me.id && normalizeUsername(c.username ?? "") === uname)) {
      setErr("Username sudah dipakai member lain");
      sfx.error();
      return;
    }

    dispatch({
      type: "UPDATE_CUSTOMER",
      customer: { ...me, name: name.trim() || me.name, username: uname, email: email.trim(), birthDate },
    });
    sfx.success();
    setErr("");
    push({ msg: "Profil member diperbarui", type: "ok" });
  };

  return (
    <div className="card p-5 space-y-4">
      <h2 className="font-display font-bold text-base">Profil saya</h2>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Nama"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Username portal *" error={err} hint="Dipakai login member">
          <Input value={username} onChange={(e) => { setUsername(e.target.value); setErr(""); }} placeholder="cth. sari.w" />
        </Field>
        <Field label="Nomor HP" hint="Hubungi kasir bila ingin mengubah nomor"><Input value={me.phone} disabled /></Field>
        <Field label="Email"><Input value={email} type="email" onChange={(e) => setEmail(e.target.value)} placeholder="nama@mail.com" /></Field>
        <Field label="Tanggal lahir" hint={`Bonus ${s.memberBirthdayPct}% di hari ulang tahun`}>
          <Input value={birthDate} type="date" onChange={(e) => setBirthDate(e.target.value)} />
        </Field>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={save}>Simpan profil</Button>
        <Button variant="ghost" onClick={onChangePin}><IShield size={15} /> Ganti PIN</Button>
      </div>
      <p className="text-[11px] text-faint flex gap-1.5"><ICheckCircle size={13} className="text-pandan shrink-0 mt-0.5" /> Nomor member: <b className="font-mono">{me.memberNo}</b> · bergabung {me.joinedAt ? dateShort(me.joinedAt) : "-"} · dibuat oleh {me.createdByName ?? "kasir"}</p>
      <div className="rounded-xl border border-line bg-surface p-3">
        <p className="text-xs font-bold mb-2 flex items-center gap-1.5"><IStar size={13} className="text-amber" /> Kalender benefit</p>
        <p className="text-[11px] text-mute leading-relaxed flex items-center gap-1.5">
          <ICalendar size={13} className="text-accent" />
          {me.birthDate ? `Ulang tahun: ${dateShort(new Date(me.birthDate).getTime())} — bonus +${s.memberBirthdayPct}% otomatis di hari itu.` : "Isi tanggal lahir di atas supaya bonus ulang tahun aktif."}
        </p>
      </div>
    </div>
  );
}

function ChangePinModal({ open, onClose, me }: { open: boolean; onClose: () => void; me: Customer }) {
  const { dispatch } = useStore();
  const { push } = useToast();
  const [oldPin, setOldPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => { if (open) { setOldPin(""); setNewPin(""); setConfirmPin(""); setErr(""); } }, [open]);

  const save = () => {
    if (!me.pinHash || hashPassword(oldPin) !== me.pinHash) { setErr("PIN lama salah."); sfx.error(); return; }
    if (!/^\d{4,8}$/.test(newPin)) { setErr("PIN baru harus 4–8 digit angka."); sfx.error(); return; }
    if (newPin !== confirmPin) { setErr("Konfirmasi PIN tidak sama."); sfx.error(); return; }
    dispatch({ type: "UPDATE_CUSTOMER", customer: { ...me, pinHash: hashPassword(newPin) } });
    sfx.success();
    push({ msg: "PIN member berhasil diganti", type: "ok" });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Ganti PIN member"
      footer={<div className="flex gap-2 justify-end"><Button variant="ghost" onClick={onClose}>Batal</Button><Button onClick={save}>Ganti PIN</Button></div>}>
      <div className="space-y-4">
        <Field label="PIN lama" error={err}><Input type="password" inputMode="numeric" value={oldPin} onChange={(e) => { setOldPin(e.target.value); setErr(""); }} autoFocus /></Field>
        <Field label="PIN baru" hint="4–8 digit angka"><Input type="password" inputMode="numeric" value={newPin} onChange={(e) => { setNewPin(e.target.value); setErr(""); }} /></Field>
        <Field label="Ulangi PIN baru"><Input type="password" inputMode="numeric" value={confirmPin} onChange={(e) => { setConfirmPin(e.target.value); setErr(""); }} /></Field>
      </div>
    </Modal>
  );
}