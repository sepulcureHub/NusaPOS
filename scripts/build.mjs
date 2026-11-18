#!/usr/bin/env node
/**
 * NusaPOS — build wrapper lintas platform.
 *
 *   node scripts/build.mjs                      → otomatis (worker dari RAM bebas)
 *   node scripts/build.mjs --workers=1          → paling aman
 *   node scripts/build.mjs --heap=3072          → heap proses induk (MB)
 *   node scripts/build.mjs --webpack            → pakai Webpack, bukan Turbopack
 *   node scripts/build.mjs --no-cache           → matikan cache FS Turbopack
 *   node scripts/build.mjs --no-retry           → jangan ulangi otomatis
 *
 * Yang dilakukan:
 *  1. Hitung worker aman dari RAM bebas (bukan dari jumlah CPU).
 *  2. Kosongkan NODE_OPTIONS supaya nilai global tidak diwariskan ke semua worker.
 *  3. Jalankan `next build` dengan heap eksplisit di proses induk.
 *  4. Kalau gagal, ulangi sekali dengan 1 worker + cache mati.
 */
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const MB = 1024 * 1024;

const flagValue = (name, fallback = "") => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const flagOn = (name) => argv.includes(`--${name}`);

const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
if (!existsSync(nextBin)) {
  console.error("✘ node_modules/next tidak ditemukan. Jalankan `npm ci` dulu.");
  process.exit(1);
}

const totalMB = Math.round(os.totalmem() / MB);
const freeMB = Math.round(os.freemem() / MB);
const threads = os.cpus().length;

/* Sisakan ~1.5 GB untuk OS + proses induk; anggarkan ~700 MB per worker. */
const budget = Math.floor((freeMB - 1500) / 700);
const requested = Number(flagValue("workers", "0"));
const autoWorkers = Math.max(1, Math.min(budget || 1, Math.max(1, threads - 1)));
const workers = Math.max(1, Math.min(requested > 0 ? requested : autoWorkers, 16));

const heapRequested = Number(flagValue("heap", "0"));
const heap = Math.max(1024, Math.min(heapRequested > 0 ? heapRequested : 3072, Math.floor(totalMB / 2)));

const useWebpack = flagOn("webpack");
const noCache = flagOn("no-cache");
const noRetry = flagOn("no-retry");
const passthrough = argv.filter((a) => !/^--(workers|heap|webpack|no-cache|no-retry)(=|$)/.test(a));

console.log("── NusaPOS build ───────────────────────────");
console.log(`Node           ${process.version} (${process.arch})`);
console.log(`RAM            ${freeMB} MB bebas / ${totalMB} MB total`);
console.log(`CPU            ${threads} thread (Next default akan pakai ${Math.max(1, threads - 1)} worker)`);
console.log(`Worker dipilih ${workers}${requested > 0 ? " (manual)" : " (otomatis dari RAM)"}`);
console.log(`Heap induk     ${heap} MB`);
console.log(`Bundler        ${useWebpack ? "Webpack" : "Turbopack"}`);
console.log(`Cache FS       ${noCache ? "off" : "on"}`);
console.log("────────────────────────────────────────────\n");

function run({ workers: w, heap: h, cacheOff, webpack }) {
  const env = {
    ...process.env,
    NEXT_BUILD_CPUS: String(w),
    NEXT_BUILD_PAGE_CONCURRENCY: String(Math.max(1, Math.min(4, w * 2))),
    NEXT_TURBO_FS_CACHE: cacheOff ? "0" : "1",
    NEXT_TELEMETRY_DISABLED: "1",
    /* Kosongkan: nilai global di sini diwariskan ke SETIAP worker oleh Next. */
    NODE_OPTIONS: "",
  };
  const args = [`--max-old-space-size=${h}`, nextBin, "build"];
  if (webpack) args.push("--webpack");
  args.push(...passthrough);

  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { cwd: root, env, stdio: "inherit", shell: false });
    child.on("error", (err) => {
      console.error("✘ Gagal menjalankan next build:", err.message);
      resolve(1);
    });
    child.on("exit", (code, signal) => resolve(code ?? (signal ? 1 : 0)));
  });
}

let code = await run({ workers, heap, cacheOff: noCache, webpack: useWebpack });

if (code !== 0 && !noRetry) {
  console.log("\n⚠ Build gagal. Mengulangi dengan mode paling hemat: 1 worker, cache mati.\n");
  code = await run({ workers: 1, heap: Math.max(1024, Math.min(heap, 2048)), cacheOff: true, webpack: useWebpack });
}

if (code !== 0 && !noRetry && !useWebpack) {
  console.log("\n⚠ Masih gagal. Percobaan terakhir: 1 worker + Webpack (tanpa Turbopack).\n");
  code = await run({ workers: 1, heap: Math.max(1024, Math.min(heap, 2048)), cacheOff: true, webpack: true });
}

if (code !== 0) {
  console.error(
    "\n✘ Build masih gagal.\n" +
      "  1. Jalankan `npm run doctor` dan perbaiki temuan ✘.\n" +
      "  2. Pastikan Node 64-bit dan page file Windows aktif (system managed).\n" +
      "  3. Tutup aplikasi berat, lalu `npm run build:safe`.\n"
  );
}
process.exit(code);