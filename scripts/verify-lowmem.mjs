#!/usr/bin/env node
/**
 * NusaPOS — verify hemat memori untuk mesin dengan commit charge terbatas.
 *
 *   npm run verify:safe
 *   node scripts/verify-lowmem.mjs --only=lint
 *   node scripts/verify-lowmem.mjs --heap=1536 --semi=4
 *
 * Kenapa semi-space DIKECILKAN, bukan heap dibesarkan?
 * Fatal "Committing semi space failed" terjadi karena OS menolak commit,
 * bukan karena batas heap V8. Semi-space kecil = kebutuhan commit per scavenge
 * lebih kecil = proses bertahan di mesin sesak (GC lebih sering, tapi selamat).
 */
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const MB = 1024 * 1024;

const flagValue = (name, dflt) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : dflt;
};
const only = flagValue("only", "");
const heap = Math.max(512, Number(flagValue("heap", "1536")) || 1536);
const semi = Math.max(1, Number(flagValue("semi", "4")) || 4);

const bin = (rel) => path.join(root, "node_modules", rel);

const STEPS = [
  { name: "lint", script: bin("eslint/bin/eslint.js"), args: ["."] },
  { name: "typecheck", script: bin("typescript/bin/tsc"), args: ["--noEmit"] },
  { name: "test", script: bin("vitest/vitest.mjs"), args: ["run", "--passWithNoTests"] },
  { name: "build", script: bin("next/dist/bin/next"), args: ["build"] },
];

const selected = only ? STEPS.filter((s) => s.name === only) : STEPS;
if (!selected.length) {
  console.error(`✘ Langkah "${only}" tidak dikenal. Pilihan: ${STEPS.map((s) => s.name).join(", ")}`);
  process.exit(1);
}

console.log("── verify (mode hemat memori) ──────────────");
console.log(`Node        ${process.version} (${process.arch})`);
console.log(`Heap        ${heap} MB per proses`);
console.log(`Semi-space  ${semi} MB (dikecilkan agar commit ringan)`);
console.log(`Langkah     ${selected.map((s) => s.name).join(" → ")}`);
console.log("────────────────────────────────────────────\n");

function run(step) {
  if (!existsSync(step.script)) {
    console.error(`✘ ${step.name}: binary tidak ditemukan di ${step.script}. Jalankan \`npm ci\`.`);
    return Promise.resolve(1);
  }
  const freeNow = Math.round(os.freemem() / MB);
  console.log(`▶ ${step.name}  (RAM bebas ${freeNow} MB)`);

  const env = {
    ...process.env,
    /* Kosongkan supaya flag global tidak dobel dengan execArgv di bawah. */
    NODE_OPTIONS: "",
    NEXT_TELEMETRY_DISABLED: "1",
    NEXT_BUILD_CPUS: "1",
    NEXT_BUILD_PAGE_CONCURRENCY: "2",
    NEXT_TURBO_FS_CACHE: "0",
  };

  const args = [`--max-old-space-size=${heap}`, `--max-semi-space-size=${semi}`, step.script, ...step.args];

  return new Promise((resolve) => {
    const t0 = Date.now();
    const child = spawn(process.execPath, args, { cwd: root, env, stdio: "inherit", shell: false });
    child.on("error", (err) => {
      console.error(`✘ ${step.name}: ${err.message}`);
      resolve(1);
    });
    child.on("exit", (code, signal) => {
      const secs = ((Date.now() - t0) / 1000).toFixed(1);
      if (code === 0) console.log(`✔ ${step.name} selesai (${secs}s)\n`);
      else console.error(`✘ ${step.name} gagal — exit ${code ?? "null"}${signal ? ` signal ${signal}` : ""} (${secs}s)\n`);
      resolve(code ?? 1);
    });
  });
}

let failed = null;
for (const step of selected) {
  const code = await run(step);
  if (code !== 0) {
    failed = step.name;
    break;
  }
}

if (failed) {
  console.error(
    `Berhenti di "${failed}".\n` +
      "Kalau errornya masih 'Committing semi space failed' / 'heap out of memory':\n" +
      "  1. npm run doctor            → lihat Disk bebas & CommitFreeMB\n" +
      "  2. npm run clean             → bebaskan .next & cache\n" +
      "  3. Get-Process node | Stop-Process -Force\n" +
      "  4. Pastikan page file aktif (sysdm.cpl) dan disk C: > 2 GB bebas\n" +
      "  5. Coba lebih kecil lagi: node scripts/verify-lowmem.mjs --heap=1024 --semi=2\n"
  );
  process.exit(1);
}
console.log("✔ Semua langkah lolos.\n");