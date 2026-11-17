"use client";

import type { MemberTier, Settings } from "@/lib/types";
import { num, rupiah } from "@/lib/format";
import { TIERS, TIER_COLOR, benefitItems, tierThresholds, totalTierPct } from "@/lib/member";
import { Badge, Button, Modal } from "./ui";
import { IArrowRight, ICalendar, ICheckCircle, IHeart, IInfo, IPercent, IShield, IStar, IUserPlus, IX } from "./icons";

const ICONS = {
  percent: <IPercent size={17} />, star: <IStar size={17} />, heart: <IHeart size={17} />,
  calendar: <ICalendar size={17} />, gift: <IUserPlus size={17} />, shield: <IShield size={17} />,
};

export function TierLadder({ settings, dense }: { settings: Settings; dense?: boolean }) {
  const t = tierThresholds(settings);
  return (
    <div className={`grid gap-2 ${dense ? "grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-4"}`}>
      {TIERS.map((tier, i) => {
        const pct = totalTierPct(tier as MemberTier, settings);
        return (
          <div key={tier} className="rounded-2xl border p-3.5 relative overflow-hidden"
            style={{ borderColor: `color-mix(in srgb, ${TIER_COLOR[tier]} 38%, transparent)`, background: `color-mix(in srgb, ${TIER_COLOR[tier]} 8%, var(--surface))` }}>
            <span className="absolute right-2 top-2 text-[9px] font-mono font-bold text-faint">0{i + 1}</span>
            <span className="w-8 h-8 rounded-lg grid place-items-center"
              style={{ color: TIER_COLOR[tier], background: `color-mix(in srgb, ${TIER_COLOR[tier]} 16%, transparent)` }}>
              <IStar size={15} />
            </span>
            <p className="font-display font-bold text-base mt-2" style={{ color: TIER_COLOR[tier] }}>{tier}</p>
            <p className="text-[10.5px] text-faint mt-0.5">
              {tier === "Bronze" ? "Saat baru mendaftar" : `Belanja kumulatif ${rupiah(t[tier])}`}
            </p>
            <p className="font-display font-bold text-2xl mt-2 tabular-nums">{settings.memberEnabled ? `${pct}%` : "—"}</p>
            <p className="text-[10px] text-mute">potongan tiap belanja</p>
          </div>
        );
      })}
    </div>
  );
}

