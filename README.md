# 🌊 NusaPOS — Sistem Kasir Digital Nusantara

POS lengkap untuk UMKM Indonesia: **Kasir, Produk, Transaksi + Refund, Analitik grafik, Pengaturan** — dibangun dengan stack terbaru (per akhir 2026):

| Teknologi | Versi |
|---|---|
| Next.js (App Router, Turbopack) | 16.x |
| React | 19.x |
| TypeScript | 5.x |
| Tailwind CSS | 4.x |
| Grafik | SVG custom interaktif (tanpa library chart) |

## ✨ Fitur

- **Kasir**: grid produk + kategori, pencarian (`/` fokus, `Enter` tambah), keranjang dengan stepper qty, diskon Rp/%, pilih/tambah pelanggan, tahan order (hold & resume), PPN + service otomatis, bayar **Tunai (keypad + kembalian + uang pas)**, **QRIS (simulasi QR)**, **Kartu (simulasi EDC)**, struk thermal + **cetak**, stok berkurang otomatis, efek suara.
- **Dashboard**: KPI hari ini vs kemarin + sparkline, tren 14 hari, donat kategori, transaksi terbaru, alert stok menipis + restok cepat, aksi cepat.
- **Produk**: CRUD lengkap (drawer form + validasi + emoji picker), cari/filter/sort, **drag & drop reorder**, **bulk select** (aktifkan/nonaktifkan/hapus/CSV), **saved views**, **undo** setelah hapus, toggle aktif, adjust stok inline.
- **Transaksi**: filter periode/metode/status + pencarian, pagination, **drawer detail + struk**, **refund** (stok kembali, bisa di-undo), cetak, ekspor CSV.
- **Analitik**: periode 7/30/90 hari, perbandingan periode sebelumnya, tren pendapatan, pangsa kategori, jam sibuk, **heatmap hari×jam**, split metode bayar, produk terlaris, insight otomatis, ekspor laporan CSV.
- **Pengaturan**: profil toko & footer struk (live), PPN/service/batas stok, 3 tema aksen, suara on/off, **backup/restore JSON**, acak ulang data demo.
- Data demo 90 hari ter-seed deterministik, persist di `localStorage`, responsif desktop & mobile (bottom nav + cart sheet).

## 🚀 Setup Langkah demi Langkah

### 1. Prasyarat
- **Node.js ≥ 20.9** (disarankan 22 LTS) → cek: `node -v`
- npm (bawaan Node). Install Node dari https://nodejs.org bila belum ada.

### 2. Buat folder proyek
```bash
mkdir nusapos && cd nusapos
```
Salin **semua file** dari deliverable ini sesuai struktur folder (buat folder `app/`, `components/`, `lib/`, lalu subfolder `app/kasir`, `app/produk`, `app/transaksi`, `app/analitik`, `app/pengaturan`).

> Alternatif: `npx create-next-app@latest nusapos --typescript --tailwind --app --no-src-dir --import-alias "@/*"` lalu timpa file bawaan dengan file di atas dan samakan `package.json`-nya.

### 3. Install dependency
```bash
npm install
```

### 4. Jalankan development server
```bash
npm run dev
```
Buka **http://localhost:3000** — data demo langsung terisi.

### 5. Alur coba cepat
1. **Kasir** → klik beberapa produk → atur diskon → **Bayar** → pilih Tunai, tekan "Uang Pas" → **Konfirmasi** → struk muncul → **Cetak Struk** / **Transaksi Baru**.
2. **Transaksi** → klik baris → drawer struk → coba **Refund** lalu **Urungkan** dari toast.
3. **Produk** → drag baris (sort "Urutan manual") → centang beberapa → hapus → undo.
4. **Analitik** → ganti periode 7/30/90 & toggle Bandingkan → hover grafik.
5. **Pengaturan** → ubah PPN/nama toko/aksen → lihat efeknya langsung di kasir & struk.

### 6. Build production
```bash
npm run build
npm start
```

### 7. Deploy (Vercel, paling mulus untuk Next.js)
1. Push folder ke GitHub.
2. https://vercel.com → **Add New Project** → import repo → framework terdeteksi otomatis → **Deploy**.

## 🛠 Troubleshooting

| Masalah | Solusi |
|---|---|
| Port 3000 terpakai | `npm run dev -- -p 3001` |
| Build gagal download font | `next/font/google` butuh internet saat build; ulangi saat online |
| Data aneh / ingin mulai bersih | Pengaturan → **Acak Ulang Data Demo**, atau hapus key `nusapos:v1` di DevTools → Application → Local Storage |
| Error aneh setelah ubah versi | Hapus `.next` dan `node_modules`, lalu `npm install` lagi |
| Node versi lama | Next 16 wajib Node ≥ 20.9 |

## 📌 Catatan Produksi
Demo ini 100% client-side (localStorage) dan pembayaran QRIS/Kartu adalah **simulasi**. Untuk produksi: tambahkan database (mis. Prisma + Postgres via Route Handlers/Server Actions), auth, dan payment gateway (Midtrans/Xendit) — struktur `lib/store.tsx` (reducer + action) sudah memisahkan logika mutasi sehingga mudah dipindah ke API.