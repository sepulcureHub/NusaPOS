"use client";

import { useMemo, useState } from "react";
import type { Customer } from "@/lib/types";
import { useStore } from "@/lib/store";
import { sfx } from "@/lib/sound";
import { num } from "@/lib/format";
import { TIER_COLOR, initials, memberDiscountPct, normalizePhone, tierOf } from "@/lib/member";
import { Badge, Button, Drawer, EmptyState } from "./ui";
import { SearchField } from "./SearchField";
import { MemberBenefitsModal } from "./MemberBenefits";
import { IHeart, IInfo, IPhone, IStar, IUser, IUserPlus, IX } from "./icons";

export function MemberPicker({ open, onClose, onPick, onRegister, currentId }: {
  open: boolean; onClose: () => void; onPick: (c: Customer) => void; onRegister: () => void; currentId: string;
}) {
  const { state } = useStore();
  const s = state.settings;
  const [q, setQ] = useState("");
  const [onlyMember, setOnlyMember] = useState(true);
  const [benefitOpen, setBenefitOpen] = useState(false);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const digits = normalizePhone(q);
    return state.customers
      .filter((c) => (onlyMember ? c.member : true))
      .filter((c) => {
        if (!needle) return true;
        return c.name.toLowerCase().includes(needle)
          || (c.memberNo ?? "").toLowerCase().includes(needle)
          || (digits.length >= 3 && normalizePhone(c.phone).includes(digits));
      })
      .sort((a, b) => (b.spend ?? 0) - (a.spend ?? 0))
      .slice(0, 40);
  }, [state.customers, q, onlyMember]);

  return (
    <>
      <Drawer open={open} onClose={onClose} title="Pilih pelanggan / member"
        footer={
          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={() => { onPick(state.customers[0]); onClose(); }}>
              <IUser size={15} /> Pelanggan umum
            </Button>
            <Button className="flex-1" onClick={() => { onClose(); onRegister(); }}>
              <IUserPlus size={15} /> Daftar member baru
            </Button>
          </div>
        }>
        <div className="space-y-3">
          <SearchField value={q} onChange={setQ} size="md" autoFocus count={list.length} countLabel="orang"
            placeholder="Cari nama, nomor HP, atau No. member…" ariaLabel="Cari member" onEscape={() => setQ("")} />
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => { setOnlyMember(true); sfx.tap(); }} className={`chip ${onlyMember ? "chip-on" : ""}`}>
              <IHeart size={12} /> Member saja
            </button>
            <button onClick={() => { setOnlyMember(false); sfx.tap(); }} className={`chip ${!onlyMember ? "chip-on" : ""}`}>
              Semua pelanggan
            </button>
            <button onClick={() => { setBenefitOpen(true); sfx.tap(); }} className="chip ml-auto">
              <IInfo size={12} /> Benefit member
            </button>
          </div>

          {list.length === 0 ? (
            <EmptyState emoji="🧑‍🤝‍🧑" title="Tidak ada yang cocok" desc="Coba nomor HP lain, atau daftarkan member baru.">
              <Button size="sm" onClick={() => { onClose(); onRegister(); }}><IUserPlus size={14} /> Daftar member</Button>
            </EmptyState>
          ) : (
            <ul className="space-y-2">
              {list.map((c) => {
                const tier = tierOf(c.spend ?? 0, s);
                const pct = memberDiscountPct(c, s);
                const on = c.id === currentId;
                return (
                  <li key={c.id}>
                    <button onClick={() => { onPick(c); sfx.add(); onClose(); }}
                      className="w-full text-left rounded-2xl border p-3 flex items-center gap-3 transition-colors"
                      style={{ borderColor: on ? "var(--accent)" : "var(--line)", background: on ? "var(--accent-soft)" : "var(--surface)" }}>
                      <span className="w-10 h-10 rounded-xl grid place-items-center text-[11px] font-bold shrink-0"
                        style={{ color: c.member ? TIER_COLOR[tier] : "var(--muted)", background: `color-mix(in srgb, ${c.member ? TIER_COLOR[tier] : "var(--muted)"} 15%, transparent)` }}>
                        {initials(c.name)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-bold truncate">{c.name}</span>
                        <span className="flex items-center gap-1.5 text-[10px] text-faint font-mono mt-0.5">
                          <IPhone size={10} /> {c.phone}
                          {c.memberNo && <span>· {c.memberNo}</span>}
                        </span>
                      </span>
                      <span className="text-right shrink-0">
                        {c.member ? (
                          <>
                            <Badge color={TIER_COLOR[tier]}><IStar size={9} /> {tier}</Badge>
                            <span className="block text-[10px] text-mute mt-1">{num(c.spend ?? 0)} belanja</span>
                            {pct > 0 && <span className="block text-[10px] font-bold text-pandan">−{pct}%</span>}
                          </>
                        ) : (
                          <span className="text-[10px] text-faint">non-member</span>
                        )}
                      </span>
                      {on && <IX size={13} className="text-accent shrink-0" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <p className="text-[10px] text-faint leading-relaxed">
            Tier dihitung dari akumulasi belanja, poin untuk ditukar hadiah. Benefit diatur admin dan diterapkan otomatis di kasir.
          </p>
        </div>
      </Drawer>

      <MemberBenefitsModal open={benefitOpen} onClose={() => setBenefitOpen(false)} settings={s}
        roleNote="Tier member naik otomatis dari total belanja. Poin bisa ditukar hadiah di katalog yang diatur admin." />
    </>
  );
}