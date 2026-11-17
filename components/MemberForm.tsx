"use client";

import { useEffect, useMemo, useState } from "react";
import type { Customer } from "@/lib/types";
import { useAuth, useStore } from "@/lib/store";
import { useToast } from "./Toasts";
import { sfx } from "@/lib/sound";
import { dateShort, num, uid } from "@/lib/format";
import { hashPassword } from "@/lib/auth";
import { TIER_COLOR, initials, makeMemberNo, normalizePhone, tierOf, totalTierPct, validateMember } from "@/lib/member";
import { Badge, Button, Field, Input, Modal, Textarea, Toggle } from "./ui";
import { ICheckCircle, IHeart, IIdCard, IInfo, IKey, IPhone, IStar } from "./icons";

export function MemberForm({ open, edit, onClose, onSaved }: {
  open: boolean; edit: Customer | null; onClose: () => void; onSaved?: (c: Customer) => void;
}) {
  const { state, dispatch } = useStore();
  const { user, isAdmin } = useAuth();
  const { push } = useToast();
  const s = state.settings;

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [notes, setNotes] = useState("");
  const [active, setActive] = useState(true);
  const [portal, setPortal] = useState(true);
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setName(edit?.name ?? "");
    setPhone(edit?.phone === "-" ? "" : edit?.phone ?? "");
    setEmail(edit?.email ?? "");
    setBirthDate(edit?.birthDate ?? "");
    setNotes(edit?.notes ?? "");
    setActive(edit?.memberActive !== false);
    setPortal(edit?.portal !== false);
    setPin(""); setPin2("");
    setErrors({});
  }, [open, edit]);

  const previewNo = useMemo(() => edit?.memberNo ?? makeMemberNo(state.customers), [edit, state.customers]);
  const tier = tierOf(edit?.spend ?? 0, s);

  const save = () => {
    const e = validateMember({ name, phone, email, birthDate }, state.customers, edit?.id);

    // PIN dibuat / diketik oleh kasir
    if (!edit) {
      if (!/^\d{4,8}$/.test(pin)) e.pin = "PIN wajib 4–8 digit angka";
      else if (pin !== pin2) e.pin2 = "Ulangan PIN tidak sama";
    } else if (pin || pin2) {
      if (!/^\d{4,8}$/.test(pin)) e.pin = "PIN baru harus 4–8 digit angka";
      else if (pin !== pin2) e.pin2 = "Ulangan PIN tidak sama";
    }

    setErrors(e);
    if (Object.keys(e).length) { sfx.error(); return; }

    const pinHash = pin ? hashPassword(pin) : edit?.pinHash;

    const base: Customer = edit ?? {
      id: uid(), name: "", phone: "", member: true,
      memberNo: previewNo,
      points: Math.max(0, Math.round(s.memberWelcomePoints)),
      visits: 0, spend: 0, joinedAt: Date.now(),
      createdBy: user?.id, createdByName: user?.name,
    };

    const next: Customer = {
      ...base,
      name: name.trim(),
      phone: normalizePhone(phone),
      member: true,
      memberNo: base.memberNo ?? previewNo,
      email: email.trim(),
      birthDate,
      notes: notes.trim(),
      memberActive: active,
      portal: portal,
      pinHash,
      joinedAt: base.joinedAt ?? Date.now(),
      points: base.points ?? 0, visits: base.visits ?? 0, spend: base.spend ?? 0,
      createdBy: base.createdBy ?? user?.id, createdByName: base.createdByName ?? user?.name,
    };

    dispatch({ type: edit ? "UPDATE_CUSTOMER" : "ADD_CUSTOMER", customer: next });
    sfx.success();
    push({
      msg: edit
        ? `Member ${next.name} diperbarui${pin ? " · PIN diganti" : ""}`
        : `Member baru ${next.name} · ${next.memberNo} · PIN dibuat oleh kasir`,
      type: "ok",
    });
    onSaved?.(next);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} wide
      title={
        <span className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-xl grid place-items-center text-[11px] font-bold grad-accent text-accent-ink">{initials(name || "Member Baru")}</span>
          {edit ? `Edit member · ${edit.memberNo}` : "Daftarkan member baru"}
        </span>
      }
      footer={
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-faint hidden sm:flex items-center gap-1.5"><IInfo size={12} /> PIN diketik kasir · benefit diatur admin</span>
          <div className="flex gap-2 ml-auto">
            <Button variant="ghost" onClick={onClose}>Batal</Button>
            <Button onClick={save}><IHeart size={15} /> {edit ? "Simpan member" : "Daftarkan member"}</Button>
          </div>
        </div>
      }>
      <div className="space-y-4">
        <div className="rounded-2xl border p-4 flex flex-wrap items-center gap-3"
          style={{ borderColor: "color-mix(in srgb, var(--violet) 32%, transparent)", background: "color-mix(in srgb, var(--violet) 8%, transparent)" }}>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-faint">Kartu member digital</p>
            <p className="font-display font-bold text-xl mt-0.5" style={{ color: "var(--violet)" }}>{previewNo}</p>
            <p className="text-[11px] text-mute mt-0.5">
              {edit
                ? `Bergabung ${dateShort(edit.joinedAt ?? Date.now())} · belanja ${rupiah(edit.spend ?? 0)} · ${num(edit.points ?? 0)} poin`
                : `Langsung dapat ${num(s.memberWelcomePoints)} poin sambutan + PIN untuk login portal`}
            </p>
          </div>
          <div className="ml-auto flex flex-col items-end gap-1.5">
            <Badge color={TIER_COLOR[tier]}><IStar size={10} /> {tier}</Badge>
            <span className="text-[10px] font-bold text-pandan">potongan {totalTierPct(tier, s)}%</span>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Nama lengkap *" error={errors.name}>
            <Input value={name} autoFocus placeholder="cth. Sari Wulandari" onChange={(e) => { setName(e.target.value); setErrors((p) => ({ ...p, name: "" })); }} />
          </Field>
          <Field label="Nomor HP *" error={errors.phone} hint="Dipakai untuk login portal member">
            <Input value={phone} inputMode="tel" placeholder="0812xxxxxxx" onChange={(e) => { setPhone(e.target.value); setErrors((p) => ({ ...p, phone: "" })); }} />
          </Field>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Email" error={errors.email} hint="Opsional">
            <Input value={email} type="email" placeholder="nama@mail.com" onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: "" })); }} />
          </Field>
          <Field label="Tanggal lahir" error={errors.birthDate} hint={`Bonus ulang tahun +${s.memberBirthdayPct}%`}>
            <Input value={birthDate} type="date" onChange={(e) => { setBirthDate(e.target.value); setErrors((p) => ({ ...p, birthDate: "" })); }} />
          </Field>
        </div>

        {/* PIN — diketik kasir */}
        <div className="rounded-2xl border p-4 space-y-3"
          style={{ borderColor: "color-mix(in srgb, var(--laut) 34%, transparent)", background: "color-mix(in srgb, var(--laut) 7%, transparent)" }}>
          <p className="text-xs font-bold flex items-center gap-1.5"><IKey size={14} className="text-laut" /> {edit ? "Ganti PIN (opsional)" : "Buat PIN akses portal"}</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label={edit ? "PIN baru" : "PIN member"} error={errors.pin} hint="4–8 digit angka">
              <Input value={pin} type="password" inputMode="numeric" placeholder={edit ? "Kosongkan bila tidak diganti" : "cth. 246810"}
                onChange={(e) => { setPin(e.target.value); setErrors((p) => ({ ...p, pin: "", pin2: "" })); }} />
            </Field>
            <Field label="Ulangi PIN" error={errors.pin2}>
              <Input value={pin2} type="password" inputMode="numeric" placeholder="Ketik ulang PIN"
                onChange={(e) => { setPin2(e.target.value); setErrors((p) => ({ ...p, pin2: "" })); }} />
            </Field>
          </div>
          <p className="text-[11px] text-mute flex gap-1.5">
            <IIdCard size={13} className="shrink-0 mt-0.5 text-laut" />
            {edit ? "Isi hanya jika member minta ganti PIN. Kosongkan untuk memakai PIN lama." : "Beritahu PIN ini ke member — dipakai login di Portal Member dengan nomor HP di atas."}
          </p>
        </div>

        <Field label="Catatan preferensi" hint="Contoh: less sugar, alergi kacang, biasa pesan rombongan">
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Preferensi pelanggan…" />
        </Field>

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-3">
            <div><p className="text-sm font-bold">Member aktif</p><p className="text-[11px] text-faint">Bisa belanja & dapat benefit</p></div>
            <Toggle checked={active} onChange={setActive} label="Member aktif" />
          </div>
          <div className="flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-3">
            <div><p className="text-sm font-bold">Akses portal member</p><p className="text-[11px] text-faint">Member bisa login mandiri</p></div>
            <Toggle checked={portal} onChange={setPortal} label="Portal member" />
          </div>
        </div>

        <div className="rounded-xl border border-line bg-surface p-3 text-[11px] text-mute space-y-1.5">
          <p className="font-bold text-ink text-xs flex items-center gap-1.5"><ICheckCircle size={13} className="text-pandan" /> Benefit yang langsung berlaku</p>
          <p className="flex items-center gap-1.5"><IStar size={12} className="text-amber" /> Potongan dasar {s.memberDiscountPct}% + bonus tier dari akumulasi belanja</p>
          <p className="flex items-center gap-1.5"><IHeart size={12} className="text-chili" /> 1 poin tiap {rupiah(Math.max(100, s.memberPointRate))} belanja · bisa ditukar hadiah</p>
          <p className="flex items-center gap-1.5"><IPhone size={12} className="text-laut" /> Login portal: nomor HP + PIN yang kamu buat di atas</p>
          <p className="text-faint">{isAdmin ? "Sebagai administrator kamu juga bisa mengubah angka benefit di Pengaturan → Program Member." : "Angka benefit ditetapkan administrator."}</p>
        </div>
      </div>
    </Modal>
  );
}

function rupiah(n: number) {
  return "Rp " + Math.round(n).toLocaleString("id-ID");
}