export function MemberBenefitsPanel({ settings, dense, showSteps = true }: { settings: Settings; dense?: boolean; showSteps?: boolean }) {
  const items = benefitItems(settings);
  return (
    <div className="space-y-4">
      {!settings.memberEnabled && (
        <div className="rounded-xl border p-3 text-[11.5px] flex gap-2"
          style={{ borderColor: "color-mix(in srgb, var(--amber) 40%, transparent)", background: "color-mix(in srgb, var(--amber) 9%, transparent)" }}>
          <IInfo size={14} className="text-amber shrink-0 mt-0.5" />
          <span className="text-mute">Program member sedang <b className="text-ink">dinonaktifkan</b> oleh administrator.</span>
        </div>
      )}

      <div className={`grid gap-3 ${dense ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
        {items.map((b) => (
          <div key={b.key} className="card p-4 h-full">
            <span className="w-9 h-9 rounded-xl grid place-items-center"
              style={{ color: b.color, background: `color-mix(in srgb, ${b.color} 14%, transparent)` }}>{ICONS[b.icon]}</span>
            <p className="text-sm font-bold mt-2.5 leading-tight">{b.title}</p>
            <p className="font-display font-bold text-[15px] mt-1" style={{ color: b.color }}>{b.value}</p>
            <p className="text-[11px] text-mute mt-1.5 leading-relaxed">{b.desc}</p>
          </div>
        ))}
      </div>

      <div>
        <p className="text-xs font-bold text-mute mb-2 flex items-center gap-1.5"><IShield size={13} className="text-accent" /> Tangga tier berdasarkan akumulasi belanja</p>
        <TierLadder settings={settings} dense={dense} />
      </div>

      {showSteps && (
        <div className="rounded-2xl border border-line bg-surface p-4">
          <p className="text-xs font-bold mb-2.5 flex items-center gap-1.5"><IUserPlus size={13} className="text-accent" /> Cara jadi member — gratis</p>
          <ol className="grid sm:grid-cols-3 gap-2.5">
            {[
              { n: "01", t: "Daftar di kasir", d: "Sebutkan nama & nomor HP. Kasir membuatkan kartu member dan PIN akses." },
              { n: "02", t: "Masuk portal member", d: `Login di halaman member pakai nomor HP + PIN, langsung dapat ${num(settings.memberWelcomePoints)} poin sambutan.` },
              { n: "03", t: "Belanja & naik tier", d: "Tier naik otomatis dari akumulasi belanja, poin bisa ditukar hadiah." },
            ].map((x) => (
              <li key={x.n} className="rounded-xl border border-line bg-bg2 p-3">
                <span className="font-mono text-[10px] font-bold text-accent">{x.n}</span>
                <p className="text-xs font-bold mt-1">{x.t}</p>
                <p className="text-[10.5px] text-mute mt-1 leading-snug">{x.d}</p>
              </li>
            ))}
          </ol>
        </div>
      )}

      {settings.memberBenefitNotes.trim() && (
        <p className="text-[11.5px] text-mute leading-relaxed rounded-xl border border-dashed border-line2 p-3">{settings.memberBenefitNotes}</p>
      )}
    </div>
  );
}

export function MemberBenefitsModal({ open, onClose, settings, canConfigure, onConfigure, roleNote }: {
  open: boolean; onClose: () => void; settings: Settings;
  canConfigure?: boolean; onConfigure?: () => void; roleNote?: string;
}) {
  return (
    <Modal open={open} onClose={onClose} wide title="Benefit member pelanggan"
      footer={
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-faint flex items-center gap-1.5"><IShield size={12} /> Benefit hanya bisa diatur administrator</span>
          <div className="flex gap-2 ml-auto">
            {canConfigure && onConfigure && <Button variant="soft" onClick={() => { onClose(); onConfigure(); }}><IShield size={15} /> Atur benefit</Button>}
            <Button onClick={onClose}><IX size={15} /> Tutup</Button>
          </div>
        </div>
      }>
      <div className="space-y-4">
        <div className="rounded-2xl border p-4 flex flex-wrap items-center gap-3"
          style={{ borderColor: "color-mix(in srgb, var(--violet) 34%, transparent)", background: "color-mix(in srgb, var(--violet) 8%, transparent)" }}>
          <span className="w-11 h-11 rounded-xl grid place-items-center shrink-0" style={{ color: "var(--violet)", background: "color-mix(in srgb, var(--violet) 16%, transparent)" }}>
            <IHeart size={20} />
          </span>
          <div className="min-w-0">
            <p className="font-display font-bold text-base leading-tight">Program member {settings.storeName}</p>
            <p className="text-[11px] text-mute mt-0.5">
              {settings.memberEnabled ? "Aktif" : "Nonaktif"} · potongan dasar {settings.memberDiscountPct}% · tier dari akumulasi belanja · poin bisa ditukar hadiah
            </p>
          </div>
          <Badge color={settings.memberEnabled ? "var(--pandan)" : "var(--amber)"}>
            {settings.memberEnabled ? <><ICheckCircle size={10} /> berjalan</> : "dijeda"}
          </Badge>
        </div>

        {roleNote && (
          <div className="rounded-xl border border-line bg-surface p-3 text-[11.5px] text-mute leading-relaxed flex gap-2">
            <IInfo size={14} className="text-accent shrink-0 mt-0.5" />
            <span>{roleNote}</span>
          </div>
        )}

        <MemberBenefitsPanel settings={settings} dense />

        <div className="rounded-xl border p-3 text-[11.5px] flex gap-2"
          style={{ borderColor: "color-mix(in srgb, var(--accent) 30%, transparent)", background: "var(--accent-soft)" }}>
          <IArrowRight size={14} className="text-accent shrink-0 mt-0.5" />
          <span className="text-mute">
            <b className="text-ink">Kasir</b> mendaftarkan member dan melayani penukaran. <b className="text-ink">Administrator mewarisi semua fitur kasir</b> dan satu-satunya yang bisa mengubah angka benefit serta katalog hadiah.
          </span>
        </div>
      </div>
    </Modal>
  );
}