"use client";

import { useEffect, useId, useState } from "react";
import type { CSSProperties } from "react";
import type { LogoShape, Settings } from "@/lib/types";

/* ---------------------------------------------------------------------------
 * NusaPOS — Brand system
 * Dipakai oleh: Shell (sidebar, header mobile, drawer), Receipt (struk),
 * dan Pengaturan (pratinjau dua tema). Semua warna mengikuti CSS variables
 * aktif, jadi otomatis menyesuaikan mode gelap/terang + warna aksen.
 * ------------------------------------------------------------------------- */

const FALLBACK_NAME = "NusaPOS";

const clampSize = (n: number) => Math.min(96, Math.max(16, Math.round(Number(n) || 34)));

const radiusFor = (shape: LogoShape, size: number) =>
  shape === "circle" ? 999 : shape === "square" ? 4 : Math.round(size * 0.28);

const safeId = (raw: string) => raw.replace(/[^a-zA-Z0-9_-]/g, "");

/* ------------------------------ Lambang bawaan ------------------------------ */
function DefaultMark({ size, label }: { size: number; label?: string }) {
  const uid = safeId(useId());
  const bg = `bg${uid}`;
  const sheen = `sh${uid}`;
  const sun = `su${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className="shrink-0 block"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <defs>
        <linearGradient id={bg} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--accent)" />
          <stop offset="48%" stopColor="var(--accent2)" />
          <stop offset="100%" stopColor="var(--laut)" />
        </linearGradient>
        <radialGradient id={sheen} cx="0.26" cy="0.16" r="0.85">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.26" />
          <stop offset="60%" stopColor="#ffffff" stopOpacity="0.04" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={sun} cx="0.36" cy="0.32" r="0.78">
          <stop offset="0%" stopColor="color-mix(in srgb, var(--amber) 55%, #ffffff)" />
          <stop offset="100%" stopColor="var(--amber)" />
        </radialGradient>
      </defs>

      <rect x="2" y="2" width="44" height="44" rx="13" fill={`url(#${bg})`} />
      <rect x="2" y="2" width="44" height="44" rx="13" fill={`url(#${sheen})`} />

      <circle cx="31" cy="16" r="8.5" fill="var(--amber)" opacity="0.2" />
      <circle cx="31" cy="16" r="5" fill={`url(#${sun})`} />

      <path
        d="M10 30c4-3 8-3 12 0s8 3 12 0"
        stroke="var(--accent-ink)"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M10 36c4-3 8-3 12 0s8 3 12 0"
        stroke="var(--accent-ink)"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
        opacity="0.5"
      />

      <rect x="2.75" y="2.75" width="42.5" height="42.5" rx="12.25" fill="none" stroke="#ffffff" strokeOpacity="0.16" strokeWidth="1.5" />
    </svg>
  );
}

/* --------------------------------- Logo mark -------------------------------- */
export function BrandMark({
  settings,
  size = 34,
  plate,
  className = "",
}: {
  settings: Settings;
  size?: number;
  plate?: boolean;
  className?: string;
}) {
  const s = clampSize(size);
  const src = typeof settings.logo === "string" && settings.logo.length > 0 ? settings.logo : null;
  const [broken, setBroken] = useState(false);

  useEffect(() => { setBroken(false); }, [src]);

  const shape: LogoShape = settings.logoShape ?? "rounded";
  const radius = radiusFor(shape, s);
  const usePlate = (plate ?? settings.logoPlate ?? true) && !!src && !broken;
  const hasUpload = !!src && !broken;
  const wrapRadius = hasUpload ? radius : Math.round((s * 13) / 48);

  const image = hasUpload ? (
    <img
      src={src as string}
      alt={`Logo ${settings.brandName || FALLBACK_NAME}`}
      draggable={false}
      decoding="async"
      onError={() => setBroken(true)}
      style={{
        height: s,
        width: "auto",
        maxWidth: Math.round(s * 2.6),
        minWidth: Math.round(s * 0.5),
        objectFit: "contain",
        borderRadius: usePlate ? Math.max(2, radius - 2) : radius,
        display: "block",
      }}
    />
  ) : null;

  return (
    <span
      className={`group/mark relative inline-flex shrink-0 overflow-hidden align-middle transition-transform duration-300 ease-out hover:scale-[1.04] ${className}`}
      style={{ borderRadius: wrapRadius }}
    >
      {hasUpload ? (
        usePlate ? (
          <span className="logo-plate" style={{ borderRadius: radius, padding: Math.max(2, Math.round(s * 0.09)) }}>
            {image}
          </span>
        ) : (
          image
        )
      ) : (
        <DefaultMark size={s} />
      )}

      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 -left-full w-1/2 -skew-x-12 opacity-0 transition-all duration-700 ease-out group-hover/mark:left-[160%] group-hover/mark:opacity-100"
        style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)" }}
      />
    </span>
  );
}

/* --------------------------------- Wordmark --------------------------------- */
function Wordmark({ name, fontSize }: { name: string; fontSize: number }) {
  const match = /^(.*?)(pos)$/i.exec(name);
  const style: CSSProperties = { fontSize, letterSpacing: "-0.01em" };

  return (
    <span className="font-display font-bold leading-none block truncate" style={style}>
      {match && match[1] ? (
        <>
          {match[1]}
          <span className="text-accent">{match[2]}</span>
        </>
      ) : (
        name
      )}
    </span>
  );
}

/* ------------------------------- Logo + tulisan ------------------------------ */
export function BrandLockup({
  settings,
  size,
  compact = false,
  className = "",
}: {
  settings: Settings;
  size?: number;
  compact?: boolean;
  className?: string;
}) {
  const s = clampSize(size ?? settings.logoSize ?? 34);
  const name = (settings.brandName ?? "").trim() || FALLBACK_NAME;
  const tagline = (settings.brandTagline ?? "").trim();

  const showWordmark = settings.showWordmark !== false;
  const showTagline = !compact && settings.showTagline !== false && tagline.length > 0;
  const hasText = showWordmark || showTagline;

  const nameSize = Math.round(Math.min(22, Math.max(13, s * 0.52)));
  const tagSize = Math.round(Math.min(10, Math.max(8, s * 0.26)));

  return (
    <span className={`flex items-center min-w-0 ${compact ? "gap-2" : "gap-3"} ${className}`} title={hasText ? name : undefined}>
      <BrandMark settings={settings} size={s} />

      {hasText && (
        <span className="min-w-0 flex flex-col justify-center">
          {showWordmark && <Wordmark name={name} fontSize={nameSize} />}
          {showTagline && (
            <span
              className="block font-bold uppercase text-faint truncate"
              style={{ fontSize: tagSize, letterSpacing: "0.2em", marginTop: Math.max(3, Math.round(s * 0.1)) }}
            >
              {tagline}
            </span>
          )}
        </span>
      )}

      {!hasText && <span className="sr-only">{name}</span>}
    </span>
  );
}