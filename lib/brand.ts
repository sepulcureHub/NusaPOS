import type { Accent, ThemeMode } from "./types";

export const ACCENTS: { v: Accent; name: string; desc: string; family: string; dark: [string, string]; light: [string, string] }[] = [
  {
    v: "tosca", name: "Tosca Laut", family: "Laut Nusantara",
    desc: "Segar, khas perairan Nusantara — aksen bawaan kedai.",
    dark: ["#2ce0c8", "#0fb5a0"], light: ["#0b8276", "#076b62"],
  },
  {
    v: "ungu", name: "Ungu Senja", family: "Keluarga ungu",
    desc: "Violet senja di atas langit Malioboro. Hangat dan berani.",
    dark: ["#a78bfa", "#7c4dff"], light: ["#6d45d9", "#5733b8"],
  },
  {
    v: "nila", name: "Nila Malam", family: "Mendekati ungu",
    desc: "Indigo pekat, setingkat lebih biru dari ungu. Tenang dan dalam.",
    dark: ["#8b93ff", "#5b60e8"], light: ["#4a46c9", "#3a36a8"],
  },
  {
    v: "lembayung", name: "Lembayung", family: "Keluarga ungu",
    desc: "Ungu kemerahan seperti lembayung sore. Paling ekspresif.",
    dark: ["#c77dff", "#9d4edd"], light: ["#8e3fbf", "#74309c"],
  },
  {
    v: "lavender", name: "Lavender", family: "Mendekati ungu",
    desc: "Lilac lembut, ungu pastel yang kalem untuk tampilan siang.",
    dark: ["#e0c3fc", "#c9a2f5"], light: ["#8a5aa8", "#6f4689"],
  },
];

export const ACCENT_VALUES: Accent[] = ACCENTS.map((a) => a.v);

export const THEME_OPTIONS: { v: ThemeMode; label: string; desc: string }[] = [
  { v: "dark", label: "Gelap", desc: "Nyaman untuk shift malam & ruangan redup" },
  { v: "light", label: "Terang", desc: "Jernih di bawah cahaya matahari / etalase" },
  { v: "system", label: "Sistem", desc: "Ikut otomatis preferensi perangkat (siang/malam)" },
];

export const LOGO_LIMITS = {
  maxInputBytes: 10 * 1024 * 1024,
  maxSide: 512,
  minSide: 128,
  targetBytes: 320 * 1024,
  minSize: 24,
  maxSize: 48,
};

export function resolveTheme(mode: ThemeMode): "dark" | "light" {
  if (mode === "system") {
    if (typeof window === "undefined") return "dark";
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  return mode;
}

export function applyTheme(mode: ThemeMode) {
  if (typeof document === "undefined") return;
  const resolved = resolveTheme(mode);
  document.documentElement.dataset.theme = resolved;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", resolved === "light" ? "#e8efee" : "#06181b");
}

export function dataUrlBytes(dataUrl: string) {
  const i = dataUrl.indexOf(",");
  return Math.max(0, Math.round((dataUrl.length - i - 1) * 0.75));
}

export function formatBytes(n: number) {
  return n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
}

export interface LogoResult {
  dataUrl: string;
  width: number;
  height: number;
  bytes: number;
  format: string;
  source: { width: number; height: number; bytes: number; type: string };
  lowRes: boolean;
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Gagal membaca gambar. Pakai PNG, JPG, atau WebP ya."));
    img.src = src;
  });
}

export async function processLogoFile(file: File): Promise<LogoResult> {
  if (!file.type.startsWith("image/")) throw new Error("File harus gambar (PNG, JPG, atau WebP).");
  if (file.size > LOGO_LIMITS.maxInputBytes) throw new Error(`Ukuran file maksimal ${formatBytes(LOGO_LIMITS.maxInputBytes)}.`);

  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const nw = img.naturalWidth || img.width;
    const nh = img.naturalHeight || img.height;
    if (!nw || !nh) throw new Error("Dimensi gambar tidak terbaca. Coba file lain.");

    const scale = Math.min(1, LOGO_LIMITS.maxSide / Math.max(nw, nh));
    let w = Math.max(1, Math.round(nw * scale));
    let h = Math.max(1, Math.round(nh * scale));
    let out = "";

    for (let attempt = 0; attempt < 4; attempt++) {
      if (attempt >= 2) { w = Math.max(64, Math.round(w * 0.75)); h = Math.max(64, Math.round(h * 0.75)); }
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Browser ini tidak mendukung pemrosesan gambar.");
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);

      const q = [0.92, 0.85, 0.85, 0.8][attempt];
      out = canvas.toDataURL("image/webp", q);
      if (!out.startsWith("data:image/webp")) out = canvas.toDataURL("image/png");
      if (dataUrlBytes(out) <= LOGO_LIMITS.targetBytes) break;
    }

    return {
      dataUrl: out,
      width: w, height: h,
      bytes: dataUrlBytes(out),
      format: out.slice(5, out.indexOf(";")).replace("image/", "").toUpperCase(),
      source: { width: nw, height: nh, bytes: file.size, type: (file.type || "gambar").replace("image/", "").toUpperCase() },
      lowRes: Math.max(nw, nh) < LOGO_LIMITS.minSide,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function downloadDataUrl(name: string, dataUrl: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = name;
  a.click();
}