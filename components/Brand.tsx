import type { Settings } from "@/lib/types";

type BrandProps = {
  settings: Settings;
  size?: number;
  className?: string;
  plate?: boolean;
};

type BrandLockupProps = BrandProps & {
  compact?: boolean;
};

function radiusFor(shape: Settings["logoShape"]) {
  if (shape === "circle") return "9999px";
  if (shape === "square") return "6px";
  return "12px";
}

function clampSize(size?: number, fallback?: number) {
  const value = Number(size ?? fallback ?? 34);
  if (!Number.isFinite(value)) return 34;
  return Math.max(18, Math.min(72, Math.round(value)));
}

export function BrandMark({
  settings,
  size,
  className = "",
  plate,
}: BrandProps) {
  const px = clampSize(size, settings.logoSize);
  const radius = radiusFor(settings.logoShape);

  /**
   * Jika prop `plate` dikirim, gunakan nilai itu.
   * Jika tidak, ikuti pengaturan settings.logoPlate.
   */
  const showPlate = plate ?? (settings.logoPlate !== false);

  return (
    <span
      className={`relative inline-grid place-items-center overflow-hidden shrink-0 ${className}`}
      style={{
        width: px,
        height: px,
        borderRadius: radius,
        background: showPlate
          ? "color-mix(in srgb, var(--accent) 12%, var(--surface))"
          : "transparent",
        border: showPlate
          ? "1px solid color-mix(in srgb, var(--accent) 24%, transparent)"
          : "1px solid transparent",
        color: "var(--accent)",
        boxShadow: showPlate
          ? "0 10px 24px -18px color-mix(in srgb, var(--accent) 70%, transparent)"
          : "none",
      }}
      aria-hidden="true"
    >
      {settings.logo ? (
        <img
          src={settings.logo}
          alt=""
          className="h-full w-full object-contain"
          draggable={false}
        />
      ) : (
        <svg
          width={Math.round(px * 0.62)}
          height={Math.round(px * 0.62)}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 8h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8Z" />
          <path d="M16 9h2.5a2.5 2.5 0 0 1 0 5H16" />
          <path d="M7 3.5c0 1 .8 1.5.8 2.5" />
          <path d="M11 3.5c0 1 .8 1.5.8 2.5" />
        </svg>
      )}
    </span>
  );
}

export function BrandLockup({
  settings,
  size,
  compact = false,
  className = "",
  plate,
}: BrandLockupProps) {
  const px = clampSize(size, settings.logoSize);
  const showWordmark = settings.showWordmark !== false;
  const showTagline = settings.showTagline !== false;

  return (
    <span className={`inline-flex items-center gap-2.5 min-w-0 ${className}`}>
      <BrandMark settings={settings} size={px} plate={plate} />

      {showWordmark && (
        <span className="min-w-0">
          <span
            className="block font-display font-bold leading-none text-ink truncate"
            style={{ fontSize: Math.max(12, Math.round(px * 0.46)) }}
          >
            {settings.brandName}
          </span>

          {!compact && showTagline && settings.brandTagline ? (
            <span className="block text-[10px] uppercase tracking-[0.16em] text-faint truncate mt-0.5">
              {settings.brandTagline}
            </span>
          ) : null}
        </span>
      )}
    </span>
  );
}