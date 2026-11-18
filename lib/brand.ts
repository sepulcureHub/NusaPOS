"use client";

import type { Accent, ThemeMode } from "./types";

export type ResolvedTheme = "dark" | "light";

export interface LogoSource {
  width: number;
  height: number;
  bytes: number;
  type: string;
}

export interface LogoResult {
  dataUrl: string;
  width: number;
  height: number;
  bytes: number;
  format: string;
  lowRes: boolean;
  source: LogoSource;
}

export const LOGO_LIMITS = {
  minSize: 24,
  maxSize: 48,
  maxInputBytes: 5 * 1024 * 1024,
  targetMaxSide: 512,
  minRecommend: 128,
} as const;

export const THEME_OPTIONS: { v: ThemeMode; label: string; desc: string }[] = [
  {
    v: "dark",
    label: "Gelap",
    desc: "Kenyamanan mata saat kasir bekerja lama, kontras tinggi, dan hemat baterai OLED.",
  },
  {
    v: "light",
    label: "Terang",
    desc: "Cocok untuk ruangan terang, cetak struk, dan tampilan bersih untuk pelanggan.",
  },
  {
    v: "system",
    label: "Ikuti Sistem",
    desc: "Otomatis berganti sesuai mode gelap/terang perangkat kamu.",
  },
];

export interface AccentDef {
  v: Accent;
  name: string;
  family: string;
  desc: string;
  dark: [string, string];
  light: [string, string];
}

/**
 * Sesuai permintaan: hanya sisakan warna aksen Tosca Laut.
 */
export const ACCENTS: AccentDef[] = [
  {
    v: "tosca",
    name: "Tosca Laut",
    family: "Tosca + Biru Laut",
    desc: "Aksen utama aplikasi: tosca segar dipadu biru laut, modern, profesional, dan nyaman untuk POS.",
    dark: ["#2dd4bf", "#0ea5e9"],
    light: ["#0d9488", "#0284c7"],
  },
];

export const ACCENT_VALUES: Accent[] = ACCENTS.map((a) => a.v);

export function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (typeof window === "undefined") return "dark";
  if (mode !== "system") return mode;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function applyTheme(mode: ThemeMode) {
  if (typeof document === "undefined") return;
  const resolved = resolveTheme(mode);
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.style.colorScheme = resolved;
}

export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

export function downloadDataUrl(filename: string, dataUrl: string) {
  if (typeof document === "undefined") return;
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function dataUrlBytes(dataUrl: string) {
  const comma = dataUrl.indexOf(",");
  const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  return Math.max(0, Math.round((base64.length * 3) / 4));
}

export async function processLogoFile(file: File): Promise<LogoResult> {
  if (!file.type.startsWith("image/")) {
    throw new Error("File harus berupa gambar PNG, JPG, atau WebP.");
  }

  if (file.size > LOGO_LIMITS.maxInputBytes) {
    throw new Error(
      `Ukuran gambar terlalu besar. Maksimal ${formatBytes(LOGO_LIMITS.maxInputBytes)}.`
    );
  }

  const url = URL.createObjectURL(file);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Gambar gagal dimuat."));
      image.src = url;
    });

    const sourceWidth = img.naturalWidth || img.width;
    const sourceHeight = img.naturalHeight || img.height;

    if (!sourceWidth || !sourceHeight) {
      throw new Error("Dimensi gambar tidak valid.");
    }

    const maxSide = Math.max(sourceWidth, sourceHeight);
    const scale = Math.min(1, LOGO_LIMITS.targetMaxSide / maxSide);
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Browser tidak mendukung pemrosesan gambar.");

    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    let dataUrl = canvas.toDataURL("image/webp", 0.92);
    if (!dataUrl.startsWith("data:image/webp")) {
      dataUrl = canvas.toDataURL("image/png");
    }

    const bytes = dataUrlBytes(dataUrl);
    const format = dataUrl.startsWith("data:image/webp") ? "WEBP" : "PNG";
    const lowRes =
      sourceWidth < LOGO_LIMITS.minRecommend || width < LOGO_LIMITS.minRecommend;

    return {
      dataUrl,
      width,
      height,
      bytes,
      format,
      lowRes,
      source: {
        width: sourceWidth,
        height: sourceHeight,
        bytes: file.size,
        type: file.type,
      },
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}