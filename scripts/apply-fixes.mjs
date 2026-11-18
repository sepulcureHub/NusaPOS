#!/usr/bin/env node
/**
 * NusaPOS — patch v2 (CRLF-safe, idempoten).
 * Jalankan dari root repo:  npm run patch
 * Semua anchor multi-baris dinormalisasi ke \n dulu, EOL asli dipulihkan saat menulis.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const report = [];
let failed = 0;

function read(p) {
  if (!existsSync(p)) { failed++; report.push(`✘ ${p} — file tidak ditemukan`); return null; }
  const raw = readFileSync(p, "utf8");
  return { text: raw.replace(/\r\n/g, "\n"), crlf: raw.includes("\r\n") };
}
function edit(p, note, fn) {
  const data = read(p); if (!data) return;
  let out;
  try { out = fn(data.text); } catch (e) { failed++; report.push(`✘ ${p} — ${note}: ${e.message}`); return; }
  if (out === null || out === data.text) { report.push(`• ${p} — ${note}: sudah / pola tidak cocok`); return; }
  writeFileSync(p, data.crlf ? out.replace(/\n/g, "\r\n") : out, "utf8");
  report.push(`✔ ${p} — ${note}`);
}
function sub(p, from, to, note) {
  edit(p, note, (t) => (t.includes(from) ? t.split(from).join(to) : null));
}
function dropImport(p, name, note) {
  edit(p, note, (t) => {
    const re = /import\s+(type\s+)?\{([\s\S]*?)\}\s+from\s+(["'][^"']+["']);?/g;
    let hit = false;
    const out = t.replace(re, (whole, tk, body, src) => {
      const parts = body.split(",").map((s) => s.trim()).filter(Boolean);
      if (!parts.includes(name)) return whole;
      hit = true;
      const kept = parts.filter((s) => s !== name);
      return kept.length ? `import ${tk ?? ""}{ ${kept.join(", ")} } from ${src};` : "";
    });
    return hit ? out.replace(/\n{3,}/g, "\n\n") : null;
  });
}
/** Rename variabel/arg nganggur di baris tertentu jadi berawalan _ (sesuai varsIgnorePattern). */
function renameUnused(p, lineNo, name, note) {
  edit(p, note, (t) => {
    const lines = t.split("\n");
    const line = lines[lineNo - 1];
    if (line == null) return null;
    const re = new RegExp(`\\b${name}\\b(?!\\s*:)`);
    if (!re.test(line)) return null;
    if (!/(const|let|var|function|=>|\{)/.test(line)) return null;
    const inBraces = /\{[^}]*\}/.test(line);
    const next = line.replace(re, inBraces ? `${name}: _${name}` : `_${name}`);
    report.push(`   ${p}:${lineNo}\n   - ${line.trim()}\n   + ${next.trim()}`);
    lines[lineNo - 1] = next;
    return lines.join("\n");
  });
}
/** Tambah dependency ke array deps di baris tertentu. */
function addDep(p, lineNo, dep, note) {
  edit(p, note, (t) => {
    const lines = t.split("\n");
    const line = lines[lineNo - 1];
    if (line == null || line.includes(dep) || !/\]\s*\)\s*;/.test(line)) return null;
    const m = line.match(/^(.*\[)([^\]]*)(\].*)$/);
    if (!m) return null;
    const deps = m[2].trim().replace(/,\s*$/, "");
    const next = `${m[1]}${deps ? `${deps}, ` : ""}${dep}${m[3]}`;
    report.push(`   ${p}:${lineNo}\n   - ${line.trim()}\n   + ${next.trim()}`);
    lines[lineNo - 1] = next;
    return lines.join("\n");
  });
}

/* ══ 1. WARNING: import nganggur ══ */
dropImport("components/Shell.tsx", "STORE_CLOSE", "hapus import STORE_CLOSE");
dropImport("components/PaymentModal.tsx", "clamp", "hapus import clamp");
dropImport("components/MemberPicker.tsx", "rupiah", "hapus import rupiah");
dropImport("app/shift/page.tsx", "ITrash", "hapus import ITrash");

/* ══ 2. WARNING: variabel & argumen nganggur ══ */
renameUnused("components/Shell.tsx", 506, "role", "rename role → _role");
renameUnused("components/MemberBenefits.tsx", 33, "dense", "rename dense → _dense");

/* ══ 3. WARNING: useEffect kurang dependency ══ */
addDep("app/member/page.tsx", 599, "state.tables", "tambah dep state.tables");

