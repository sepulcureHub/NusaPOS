"use client";

import { useEffect, useState } from "react";
import type { Category } from "@/lib/types";
import { CATEGORY_COLORS } from "@/lib/types";
import { monogram } from "@/lib/pricing";

export function ProductThumb({
  name, photo, category, size = 40, rounded = 12, fill = false, fit = "cover", className = "",
}: {
  name: string;
  photo?: string | null;
  category: Category;
  size?: number;
  rounded?: number;
  fill?: boolean;
  fit?: "cover" | "contain";
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  useEffect(() => { setBroken(false); }, [photo]);

  const c = CATEGORY_COLORS[category] ?? "var(--accent)";
  const hasPhoto = typeof photo === "string" && photo.length > 0 && !broken;
  const box = fill ? { width: "100%", height: "100%", borderRadius: rounded } : { width: size, height: size, borderRadius: rounded };

  if (hasPhoto) {
    return (
      <img
        src={photo as string}
        alt={name}
        draggable={false}
        decoding="async"
        onError={() => setBroken(true)}
        className={`shrink-0 block border border-line ${className}`}
        style={{
          ...box,
          objectFit: fit,
          background: fit === "contain" ? "var(--surface2)" : undefined,
          padding: fit === "contain" ? (fill ? 6 : 2) : 0,
        }}
      />
    );
  }

  return (
    <span
      aria-label={name}
      className={`shrink-0 grid place-items-center font-display font-bold border border-line select-none ${className}`}
      style={{
        ...box,
        color: c,
        fontSize: fill ? 30 : Math.max(10, Math.round(size * 0.34)),
        letterSpacing: "0.02em",
        background: `linear-gradient(135deg, color-mix(in srgb, ${c} 26%, var(--surface2)), var(--surface2))`,
      }}
    >
      {monogram(name)}
    </span>
  );
}