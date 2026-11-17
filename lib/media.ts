import { dataUrlBytes, formatBytes } from "./brand";

export const PHOTO_LIMITS = {
  maxInputBytes: 12 * 1024 * 1024,
  maxSide: 900,
  minSide: 240,
  targetBytes: 420 * 1024,
};

export type PhotoAspect = "square" | "original";

export interface PhotoResult {
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

export async function processProductPhoto(file: File, aspect: PhotoAspect = "square"): Promise<PhotoResult> {
  if (!file.type.startsWith("image/")) throw new Error("File harus gambar (PNG, JPG, atau WebP).");
  if (file.size > PHOTO_LIMITS.maxInputBytes) throw new Error(`Ukuran file maksimal ${formatBytes(PHOTO_LIMITS.maxInputBytes)}.`);

  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const nw = img.naturalWidth || img.width;
    const nh = img.naturalHeight || img.height;
    if (!nw || !nh) throw new Error("Dimensi gambar tidak terbaca. Coba file lain.");

    const square = aspect === "square";
    const basis = square ? Math.min(nw, nh) : Math.max(nw, nh);
    let side = Math.min(PHOTO_LIMITS.maxSide, basis);
    let w = square ? side : Math.max(1, Math.round(nw * (side / basis)));
    let h = square ? side : Math.max(1, Math.round(nh * (side / basis)));

    const sx = square ? (nw - basis) / 2 : 0;
    const sy = square ? (nh - basis) / 2 : 0;

    let out = "";
    for (let attempt = 0; attempt < 4; attempt++) {
      if (attempt >= 2) {
        w = Math.max(96, Math.round(w * 0.75));
        h = Math.max(96, Math.round(h * 0.75));
      }
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Browser ini tidak mendukung pemrosesan gambar.");
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(img, sx, sy, basis, basis, 0, 0, w, h);

      const q = [0.92, 0.86, 0.86, 0.8][attempt];
      out = canvas.toDataURL("image/webp", q);
      if (!out.startsWith("data:image/webp")) out = canvas.toDataURL("image/jpeg", q);
      if (dataUrlBytes(out) <= PHOTO_LIMITS.targetBytes) break;
    }

    return {
      dataUrl: out,
      width: w, height: h,
      bytes: dataUrlBytes(out),
      format: out.slice(5, out.indexOf(";")).replace("image/", "").toUpperCase(),
      source: { width: nw, height: nh, bytes: file.size, type: (file.type || "gambar").replace("image/", "").toUpperCase() },
      lowRes: basis < PHOTO_LIMITS.minSide,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}