/* ══ 4. ERROR: DOM write redundan (Shell sudah punya effect accent) ══ */
edit("app/pengaturan/page.tsx", "hapus DOM write accent di pickAccent", (t) => {
  const out = t.replace(/^[ \t]*document\.documentElement\.dataset\.accent = v;[ \t]*\n/gm, "");
  return out === t ? null : out;
});
edit("app/pengaturan/page.tsx", "hapus DOM write accent di importJSON", (t) => {
  const out = t.replace(/^[ \t]*document\.documentElement\.dataset\.accent = restored\.settings\.accent;[ \t]*\n/gm, "");
  return out === t ? null : out;
});

/* ══ 5. Patch v1 — diulang supaya kalau kemarin gagal/belum jalan, sekarang beres ══ */
sub("components/Shell.tsx",
  '{ href: "/notifikasi", label: "Notifikasi", icon: IBell, perm: null }',
  '{ href: "/notifikasi", label: "Notifikasi", icon: IBell, perm: "notif.view" }',
  "menu Notifikasi → perm notif.view");

sub("components/MemberAuth.tsx",
  "const [remember, setRemember] = useState(true)",
  "const [remember, setRemember] = useState(false)",
  "remember default false");

sub("lib/geocode-server.ts",
  "+https://nusapos.local",
  "+https://github.com/sepulcureHub/NusaPOS; contact: sayahafizh1314@gmail.com",
  "UA Nominatim pakai kontak nyata");

sub("lib/member.ts",
  "export function makePin() {\n  return String(Math.floor(100000 + Math.random() * 900000));\n}",
  `/** PIN 6 digit dari CSPRNG. Rejection sampling supaya distribusinya rata. */
export function makePin() {
  const c = globalThis.crypto;
  if (c?.getRandomValues) {
    const SPAN = 900000;
    const LIMIT = 0x100000000 - (0x100000000 % SPAN);
    const buf = new Uint32Array(1);
    let x = 0;
    do { c.getRandomValues(buf); x = buf[0]!; } while (x >= LIMIT);
    return String(100000 + (x % SPAN));
  }
  return String(Math.floor(100000 + Math.random() * 900000));
}`,
  "makePin pakai crypto.getRandomValues");

{
  const p = "app/pengaturan/page.tsx";
  sub(p, 'import { useAuth, useStore } from "@/lib/store";',
        'import { normalize, useAuth, useStore } from "@/lib/store";',
        "import normalize dari store");
  sub(p,
    "        if (p?.v === 1 && p.state) {\n          const merged: Settings = { ...DEMO_SETTINGS, ...(p.state.settings ?? {}) };",
    "        if (p?.v === 1 && p.state && typeof p.state === \"object\") {\n          /* Satu pintu validasi: normalize() juga dipakai StoreProvider. */\n          const restored = normalize({\n            ...p.state,\n            users: state.users,\n            session: state.session,\n            memberSession: state.memberSession,\n          });",
    "validasi backup lewat normalize()");
  sub(p,
    "            state: {\n              ...state,\n              ...p.state,\n              settings: merged,\n              users: state.users,\n              session: state.session,\n              memberSession: state.memberSession,\n              hydrated: true,\n            },",
    "            state: restored,",
    "HYDRATE pakai state ternormalisasi");
  sub(p, "          applyTheme(merged.theme);", "          applyTheme(restored.settings.theme);", "tema hasil restore");
  sub(p,
    '          push({ msg: "Backup dipulihkan · akun terdaftar tetap dipakai", type: "ok" });',
    '          push({\n            msg: `Backup dipulihkan & divalidasi · ${restored.products.length} produk · ${restored.transactions.length} transaksi · ${restored.tables.length} meja`,\n            type: "ok",\n            dur: 6000,\n          });',
    "toast laporan restore");
  sub(p,
    '        push({ msg: "File backup tidak valid", type: "err" });',
    '        push({ msg: "File backup tidak valid — pastikan hasil ekspor NusaPOS (format { v: 1, state })", type: "err" });',
    "pesan error lebih jelas");
  sub(p, "    reader.readAsText(file);",
    "    reader.onerror = () => {\n      sfx.error();\n      push({ msg: \"File tidak bisa dibaca\", type: \"err\" });\n    };\n    reader.readAsText(file);",
    "tangani FileReader error");
  dropImport(p, "DEMO_SETTINGS", "hapus import DEMO_SETTINGS yang jadi nganggur");
}

console.log(report.join("\n"));
if (failed) { console.error(`\n${failed} kegagalan. Cek pesan ✘ di atas.`); process.exit(1); }
console.log("\nSelesai. Lanjut: npm ci  →  npm run verify");