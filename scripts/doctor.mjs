#!/usr/bin/env node
/**
 * NusaPOS — diagnostik lingkungan build. Jalankan: npm run doctor
 * Dirancang untuk kasus "Committing semi space failed" / worker OOM di Windows:
 * yang diperiksa adalah DISK, COMMIT CHARGE, PAGE FILE, dan PROSES YATIM —
 * bukan cuma jumlah CPU.
 */
import os from "node:os";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statfsSync, readdirSync, lstatSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MB = 1024 * 1024;
const totalMB = Math.round(os.totalmem() / MB);
const freeMB = Math.round(os.freemem() / MB);
const threads = os.cpus().length;
const major = Number(process.versions.node.split(".")[0]);
const problems = [];
const notes = [];
const line = (k, v) => console.log(`${k.padEnd(28)} ${v}`);

function ps(command) {
  try {
    return execFileSync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", command],
      { encoding: "utf8", timeout: 20000 }
    ).trim();
  } catch {
    return "";
  }
}

function dirSizeMB(dir, capFiles = 200000) {
  if (!existsSync(dir)) return 0;
  let bytes = 0;
  let seen = 0;
  const stack = [dir];
  while (stack.length && seen < capFiles) {
    const cur = stack.pop();
    let entries;
    try {
      entries = readdirSync(cur, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      if (++seen > capFiles) break;
      const p = path.join(cur, e.name);
      try {
        if (e.isSymbolicLink()) continue;
        if (e.isDirectory()) stack.push(p);
        else bytes += lstatSync(p).size;
      } catch {
        /* abaikan */
      }
    }
  }
  return Math.round(bytes / MB);
}

console.log("\n── Node & mesin ────────────────────────────");
line("Platform", `${process.platform} ${os.release()}`);
line("Node", `${process.version} (${process.arch})`);
line("CPU logical", `${threads} thread`);
line("RAM total / bebas", `${totalMB} MB / ${freeMB} MB`);
line("NODE_OPTIONS", process.env.NODE_OPTIONS ? `"${process.env.NODE_OPTIONS}"` : "(kosong)");
line("NEXT_BUILD_CPUS", process.env.NEXT_BUILD_CPUS ?? "(default config: 2)");

const nextPkg = path.join(root, "node_modules", "next", "package.json");
line("Next", existsSync(nextPkg) ? JSON.parse(readFileSync(nextPkg, "utf8")).version : "BELUM TERPASANG");

console.log("\n── Disk & cache ────────────────────────────");
let diskFreeMB = null;
try {
  const st = statfsSync(root);
  diskFreeMB = Math.round((st.bavail * st.bsize) / MB);
  line("Disk bebas (project)", `${diskFreeMB} MB`);
} catch {
  line("Disk bebas", "(tidak terbaca)");
}
const nextSize = dirSizeMB(path.join(root, ".next"));
const cacheSize = dirSizeMB(path.join(root, "node_modules", ".cache"));
line("Ukuran .next", `${nextSize} MB`);
line("Ukuran node_modules/.cache", `${cacheSize} MB`);

let commitFreeMB = null;
let nodeProcs = [];
if (process.platform === "win32") {
  console.log("\n── Commit charge & page file ───────────────");
  const osInfo = ps(
    "$o=Get-CimInstance Win32_OperatingSystem; " +
      "'CommitLimitMB=' + [int]($o.TotalVirtualMemorySize/1KB); " +
      "'CommitFreeMB=' + [int]($o.FreeVirtualMemory/1KB)"
  );
  console.log(osInfo || "(tidak terbaca)");
  commitFreeMB = Number(/CommitFreeMB=(\d+)/.exec(osInfo)?.[1] ?? 0) || null;

  const pf = ps("Get-CimInstance Win32_PageFileUsage | Select-Object Name,AllocatedBaseSize,CurrentUsage | Format-List");
  console.log(pf || "(TIDAK ADA page file terdaftar)");
  const auto = ps("(Get-CimInstance Win32_ComputerSystem).AutomaticManagedPagefile");
  line("Page file otomatis", auto || "?");
  if (!pf) problems.push("Page file tidak ada / dimatikan. Set 'System managed size' lewat sysdm.cpl lalu restart.");

  console.log("\n── Proses node.exe ─────────────────────────");
  const raw = ps(
    "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | " +
      "ForEach-Object { $_.ProcessId.ToString() + '|' + [int]($_.WorkingSetSize/1MB) }"
  );
  nodeProcs = raw
    .split(/\r?\n/)
    .map((l) => l.split("|"))
    .filter((p) => p.length === 2)
    .map(([pid, mb]) => ({ pid, mb: Number(mb) }));
  const others = nodeProcs.filter((p) => Number(p.pid) !== process.pid);
  const hogMB = others.reduce((a, p) => a + p.mb, 0);
  line("Jumlah node.exe lain", `${others.length} proses, ~${hogMB} MB`);
  if (others.length > 3) {
    problems.push(
      `Ada ${others.length} proses node.exe lain (~${hogMB} MB) — kemungkinan yatim sisa build yang crash. ` +
        "Bersihkan: Get-Process node | Stop-Process -Force"
    );
  }
}

console.log("\n── Pemeriksaan ─────────────────────────────");
if (process.arch !== "x64" && process.arch !== "arm64") {
  problems.push(`Node ${process.arch} (32-bit). Ganti ke Node x64 — address space 32-bit bikin commit gagal dini.`);
}
if (major < 22) problems.push(`Node ${process.version} < 22.12. Upgrade sesuai engines di package.json.`);
if (!existsSync(nextPkg)) problems.push("node_modules/next belum ada. Jalankan `npm ci`.");
if (diskFreeMB !== null && diskFreeMB < 2048) {
  problems.push(
    `Disk tinggal ${diskFreeMB} MB. Page file tidak bisa membesar → commit limit mentok → SEMUA proses Node mati dini. ` +
      "Bersihkan disk (cleanmgr, %TEMP%) dan jalankan `npm run clean`."
  );
}
if (commitFreeMB !== null && commitFreeMB < 1500) {
  problems.push(
    `Commit memory bebas cuma ${commitFreeMB} MB. Ini penyebab langsung "Committing semi space failed". ` +
      "Bunuh node yatim, tutup aplikasi berat, besarkan page file."
  );
}
if (freeMB < 1500) notes.push(`RAM bebas ${freeMB} MB — tipis. Tutup Chrome/Docker/WSL sebelum build.`);
if (nextSize + cacheSize > 1500) {
  notes.push(`Cache build ${nextSize + cacheSize} MB. Jalankan \`npm run clean\` untuk membebaskan disk & commit.`);
}
if (process.env.NODE_OPTIONS && /semi-space|max-old-space/.test(process.env.NODE_OPTIONS)) {
  problems.push(
    "NODE_OPTIONS berisi flag heap/semi-space. Nilai ini diwariskan ke semua worker Next dan bisa memperburuk. " +
      'Kosongkan: $env:NODE_OPTIONS=""'
  );
}

console.log("\n── Hasil ───────────────────────────────────");
notes.forEach((n) => console.log(`• ${n}`));
if (problems.length) {
  problems.forEach((p) => console.log(`✘ ${p}`));
  console.log("\nUrutan perbaikan: npm run clean  →  bunuh node yatim  →  page file  →  npm run verify:safe\n");
  process.exitCode = 1;
} else {
  console.log("✔ Lingkungan sehat. Lanjut: npm run verify\n");
}