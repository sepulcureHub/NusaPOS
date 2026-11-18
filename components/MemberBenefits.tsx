"use client";

import type { Settings } from "@/lib/types";
import { rupiah } from "@/lib/format";
import {
  TIERS,
  TIER_COLOR,
  benefitItems,
  tierBonus,
  tierThresholds,
} from "@/lib/member";
import { Badge, Button, Modal } from "./ui";
import {
  ICalendar,
  IGift,
  IHeart,
  IInfo,
  IPercent,
  IShield,
  IStar,
} from "./icons";

const BENEFIT_ICON = {
  percent: IPercent,
  star: IStar,
  heart: IHeart,
  calendar: ICalendar,
  gift: IGift,
  shield: IShield,
} as const;

/** Kartu tier premium — angka bonus persis sesuai pengaturan admin. */
export function TierLadder({ settings, dense: _dense = false }: { settings: Settings; dense?: boolean }) {
  const thresholds = tierThresholds(settings);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {TIERS.map((tier) => {
        const bonus = tierBonus(tier, settings);
        const need = thresholds[tier];

        return (
          <div
            key={tier}
            className="relative rounded-2xl border bg-surface p-4 overflow-hidden transition-transform duration-300 hover:-translate-y-0.5"
            style={{
              borderColor: `color-mix(in srgb, ${TIER_COLOR[tier]} 35%, transparent)`,
              background: `linear-gradient(160deg, color-mix(in srgb, ${TIER_COLOR[tier]} 9%, var(--surface)), var(--surface) 60%)`,
            }}
          >
            <span className="absolute inset-x-0 top-0 h-1" style={{ background: `linear-gradient(90deg, ${TIER_COLOR[tier]}, transparent)` }} />
            <div className="flex items-center justify-between gap-2">
              <Badge color={TIER_COLOR[tier]}>
                <IStar size={10} /> {tier}
              </Badge>
              <span className="text-[9px] font-bold text-faint uppercase tracking-widest">tier</span>
            </div>

            <p className="font-display font-bold text-3xl mt-3 tabular-nums" style={{ color: TIER_COLOR[tier] }}>
              {bonus}%
            </p>
            <p className="text-[10.5px] text-faint mt-0.5">bonus diskon tier</p>

            <div className="mt-3 pt-3 border-t border-line flex items-center gap-1.5 text-[11px] text-mute">
              <ICalendar size={12} className="text-faint shrink-0" />
              {need > 0 ? `Belanja ${rupiah(need)}` : "Tanpa minimum belanja"}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function MemberBenefitsPanel({
  settings,
  dense = false,
  showSteps = true,
}: {
  settings: Settings;
  dense?: boolean;
  showSteps?: boolean;
}) {
  const items = benefitItems(settings);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-display font-bold text-base flex items-center gap-2">
          <IHeart size={16} className="text-chili" /> Benefit Member
        </h3>
        <Badge color={settings.memberEnabled ? "var(--pandan)" : "var(--chili)"}>
          {settings.memberEnabled ? "Aktif" : "Nonaktif"}
        </Badge>
        <Badge color="var(--violet)">
          <IStar size={10} /> Tier dinamis
        </Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((b) => {
          const Icon = BENEFIT_ICON[b.icon];
          return (
            <div
              key={b.key}
              className="rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-line2"
              style={{ borderColor: `color-mix(in srgb, ${b.color} 26%, transparent)` }}
            >
              <div className="flex items-start gap-3">
                <span
                  className="w-9 h-9 rounded-xl grid place-items-center shrink-0"
                  style={{ color: b.color, background: `color-mix(in srgb, ${b.color} 14%, transparent)` }}
                >
                  <Icon size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold">{b.title}</p>

                  {b.key === "tier" ? (
                    <div className="grid grid-cols-2 gap-1.5 mt-2">
                      {TIERS.map((t) => (
                        <span
                          key={t}
                          className="inline-flex items-center justify-between gap-1 rounded-lg border border-line bg-surface2 px-2 py-1 text-[10.5px] font-bold"
                        >
                          <span className="inline-flex items-center gap-1 min-w-0">
                            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: TIER_COLOR[t] }} />
                            <span className="truncate">{t}</span>
                          </span>
                          <span className="tabular-nums" style={{ color: TIER_COLOR[t] }}>{tierBonus(t, settings)}%</span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="font-display font-bold text-lg mt-1" style={{ color: b.color }}>
                      {b.value}
                    </p>
                  )}
                </div>
              </div>
              <p className="text-[11px] text-mute mt-3 leading-relaxed">{b.desc}</p>
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-line bg-surface p-4">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <p className="text-sm font-bold flex items-center gap-1.5">
            <IStar size={15} className="text-amber" /> Penjelasan tier
          </p>
          <span className="text-[11px] text-faint ml-auto">
            Angka bonus = persis yang diatur admin
          </span>
        </div>
        <TierLadder settings={settings} dense={dense} />
        <p className="text-[11px] text-faint mt-3 flex gap-1.5">
          <IInfo size={12} className="shrink-0 mt-0.5" />
          Bonus tier dijumlahkan dengan potongan dasar {settings.memberDiscountPct}% saat transaksi (maks 40%), plus bonus ulang tahun bila aktif.
        </p>
      </div>

      {showSteps && (
        <div className="rounded-2xl border border-line bg-surface p-4">
          <p className="text-xs font-bold mb-3 flex items-center gap-1.5">
            <IInfo size={14} className="text-accent" /> Cara kerja benefit
          </p>
          <ol className="space-y-2 text-[11.5px] text-mute">
            <li className="flex gap-2">
              <span className="w-5 h-5 rounded-full grid place-items-center text-[10px] font-bold bg-accent text-accent-ink shrink-0">1</span>
              Member mendaftar lewat kasir, lalu kasir membuatkan username dan PIN.
            </li>
            <li className="flex gap-2">
              <span className="w-5 h-5 rounded-full grid place-items-center text-[10px] font-bold bg-accent text-accent-ink shrink-0">2</span>
              Member login ke portal member memakai username + PIN.
            </li>
            <li className="flex gap-2">
              <span className="w-5 h-5 rounded-full grid place-items-center text-[10px] font-bold bg-accent text-accent-ink shrink-0">3</span>
              Setiap belanja menghitung potongan tier otomatis berdasarkan akumulasi belanja.
            </li>
            <li className="flex gap-2">
              <span className="w-5 h-5 rounded-full grid place-items-center text-[10px] font-bold bg-accent text-accent-ink shrink-0">4</span>
              Poin terkumpul dan bisa ditukar hadiah di katalog penukaran.
            </li>
          </ol>
        </div>
      )}

      {settings.memberBenefitNotes && (
        <div
          className="rounded-xl border p-3 text-[11.5px]"
          style={{
            borderColor: "color-mix(in srgb, var(--violet) 30%, transparent)",
            background: "color-mix(in srgb, var(--violet) 7%, transparent)",
          }}
        >
          <p className="font-bold text-ink mb-1 flex items-center gap-1.5">
            <IHeart size={13} className="text-violet" /> Catatan benefit
          </p>
          <p className="text-mute leading-relaxed">{settings.memberBenefitNotes}</p>
        </div>
      )}
    </div>
  );
}

export function MemberBenefitsModal({
  open,
  onClose,
  settings,
  canConfigure = false,
  onConfigure,
  roleNote,
}: {
  open: boolean;
  onClose: () => void;
  settings: Settings;
  canConfigure?: boolean;
  onConfigure?: () => void;
  roleNote?: string;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title="Benefit member"
      footer={
        <div className="flex flex-wrap items-center gap-2 justify-end">
          {roleNote && <span className="text-[11px] text-faint mr-auto max-w-md leading-snug">{roleNote}</span>}
          <Button variant="ghost" onClick={onClose}>
            Tutup
          </Button>
          {canConfigure && onConfigure && (
            <Button onClick={onConfigure}>
              <IShield size={15} /> Atur benefit
            </Button>
          )}
        </div>
      }
    >
      <MemberBenefitsPanel settings={settings} />
    </Modal>
  );
}