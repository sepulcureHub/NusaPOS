#!/usr/bin/env node
/**
 * NusaPOS — bersihkan artefak build yang menumpuk dan memakan disk/commit.
 *   npm run clean          → .next, node_modules/.cache, coverage, tsbuildinfo
 *   npm run clean -- --all → juga folder cache tool lain (tetap aman, tidak menyentuh source)
 */
import { rmSync, existsSync, readdirSync, lstatSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MB = 1024 * 1024;
const all = process.argv.includes("--all");

function sizeMB(p) {
  if (!existsSync(p)) return 0;
  let bytes = 0;
  const stack = [p];
  while (stack.length) {
    const cur = stack.pop();
    let entries;
    try {
      entries = readdirSync(cur, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const fp = path.join(cur, e.name);
      try {
        if (e.isSymbolicLink()) continue;
        if (e.isDirectory()) stack.push(fp);
        else bytes += lstatSync(fp).size;
      } catch {
        /* abaikan */
      }
    }
  }
  return Math.round(bytes / MB);
}

const targets = [
  ".next",
  "node_modules/.cache",
  "node_modules/.vite",
  "coverage",
  "playwright-report",
  "test-results",
];
if (all) targets.push(".turbo", ".swc", "out");

let freed = 0;
console.log("── Membersihkan artefak build ──────────────");
for (const rel of targets) {
  const p = path.join(root, rel);
  if (!existsSync(p)) {
    console.log(`• ${rel.padEnd(26)} tidak ada`);
    continue;
  }
  const mb = sizeMB(p);
  try {
    rmSync(p, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
    freed += mb;
    console.log(`✔ ${rel.padEnd(26)} dihapus (~${mb} MB)`);
  } catch (e) {
    console.log(`✘ ${rel.padEnd(26)} gagal: ${e.message}`);
    console.log("   Kemungkinan masih dipakai proses node. Jalankan: Get-Process node | Stop-Process -Force");
  }
}

/* tsbuildinfo bikin typecheck incremental menyimpan state lama */
try {
  for (const f of readdirSync(root)) {
    if (f.endsWith(".tsbuildinfo")) {
      const p = path.join(root, f);
      const mb = Math.round(lstatSync(p).size / MB);
      rmSync(p, { force: true });
      freed += mb;
      console.log(`✔ ${f.padEnd(26)} dihapus`);
    }
  }
} catch {
  /* abaikan */
}

console.log(`\nTotal dibebaskan: ~${freed} MB`);
console.log("Source code, node_modules, dan lockfile TIDAK disentuh.");
console.log("Lanjut: npm run doctor  →  npm run verify:safe\n");