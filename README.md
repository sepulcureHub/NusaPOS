# NusaPOS

[![CI](https://github.com/sepulcureHub/NusaPOS/actions/workflows/ci.yml/badge.svg)](https://github.com/sepulcureHub/NusaPOS/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16.4-black.svg)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19.3-61dafb.svg)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9_strict-3178c6.svg)](https://www.typescriptlang.org)
[![Vitest](https://img.shields.io/badge/tested_with-Vitest_5-6E9F18.svg)](https://vitest.dev)
[![Node](https://img.shields.io/badge/node-%E2%89%A522.12-339933.svg)](https://nodejs.org)

**Sistem Point of Sale (POS) berbasis web untuk UMKM Indonesia** — dibangun dengan Next.js App Router, React, TypeScript strict, dan Tailwind CSS. Tanpa library UI, ikon, maupun chart pihak ketiga.

NusaPOS adalah aplikasi kasir modern dengan fitur:

- Kasir cepat untuk admin & kasir, dengan opsi **Makan di sini / Bawa pulang**
- **Sistem meja dine-in**: denah visual, meja otomatis terisi saat pembayaran selesai
- **Pemantauan meja live** di halaman Member & Portal Member
- Katalog produk, promo harian, dan paket bundling
- Program member berbasis **akumulasi belanja** (tier Bronze–Platinum, bonus diatur per tier)
- Sistem poin yang bisa ditukar hadiah
- Portal member mandiri: benefit, produk & promo, ketersediaan meja, poin, riwayat, profil
- Shift kasir dengan tutup otomatis + skor performa kasir
- **Sinkron antar tab** di browser yang sama (status meja, stok, katalog, transaksi)
- Notifikasi aktivitas sistem dengan izin granular
- Pengaturan bertingkat: tema, brand, pajak, pengguna, **meteran penyimpanan**, **pratinjau impor backup**, **ganti password**
- Halaman pelanggan / landing page + integrasi Google Maps
- Penyimpanan lokal demo menggunakan `localStorage`

> Proyek ini adalah **demo lokal / prototype operasional**, bukan backend produksi.
> Semua data disimpan di browser perangkat yang sedang digunakan.
> "Realtime" berarti live **antar tab di browser yang sama** — belum antar perangkat.

---

## Status Kualitas

Per rilis **v1.1.3** (CI hijau penuh):

| Metrik | Nilai |
|---|---|
| CI (lint · build · typecheck · unit test) | ✅ semua lolos |
| ESLint | **0 error, 0 warning** |
| TypeScript `strict` | lolos, **0 `any`**, **0 `@ts-ignore`** |
| Unit test | **23 kasus · 60 assertion · 6 grup** (Vitest) |
| Import / variabel nganggur | 0 |
| `console.log` / `TODO` tertinggal | 0 |
| Kode TypeScript | ±19.800 baris (65 file `.ts`/`.tsx`) |
| Dependency runtime | **3** (`next`, `react`, `react-dom`) |

---

## Daftar Isi

- [Tech Stack](#tech-stack)
- [Fitur Utama](#fitur-utama)
- [Role Pengguna](#role-pengguna)
- [Alur Login](#alur-login)
- [Sistem Member](#sistem-member)
- [Sistem Poin & Hadiah](#sistem-poin--hadiah)
- [Sistem Meja & Dine-in](#sistem-meja--dine-in)
- [Mode Uji Admin di Kasir](#mode-uji-admin-di-kasir)
- [Notifikasi Sistem](#notifikasi-sistem)
- [Sinkronisasi Data](#sinkronisasi-data)
- [Quality Gate](#quality-gate)
- [Unit Test](#unit-test)
- [Struktur Folder](#struktur-folder)
- [Instalasi](#instalasi)
- [Environment Variables](#environment-variables)
- [Scripts](#scripts)
- [Build di Mesin RAM Terbatas](#build-di-mesin-ram-terbatas)
- [Akun Demo](#akun-demo)
- [Halaman Utama](#halaman-utama)
- [Data & Backup](#data--backup)
- [Keamanan & Hardening](#keamanan--hardening)
- [Deployment](#deployment)
- [Known Limitations](#known-limitations)
- [Troubleshooting](#troubleshooting)
- [Roadmap](#roadmap)
- [Riwayat Update](#riwayat-update)
- [License](#license)

---

## Tech Stack

| Teknologi | Versi | Keterangan |
|---|---|---|
| Next.js | 16.4.6 | App Router, Turbopack |
| React | 19.3.1 | UI library |
| TypeScript | 5.9.3 | `strict: true`, tanpa `any` |
| Tailwind CSS | 4.3.5 | via `@tailwindcss/postcss` |
| ESLint | 9.39.5 | flat config (`eslint-config-next` 16.4.6) |
| Vitest | 5.1.1 | unit test (peer: Vite 7) |
| GitHub Actions | — | CI: lint · build · typecheck · test |
| localStorage | — | penyimpanan demo lokal |
| Google Maps Embed | — | peta lokasi toko |
| Nominatim / Photon | — | fallback geocoding publik |

**Catatan desain:**

- Runtime minimal **Node.js >= 22.12.0** (lihat `engines` di `package.json`).
- Dependencies runtime sengaja **hanya 3**: `next`, `react`, `react-dom`.
- State management, komponen UI, ikon, chart, dan denah meja **dibangun sendiri** —
  `lib/store.tsx`, `components/ui.tsx`, `components/icons.tsx`, `components/charts.tsx`, `components/TableGrid.tsx`.
- `eslint` dan `eslint-config-next` **dipin versi persis** supaya hasil lint lokal == CI.
- Chart mendukung hover, navigasi keyboard (panah/Home/End/Esc), `prefers-reduced-motion`,
  dan label langsung pada segmen — bukan cuma warna.

---

## Fitur Utama

### 1. Kasir Cepat

Halaman `/kasir` digunakan untuk:

- memilih produk & menambah ke cart
- memilih pelanggan/member (diskon member otomatis)
- memilih **tipe pesanan: Makan di sini / Bawa pulang**
- memilih **meja** lewat denah visual (khusus Makan di sini)
- membayar Tunai / QRIS / Kartu
- mencetak struk (termasuk tipe pesanan & meja)
- menahan order (hold order)
- membuka/menutup shift kasir
- melihat ketersediaan meja lewat chip **"Meja X/Y"**

Kasir hanya bisa bekerja jika sedang memiliki **shift aktif**.

Setiap penjualan otomatis:

- memotong stok produk (termasuk komponen paket bundling)
- menambah poin, kunjungan, dan akumulasi belanja member
- **mengisi meja** bila tipe pesanan Makan di sini
- mencatat notifikasi aktivitas & mengaitkan transaksi ke shift berjalan

Refund membalik semuanya: stok kembali, poin/akumulasi member dikurangi, dan **meja dikosongkan**.
**Batalkan refund** mengisi meja kembali — hanya kalau meja itu masih kosong dan aktif.

### 2. Katalog Produk

Halaman `/produk` dikelola oleh admin.

Fitur produk:

- nama, SKU (auto-generate: `KOP`, `NKP`, `MKN`, `CML`, `RTL`, `PKT`)
- kategori: Kopi / Non-Kopi / Makanan / Cemilan / Ritel
- harga jual, HPP, stok, deskripsi
- emoji / foto (foto disimpan sebagai data URL, dikompresi ke WebP)
- status aktif, diskon dasar (persen / nominal Rp)
- promo harian & hari ketersediaan
- produk satuan & paket bundling

Fitur katalog tambahan:

- drag & drop / pindah urutan produk
- aksi massal (aktif/nonaktif, diskon dasar, hapus + pulihkan)
- penyesuaian stok manual
- **saved views** — preset filter ("Stok menipis", "Promo hari ini", dll.)
- margin & HPP paket dihitung otomatis dari komponennya
- ekspor CSV

### 3. Promo Harian

Promo dijadwalkan per hari (Senin–Minggu) dan **menimpa diskon dasar** pada hari yang sama.

Contoh promo bawaan demo:

| Produk | Promo |
|---|---|
| Es Teh Melati | Senin 25% (dasar 10%) |
| Nasi Goreng Kampung | Selasa & Rabu 15% |
| Croissant Butter | Kamis 20% |
| Donat Gula Aren | Jumat 30% (dasar Rp2.000) |
| Matcha Latte | Sabtu 20% |
| Roti Bakar Srikaya | Minggu potong Rp6.000 (dasar 15%) |

Ketersediaan per hari juga didukung — contoh: Nasi Ayam Bali hanya Sabtu–Minggu,
Brownies Lava hanya Jumat–Minggu.

### 4. Paket Bundling

Contoh paket: Paket Ngopi Berdua, Paket Sarapan Nusantara, Paket Kerja Fokus.

Sistem menghitung:

- harga normal dari isi paket (harga efektif komponen hari itu)
- harga paket & penghematan
- stok porsi = `min(stok komponen ÷ qty kebutuhan)`
- HPP & margin paket dari total HPP komponen

Saat paket terjual, stok **komponen**-nya yang dipotong.

### 5. Sistem Meja (Dine-in / Takeaway)

- Denah meja visual per area (Indoor / Outdoor / Bar / VIP), lengkap ilustrasi kursi.
- Status **kosong (hijau)** / **terisi (merah)** dengan nama tamu & jam mulai.
- Kasir memilih meja kosong saat pembayaran **Makan di sini**; meja **otomatis terisi** setelah bayar.
- Staf bisa **mengosongkan meja** saat tamu pulang (Member → Meja).
- Admin bisa **mengelola denah**: tambah / edit / hapus / aktif-nonaktif meja.
- Customer bisa **memantau meja kosong dari portal member sebelum datang**.

Detail lengkap di [Sistem Meja & Dine-in](#sistem-meja--dine-in).

### 6. Halaman Pelanggan

Route `/beranda` — landing page publik berisi:

- hero & cerita brand (kedai demo: **Nusa Coffee & Eatery**, Malioboro, Yogyakarta)
- teks berjalan produk & promo hari ini
- promo per hari (bisa pratinjau hari lain)
- menu lengkap dengan filter, pencarian, favorit
- paket bundling & menu limited edition
- benefit member + penjelasan tier (angka bonus sesuai pengaturan admin)
- testimoni, FAQ, peta lokasi toko, jam buka

### 7. Portal Member Mandiri

Route `/memberku` — login **username + PIN 6 digit** (nomor member / nomor HP juga diterima).

| Tab | Isi |
|---|---|
| Ringkasan | Kartu member, progres tier, benefit aktif, shortcut produk & meja |
| Produk & Promo | Katalog live dari admin: pencarian, filter kategori/promo/hari ini, estimasi harga member |
| Meja | Denah meja live — cek meja kosong sebelum datang |
| Poin & Hadiah | Katalog hadiah, tukar poin, riwayat penukaran |
| Transaksi | Riwayat belanja + badge meja untuk transaksi dine-in |
| Profil | Edit profil, ganti PIN, kalender bonus ulang tahun |

Fitur "ingat login": maksimal **5 akun member** terakhir disimpan di perangkat
(key `nusapos:member-logins:v2`). **Default nonaktif.** PIN hanya di-obfuscate
(XOR + base64), **bukan dienkripsi** — lihat [Keamanan & Hardening](#keamanan--hardening).

### 8. Shift Kasir

Halaman `/shift`:

- jadwal shift mingguan per kasir (dikelola admin)
- buka shift dengan modal kas awal, tutup dengan hitung kas akhir
- rekonsiliasi: `kas diharapkan = kas awal + penjualan tunai − refund tunai`
- perpanjang shift aktif & **tutup otomatis** mengikuti jam jadwal
  (fallback jam tutup toko, support lintas tengah malam)
- pengecekan auto-close tiap 15 detik + saat tab kembali visible
- admin bisa buka/tutup paksa shift kasir
- ekspor CSV performa

Skor performa kasir (berbobot):

| Komponen | Bobot | Target |
|---|---|---|
| Kecepatan layanan | 20% | 8 transaksi/jam |
| Nilai keranjang | 20% | rata-rata Rp45.000 |
| Ketepatan shift | 15% | buka tepat waktu |
| Akurasi kas | 20% | selisih kas kecil |
| Kualitas transaksi | 15% | refund < 5% |
| Akuisisi member | 10% | member baru & transaksi member |

### 9. Dashboard & Analitik

- `/` — dashboard bisnis (admin)
- `/analitik` — tren harian, jam ramai, kategori, margin, performa produk
- `/transaksi` — riwayat, filter, refund, cetak ulang struk, **ekspor CSV** (admin)

Chart digambar sendiri (`components/charts.tsx`), tanpa library eksternal:

| Komponen | Fungsi | Interaksi |
|---|---|---|
| `AreaChart` | tren pendapatan + periode pembanding | scrub pointer, panah keyboard, penanda puncak, delta % |
| `Bars` | transaksi per jam + garis rata-rata | hover, keyboard, label puncak |
| `Donut` | komposisi kategori/metode | klik legenda untuk menyaring segmen, label % langsung |
| `Heatmap` | hari × jam | crosshair baris/kolom, readout sel, total per hari |
| `HBarList` | produk terlaris | urutkan omzet / terjual, medali peringkat |
| `PaymentSplit` | split Tunai/QRIS/Kartu | fokus per metode, rata-rata per transaksi |
| `Sparkline` | tren mini di kartu | — |

Semua chart menghormati `prefers-reduced-motion` dan punya empty state sendiri.

### 10. Pengaturan

Halaman `/pengaturan` (bertingkat sesuai role):

- tema dark / light / system + 5 aksen warna (tosca, ungu, nila, lembayung, lavender)
- efek suara notifikasi
- branding: nama, tagline, logo (bentuk/ukuran/plat), wordmark, pratinjau dua tema
- identitas toko: nama, alamat, telepon, footer struk
- pajak (default 11% PPN) & service charge, ambang stok menipis
- **simulasi struk interaktif** — pilih nominal & tier, hitungan identik dengan kasir
- **ganti password sendiri** dengan verifikasi password lama + indikator kekuatan
- kelola pengguna & akses (admin), pencarian akun, badge shift berjalan
- **meteran penyimpanan browser** (±5 MB) dengan peringatan bertingkat
- backup / impor JSON **dengan pratinjau & urungkan**, acak ulang & hapus data demo

> Pengaturan program member (poin, diskon, tier, bonus) dikelola di
> **Member → Benefit Member**, bukan di Pengaturan.

---

## Role Pengguna

| Role | Akses |
|---|---|
| **admin** | Seluruh sistem: dashboard, kasir, produk, semua transaksi, refund, ekspor CSV, semua member, hapus member, sesuaikan poin, analitik, **log notifikasi**, semua shift, pengaturan toko & pengguna, kelola denah meja, atur benefit member |
| **kasir** | Ruang kerja operasional: kasir (`pos`), lihat transaksi sendiri, cari & daftarkan/edit member, shift sendiri, pengaturan pribadi, kosongkan meja, benefit member baca-saja |

Detail teknis (`lib/auth.ts`):

- Permission granular via `ROLE_PERMS` + route guard `routeAllowed`.
- Pencocokan route **per segmen path**, bukan `startsWith` mentah —
  `/memberku` (publik) tidak lagi terjepit prefiks `/member`.
- `/notifikasi` butuh izin **`notif.view`** (admin saja); menu ikut disembunyikan untuk kasir.
- Setelah login: admin → `/`, kasir → `/kasir`.
- Akun admin/root **dilindungi**: tidak bisa dihapus, dinonaktifkan, atau diubah role/username-nya.
- Akun baru yang dibuat admin **selalu ber-role kasir**.
- Menonaktifkan/menghapus kasir otomatis menutup shift-nya yang terbuka.
- Shift hanya berlaku untuk role kasir.

---

## Alur Login

### Staff (admin / kasir)

1. Buka `/login`, masukkan username + password.
2. Password diverifikasi terhadap hash (`lib/auth.ts`).
3. Sesi disimpan di state aplikasi (persist di localStorage).
4. Redirect sesuai role: admin → `/`, kasir → `/kasir`.
5. Setiap route dicek terhadap permission role.

### Member (portal)

1. Kasir mendaftarkan member (nama, HP, username, tanggal lahir, dll).
2. Sistem membuatkan **nomor member** `NUSA-XXXX` dan **PIN 6 digit acak** (CSPRNG).
3. Member buka `/memberku`, login dengan **username / nomor member / nomor HP + PIN**.
4. Syarat: member aktif, portal aktif, punya PIN.
5. Sesi member terpisah dari sesi staff.

Validasi pendaftaran member:

- nama minimal 3 karakter
- nomor HP 8–16 digit, dinormalisasi (`+62` → `0`), tidak boleh duplikat
- username 3–20 karakter (`a-z`, `0-9`, `.`, `-`, `_`), unik antar member
- email opsional (divalidasi formatnya), tanggal lahir tidak boleh di masa depan

---

## Sistem Member

Tier naik otomatis dari **TOTAL AKUMULASI BELANJA (Rp)** — **bukan dari poin**.

| Tier | Ambang default | Bonus diskon default |
|---|---|---|
| Bronze | Rp0 | +0% (bisa diatur) |
| Silver | Rp1.500.000 | +1% |
| Gold | Rp5.000.000 | +3% |
| Platinum | Rp15.000.000 | +5% |

Komposisi diskon saat transaksi:

```
diskon member = diskon dasar + bonus tier + bonus ulang tahun
```

- Diskon dasar default **5%** (pengaturan 0–25%)
- Bonus per tier **semuanya bisa diatur admin (0–25%)**, termasuk **Bronze**
- Bonus ulang tahun default **+10%** di hari-H (pengaturan 0–25%)
- Total diskon member di-cap **40%**
- Berlaku hanya jika program member aktif dan member aktif

Urutan perhitungan uang (`lib/format.ts → calcTotals`), dijaga unit test:

```
subtotal → diskon order → diskon member → PPN & service → total
```

Pajak dihitung **di atas basis setelah diskon**, bukan di atas subtotal.

Tampilan penjelasan tier:

- Angka besar di kartu tier = **bonus yang diatur admin, persis**
  (atur 2% → tampil 2%, bukan dijumlah dengan dasar).
- Kartu benefit tier menampilkan mini-grid bonus per tier tanpa terpotong.
- Rumus kasir tetap `dasar + bonus tier + ultah`; angka total riil muncul di
  konteks simulasi/preview transaksi.

Aturan lain:

- Akumulasi & poin hanya dari transaksi berstatus **Selesai**; transaksi mode uji
  tidak memengaruhi statistik.
- Refund mengurangi kembali akumulasi, poin, dan kunjungan.
- Progres tier & sisa menuju tier berikutnya tampil di portal member.
- Migrasi otomatis: ambang tier lama berbasis poin dikonversi ke berbasis belanja saat hydrate.

---

## Sistem Poin & Hadiah

### Perolehan poin

- **1 poin per Rp1.000** belanja (rate bisa diatur, minimum Rp100)
- **+50 poin sambutan** saat pertama mendaftar (bisa diatur)
- Poin masuk otomatis saat transaksi selesai; admin bisa menyesuaikan manual

### Penukaran poin

- Katalog hadiah dikelola admin (nama, emoji, deskripsi, harga poin, status aktif)
- Penukaran dari **portal member** atau **kasir**, keduanya tercatat di riwayat
- Riwayat penukaran disimpan maksimal 500 entri terakhir

Katalog hadiah demo:

| Hadiah | Biaya poin | Status |
|---|---|---|
| Diskon Rp10.000 | 150 | aktif |
| Gratis Kopi Susu | 300 | aktif |
| Gratis Matcha Latte | 320 | aktif |
| Croissant Gratis | 350 | aktif |
| Voucher Rp25.000 | 400 | aktif |
| Tumbler Nusa Edisi Member | 900 | nonaktif |

---

## Sistem Meja & Dine-in

### Konsep

Setiap transaksi kasir punya **tipe pesanan**:

- **Makan di sini (dine-in)** → wajib pilih meja kosong; meja otomatis **terisi** setelah pembayaran selesai.
- **Bawa pulang (takeaway)** → tanpa meja.

### Denah meja

- Meja dikelompokkan per **area** (default: Indoor, Outdoor, Bar, VIP).
- Tiap meja punya: label, jumlah kursi (1–20), area, status, aktif/nonaktif.
- Visual: kartu meja dengan ilustrasi kursi mengelilingi meja; **hijau = kosong, merah = terisi**.
- Meja terisi menampilkan nama tamu + jam mulai duduk.

### Alur di kasir

1. Klik **Bayar** → pilih tipe pesanan.
2. Jika **Makan di sini**: denah meja tampil; hanya meja **kosong** yang bisa diklik.
3. Pilih meja → lanjut pembayaran (Tunai / QRIS / Kartu).
4. Selesai bayar → meja otomatis **terisi** atas nama pelanggan; struk mencantumkan tipe & meja.
5. Jika semua meja terisi: muncul peringatan — pilih Bawa pulang atau kosongkan meja dulu.

### Mengosongkan meja

- **Otomatis** saat transaksi dine-in di-**refund**.
- **Manual** oleh staf: **Member → Meja → daftar meja terisi → Kosongkan**.
- **Otomatis saat hydrate** bila meja标记 terisi tapi transaksinya sudah tidak ada
  atau sudah di-refund (`reconcileTables`) — tidak ada meja "nyangkut".

### Kelola denah (admin)

Di **Member → Meja → Kelola denah meja**:

- tambah meja (label, area, jumlah kursi)
- edit meja (tidak mengosongkan meja yang sedang terisi)
- hapus meja (bisa diurungkan lewat notifikasi)
- aktif / nonaktifkan meja

> Menghapus **semua** meja dihormati sistem. Denah kosong tidak akan
> dibangkitkan ulang menjadi 13 meja demo saat reload.

### Pemantauan live

- **Kasir**: chip "Meja X/Y" + modal overview denah.
- **Halaman Member → Meja**: statistik, denah live, daftar terisi + kosongkan, kelola denah (admin).
- **Portal Member → Meja**: customer melihat meja kosong/terisi sebelum datang.
- **Antar tab**: perubahan status meja di tab kasir langsung terlihat di tab lain
  pada browser yang sama.

> ⚠️ Batas "realtime": antar **perangkat berbeda** belum tersinkron — membutuhkan backend
> (lihat [Roadmap](#roadmap)).

### Data meja demo

13 meja · 42 kursi, semua mulai kosong:

| Area | Meja |
|---|---|
| Indoor | T01–T02 (2 kursi), T03–T05 (4 kursi), T06 (6 kursi) |
| Outdoor | O01 (2), O02–O03 (4), O04 (6) |
| Bar | B01–B02 (1), B03 (2) |

---

## Mode Uji Admin di Kasir

Admin bisa mencoba alur kasir **tanpa mencemari data**:

- Transaksi admin selalu ditandai `isTest` dan **tidak pernah dicatat** ke riwayat
- ID transaksi menjadi `TEST-…`, bukan nomor urut harian
- Stok tidak dipotong, poin/akumulasi member tidak berubah, notifikasi penjualan tidak dibuat
- **Meja tidak ikut terisi** saat mode uji
- Banner `KasirTestBanner` menandakan mode uji aktif
- Saat hydrate, transaksi `isTest` lama dibuang dari data

Berguna untuk demo ke klien atau latihan kasir baru.
Konsekuensinya: **admin tidak bisa mencatat penjualan nyata** — pakai akun kasir untuk itu.

---

## Notifikasi Sistem

Halaman `/notifikasi` (izin `notif.view`, admin) mencatat seluruh aktivitas penting:

| Kind | Contoh kejadian |
|---|---|
| `auth` | login / logout staff |
| `sale` | penjualan baru (termasuk info meja / bawa pulang), order ditahan |
| `refund` | refund / batal refund |
| `product` | tambah / edit / hapus / aktifkan produk |
| `stock` | penyesuaian stok |
| `member` | member baru, edit profil, login portal |
| `points` | penyesuaian & penukaran poin |
| `reward` | kelola katalog hadiah |
| `shift` | buka / tutup / perpanjang / auto-close |
| `settings` | perubahan pengaturan |
| `user` | kelola akun |
| `view` | saved view |
| `data` | acak ulang / hapus data demo |
| `system` | kejadian lain, termasuk aktivitas meja |

- Setiap notifikasi menyimpan waktu, judul, detail, dan **aktor**.
- Disimpan maksimal **300 entri** terbaru; status dibaca/tidak dibaca per timestamp.
- Bisa dicari, difilter per jenis & rentang waktu, dikelompokkan per hari.

---

## Sinkronisasi Data

Semua halaman membaca **satu sumber data yang sama** (`StoreProvider` di `lib/store.tsx`):

- Perubahan katalog oleh admin (harga, promo, stok, status) langsung tercermin di
  kasir, landing page, portal member, dan analitik.
- Penjualan memotong stok via reducer terpusat; refund mengembalikannya.
- Stok paket selalu **dihitung turunan** dari stok komponennya.
- **Status meja** berubah terpusat: terisi saat bayar dine-in, kosong saat refund /
  dikosongkan staf — semua tampilan meja ikut update.
- Saat dimuat, data dinormalisasi (`normalize`): SKU duplikat diperbaiki, hari
  ketersediaan divalidasi, diskon/promo dibersihkan, foto harus `data:image/`,
  meja lama dilengkapi default, transaksi `isTest` dibuang, meja yatim dikosongkan.
- Stok dibatasi 0–99.999.

### Sinkron antar tab

State disimpan dengan amplop ber-revisi:

```json
{ "v": 1, "rev": 1763, "writer": "tab-id", "state": { } }
```

- Penulisan di-debounce ±250 ms, `rev` memakai jam logis (ms) yang selalu naik.
- Tab lain mendengar event `storage`, membandingkan `rev`, lalu menerapkan
  state ternormalisasi lewat action `SYNC_REMOTE`.
- Kalau dua tab menulis di milidetik yang sama, pemenang ditentukan dari `writer`
  supaya kedua tab **konvergen**, bukan saling menimpa.
- **Sesi login tetap per tab** — tab kasir dan tab admin bisa login akun berbeda
  tanpa saling menendang.
- State yang datang dari tab lain tidak ditulis ulang (anti-gema).

> Karena berbasis localStorage, sinkronisasi ini berlaku **antar tab di browser
> yang sama** — bukan antar perangkat.

---

## Quality Gate

| Gate | Perintah | Diblokir CI |
|---|---|---|
| Lint | `npm run lint` | Ya, error memblokir |
| Typecheck | `npm run typecheck` | Ya, error memblokir |
| Unit test | `npm run test` | Ya |
| Build produksi | `npm run build` | Ya |
| Gabungan (lokal) | `npm run verify` | — dijalankan sebelum push |

**CI otomatis** via GitHub Actions (`.github/workflows/ci.yml`), jalan di setiap
push ke `main` dan PR. Dibagi **2 job paralel** supaya kegagalan lint tidak
menyembunyikan status build/typecheck/test:

| Job | Langkah |
|---|---|
| `Lint` | checkout → setup-node 22 → `npm ci` → `npm run lint` |
| `Build, typecheck & unit test` | checkout → setup-node 22 → `npm ci` → `build` → `typecheck` → `test` |

Catatan teknis:

- Step lint **terpisah** karena Next.js 16 menghapus `next lint` dan `next build`
  tidak lagi menjalankan ESLint.
- `build` dijalankan **sebelum** `typecheck` karena build yang menghasilkan
  `next-env.d.ts` dan route types.
- `actions/checkout@v7` + `actions/setup-node@v7` (runtime Node 24, bukan yang deprecated).
- `permissions: contents: read` dan `concurrency` per ref.

**Strategi lint** (`eslint.config.mjs`):

- **Error** = memblokir CI (bug nyata: hooks salah urutan, JSX invalid, `prefer-const`)
- **Warning** = terlihat di log, tidak memblokir

Override yang disengaja, dengan alasan:

| Rule | Alasan |
|---|---|
| `react-hooks/set-state-in-effect`, `purity`, `immutability` : off | Project **tidak memakai React Compiler**; tiga rule ini berasal dari pipeline validasi compiler dan menghasilkan false positive (setState saat hydrate, `Date.now()` di render demo, tulis DOM di event handler, akumulator lokal di `.map()`). `react-hooks/rules-of-hooks` **tetap error**. |
| `@next/next/no-img-element` : off | Foto produk/logo disimpan sebagai data URL base64 — `next/image` tidak mengoptimalkan data URL |
| `react/no-unescaped-entities` : off | Banyak teks UI Bahasa Indonesia memakai tanda kutip langsung |
| `@next/next/no-html-link-for-pages` : warn | Sebagian navigasi internal masih pakai `<a>` |
| Node globals untuk `scripts/**/*.mjs` | Tooling jalan di Node, bukan browser |

---

## Unit Test

Dijalankan dengan **Vitest 5** (`vitest.config.ts`, environment `node`, alias `@` aktif).

```bash
npm run test         # sekali jalan (dipakai CI)
npm run test:watch   # mode watch saat开发
```

Cakupan `lib/core.test.ts` — **6 grup, 23 kasus, 60 assertion**:

| Grup | Yang dijaga |
|---|---|
| `calcTotals — uang` | urutan subtotal → diskon order → diskon member → pajak; diskon nominal di-clamp ke subtotal; diskon member 100% menghanguskan basis pajak; service charge dihitung benar |
| `member — tier & diskon` | tier naik dari akumulasi belanja (bukan poin); diskon = dasar + bonus tier; cap 40%; member/program nonaktif = 0%; poin dibulatkan ke bawah; normalisasi HP `+62` → `0` dan tolak duplikat |
| `toCSV — anti formula injection` | sel diawali `= + - @` dinetralkan; angka negatif tetap angka; koma & kutip di-escape; BOM tetap ada |
| `meja` | kursi dibatasi 1–20; meja baru selalu kosong; statistik hanya menghitung meja aktif; **regresi:** hapus semua meja tidak membangkitkan demo; data lama tanpa key `tables` tetap dapat 13 meja |
| `akses route` | **regresi:** kasir ditolak di `/notifikasi`, admin diizinkan; `/memberku` tidak terjepit prefiks `/member`; refund & ekspor khusus admin |
| `rate limit geocode` | kuota habis → diblokir; window lewat → reset; key berbeda punya kuota sendiri; IP diambil dari `x-forwarded-for` |

Dua di antaranya adalah **regression test** untuk bug yang pernah terjadi, supaya
tidak bisa balik lagi diam-diam.

---

## Struktur Folder

```
NusaPOS/
├── app/                        # App Router (halaman & API)
│   ├── analitik/               # /analitik — analitik penjualan (admin)
│   ├── api/geocode/            # API server: geocoding + rate limit
│   ├── beranda/                # /beranda — landing page publik
│   ├── kasir/                  # /kasir — POS + tipe pesanan + pilih meja
│   ├── login/                  # /login — login staff
│   ├── member/                 # /member — benefit, member, produk, MEJA, hadiah
│   ├── memberku/               # /memberku — portal member mandiri
│   ├── notifikasi/             # /notifikasi — log aktivitas (notif.view)
│   ├── pengaturan/             # /pengaturan — settings bertingkat
│   ├── produk/                 # /produk — katalog (admin)
│   ├── shift/                  # /shift — jadwal & sesi shift
│   ├── transaksi/              # /transaksi — riwayat & refund
│   ├── error.tsx               # error boundary
│   ├── globals.css             # Tailwind + design tokens
│   ├── icon.svg                # favicon
│   ├── layout.tsx              # root layout + StoreProvider
│   ├── loading.tsx             # loading state
│   ├── not-found.tsx           # 404
│   └── page.tsx                # / — dashboard (admin)
├── components/                 # komponen UI reusable
│   ├── AuthField.tsx           # input form auth
│   ├── Brand.tsx               # logo & wordmark
│   ├── KasirTestBanner.tsx     # banner mode uji admin
│   ├── LandingPage.tsx         # konten /beranda
│   ├── LoginScreen.tsx         # layar login staff
│   ├── Marquee.tsx             # teks berjalan promo
│   ├── MemberAuth.tsx          # login portal member
│   ├── MemberBenefits.tsx      # panel benefit + TierLadder premium
│   ├── MemberForm.tsx          # form daftar/edit member
│   ├── MemberPicker.tsx        # pilih pelanggan di kasir
│   ├── PaymentModal.tsx        # modal pembayaran + EDC demo
│   ├── ProductAnalytics.tsx    # insight per produk
│   ├── ProductForm.tsx         # form produk & paket
│   ├── ProductThumb.tsx        # thumbnail emoji/foto
│   ├── QRISCenter.tsx          # tampilan pembayaran QRIS
│   ├── Receipt.tsx             # struk (tipe pesanan + meja)
│   ├── SearchField.tsx         # input pencarian + highlight
│   ├── Shell.tsx               # kerangka navigasi + route guard
│   ├── StoreMap.tsx            # peta Google Maps toko
│   ├── TableGrid.tsx           # denah meja visual (pilih / pantau)
│   ├── Toasts.tsx              # notifikasi toast + aksi urungkan
│   ├── charts.tsx              # chart custom (7 komponen, tanpa library)
│   ├── icons-extra.tsx         # ikon tambahan
│   ├── icons.tsx               # ikon utama
│   └── ui.tsx                  # primitif UI (button, card, modal, dll)
├── lib/                        # logika bisnis & state
│   ├── analytics.ts            # agregasi analitik penjualan
│   ├── auth.ts                 # hash password, role & permission, route guard
│   ├── brand.ts                # aksen warna & branding
│   ├── core.test.ts            # ★ unit test (23 kasus)
│   ├── demo-data.ts            # pusat data demo (produk, akun, settings, meja)
│   ├── format.ts               # rupiah, tanggal, calcTotals, toCSV aman
│   ├── geo-attribution.ts      # atribusi penyedia geocoding
│   ├── geo.ts                  # util geo klien
│   ├── geocode-server.ts       # geocoding sisi server + fallback
│   ├── media.ts                # kompresi foto/logo ke data URL
│   ├── member-login.ts         # simpan login member (maks 5, default off)
│   ├── member.ts               # tier, poin, diskon, validasi, PIN CSPRNG
│   ├── pricing.ts              # diskon, promo harian, bundling, stok
│   ├── product-analytics.ts    # analitik per produk
│   ├── rate-limit.ts           # ★ rate limit per IP (fixed window)
│   ├── seed.ts                 # generator data demo 90 hari + meja
│   ├── shift.ts                # sesi shift, auto-close, skor kasir
│   ├── sound.ts                # efek suara
│   ├── store.tsx               # StoreProvider + reducer + persist + sync antar tab
│   ├── tables.ts               # helper meja (statistik, area, label, factory)
│   └── types.ts                # seluruh tipe data
├── scripts/                    # ★ tooling pengembangan (Node, tanpa dependency)
│   ├── build.mjs               # build wrapper: worker dari RAM + auto-retry
│   ├── clean.mjs               # bersihkan .next & cache build
│   ├── doctor.mjs              # diagnostik disk/commit/page file/proses yatim
│   └── verify-lowmem.mjs       # verify hemat memori per langkah
├── .github/workflows/ci.yml    # CI: 2 job paralel
├── .env.example
├── .gitignore
├── LICENSE                     # MIT
├── README.md
├── eslint.config.mjs           # ESLint 9 flat config
├── next.config.ts              # batas worker build + strict mode
├── package.json
├── package-lock.json
├── postcss.config.mjs
├── tsconfig.json               # strict: true, noEmit: true
└── vitest.config.ts            # ★ konfigurasi Vitest + alias @
```

Total **81 file** tracked; ±19.800 baris TypeScript.

---

## Instalasi

Prasyarat: **Node.js >= 22.12.0** (64-bit) dan npm.

```bash
# 1. clone repo
git clone https://github.com/sepulcureHub/NusaPOS.git
cd NusaPOS

# 2. pasang dependencies (pakai ci supaya sesuai lockfile)
npm ci

# 3. (opsional) siapkan environment
cp .env.example .env.local
# isi API key Google Maps jika punya — tanpa ini aplikasi tetap jalan

# 4. verifikasi kualitas
npm run verify

# 5. jalankan development server
npm run dev
```

Buka `http://localhost:3000`, lalu login dengan [akun demo](#akun-demo).

Saat pertama kali dibuka (belum ada data tersimpan), aplikasi otomatis membuat
**data demo 90 hari** memakai seed tetap (`20261116`) agar hasil konsisten —
termasuk 13 meja demo.

> Mesin lu RAM-nya pas-pasan atau pernah kena OOM saat build?
> Baca [Build di Mesin RAM Terbatas](#build-di-mesin-ram-terbatas) dulu.

---

## Environment Variables

Salin `.env.example` menjadi `.env.local`:

```bash
# Opsional — bikin peta & geocoding Google jauh lebih akurat.
# Tanpa key ini, peta tetap Google Maps (mode embed publik) dan geocoding
# otomatis fallback ke Nominatim/Photon + basis lokasi offline.

# Dipakai di browser untuk Google Maps Embed API
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=

# Dipakai di server untuk Google Geocoding API (boleh diisi key yang sama)
GOOGLE_MAPS_API_KEY=
```

| Variabel | Dipakai di | Fungsi |
|---|---|---|
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Browser | Google Maps Embed (`StoreMap`) |
| `GOOGLE_MAPS_API_KEY` | Server (`app/api/geocode`) | Google Geocoding API |

Tanpa kedua key: peta memakai embed publik dan geocoding fallback ke
**Nominatim/Photon** + basis lokasi offline. Aplikasi tetap berfungsi penuh.

`.env.local` sudah masuk `.gitignore` — **jangan** commit API key.

Variabel tambahan untuk build (opsional, tanpa perlu edit kode):

| Variabel | Default | Fungsi |
|---|---|---|
| `NEXT_BUILD_CPUS` | `2` | Jumlah worker pengumpul page data |
| `NEXT_BUILD_PAGE_CONCURRENCY` | `4` | Konkurensi static generation |
| `NEXT_TURBO_FS_CACHE` | `1` | Set `0` untuk mematikan cache filesystem Turbopack |

---

## Scripts

| Script | Perintah | Fungsi |
|---|---|---|
| `dev` | `npm run dev` | Development server |
| `build` | `npm run build` | Build produksi (worker dibatasi via `next.config.ts`) |
| `build:smart` | `npm run build:smart` | Worker dihitung dari RAM bebas + auto-retry |
| `build:safe` | `npm run build:safe` | 1 worker, cache mati — mesin RAM/commit terbatas |
| `build:webpack` | `npm run build:webpack` | 1 worker pakai Webpack (fallback Turbopack) |
| `start` | `npm run start` | Jalankan hasil build |
| `lint` | `npm run lint` | ESLint 9 flat config |
| `lint:fix` | `npm run lint:fix` | ESLint dengan auto-fix |
| `lint:safe` | `npm run lint:safe` | ESLint di proses hemat memori |
| `typecheck` | `npm run typecheck` | TypeScript strict (`tsc --noEmit`) |
| `test` | `npm run test` | Unit test Vitest |
| `test:watch` | `npm run test:watch` | Vitest mode watch |
| `check` | `npm run check` | Lint + typecheck |
| `verify` | `npm run verify` | Lint + typecheck + test + build |
| `verify:safe` | `npm run verify:safe` | Semua langkah di proses terpisah, semi-space kecil |
| `doctor` | `npm run doctor` | Diagnostik: disk, commit charge, page file, proses node yatim |
| `clean` | `npm run clean` | Hapus `.next` & cache build (source tidak disentuh) |

---

## Build di Mesin RAM Terbatas

Bagian ini ada karena masalahnya **nyata pernah terjadi** di project ini, dan
jawabannya bukan yang biasa beredar di internet.

### Gejala

```
Collecting page data using 11 workers ...
FATAL ERROR: NewSpace::EnsureCurrentCapacity Allocation failed - JavaScript heap out of memory
```

atau bahkan saat lint:

```
npm notice run eslint .
FATAL ERROR: Committing semi space failed. Allocation failed - JavaScript heap out of memory
```

### Diagnosis

Perhatikan **angka heap-nya**. Kalau proses mati di **50–60 MB** (bukan di 2 GB),
itu **bukan** batas heap V8 terlampaui — itu **OS menolak commit memory**.

Penyebabnya di Windows:

1. **Commit limit habis** (RAM + page file). Page file dimatikan atau di-set kecil.
2. **Disk C: penuh** → page file tidak bisa membesar. Cache Turbopack bisa menumpuk GB di `.next`.
3. **Proses `node.exe` yatim** sisa build yang crash, masih memegang commit charge.
4. Worker terlalu banyak. Default Next 16 adalah `os.cpus().length - 1` —
   di mesin 12 thread itu **11 proses**, masing-masing mengimpor semua route module.

> **Jangan naikkan `--max-old-space-size` untuk error ini.** Itu solusi untuk OOM
> di dekat batas heap. Di sini malah memperbesar permintaan commit yang sudah
> ditolak OS. Arah yang benar: **bebaskan disk & commit, kurangi worker,
> kecilkan semi-space.**

### Yang sudah dilakukan di repo ini

`next.config.ts` membatasi worker secara deterministik:

```ts
experimental: {
  cpus: 2,                        // bukan os.cpus().length - 1
  memoryBasedWorkersCount: false, // angka tetap, bisa direproduksi
  workerThreads: false,           // fork process, heap terpisah
  staticGenerationMaxConcurrency: 4,
}
```

Plus 4 tool di `scripts/`, semuanya Node murni tanpa dependency tambahan.

### Alur perbaikan

```bash
# 1. lihat kondisi mesin sebenarnya
npm run doctor
```

`doctor` memeriksa: arsitektur & versi Node, RAM total/bebas, **ruang disk**,
**commit limit & sisa**, **page file**, **jumlah proses `node.exe` lain**,
ukuran `.next`/cache, dan `NODE_OPTIONS` yang nyangkut. Setiap temuan `✘`
dilengkapi perintah perbaikannya.

```bash
# 2. bebaskan disk & cache
npm run clean              # .next, node_modules/.cache, coverage, tsbuildinfo
npm run clean -- --all     # tambahan .turbo, .swc, out
```

```powershell
# 3. bunuh proses node yatim (Windows PowerShell)
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
$env:NODE_OPTIONS = ""
```

**4. Page file** — kalau `doctor` bilang tidak ada / kecil:
`Win + R` → `sysdm.cpl` → **Advanced** → Performance **Settings** → **Advanced**
→ Virtual memory **Change** → centang **Automatically manage paging file size**.
Atau manual: Initial **8192 MB**, Maximum **16384 MB**. **Restart.**

```bash
# 5. verifikasi dengan mode hemat memori
npm run verify:safe
```

`verify:safe` menjalankan lint → typecheck → test → build di **proses terpisah**,
masing-masing dengan `--max-old-space-size=1536 --max-semi-space-size=4`.
Semi-space **dikecilkan** supaya kebutuhan commit per scavenge lebih ringan.

### Tangga fallback build

```bash
npm run build            # normal (2 worker)
npm run build:smart      # worker dari RAM bebas + auto-retry bertingkat
npm run build:safe       # 1 worker, heap 2 GB, cache mati
npm run build:webpack    # 1 worker + Webpack
```

Flag `scripts/build.mjs`: `--workers=N`, `--heap=MB`, `--webpack`, `--no-cache`, `--no-retry`.
Flag `scripts/verify-lowmem.mjs`: `--only=lint|typecheck|test|build`, `--heap=MB`, `--semi=MB`.

Override tanpa edit kode:

```powershell
# PowerShell
$env:NEXT_BUILD_CPUS="1"; $env:NEXT_TURBO_FS_CACHE="0"; npm run build
```

```bash
# bash
NEXT_BUILD_CPUS=1 NEXT_TURBO_FS_CACHE=0 npm run build
```

> CI tidak terpengaruh: runner GitHub punya 2–4 core, jadi `cpus: 2` sudah pas.

---

## Akun Demo

### Staff

| Username | Password | Nama | Role |
|---|---|---|---|
| `admin` | `admin123` | Rani Pramesti | Administrator (root) |
| `kasir` | `kasir123` | Dimas Saputra | Kasir |
| `kasir2` | `kasir123` | Ayu Lestari | Kasir |

### Member (portal `/memberku`)

Semua member demo memakai PIN: **`123456`**

| Username | Nama | No. Member | Akumulasi | Tier |
|---|---|---|---|---|
| `siti` | Siti Rahma | NUSA-0001 | Rp2.260.000 | Silver |
| `dewi` | Dewi Lestari | NUSA-0002 | Rp5.140.000 | Gold |
| `maya` | Maya Putri | NUSA-0003 | Rp940.000 | Bronze |
| `nina` | Nina Kartika | NUSA-0004 | Rp310.000 | Bronze |

> Akun demo hanya untuk pengujian lokal. Ganti password sebelum dipakai demo publik
> (Pengaturan → Akun Saya → Ganti Password).

---

## Halaman Utama

| Route | Halaman | Akses |
|---|---|---|
| `/` | Dashboard bisnis | admin (`dashboard`) |
| `/kasir` | POS / kasir + tipe pesanan + meja | admin & kasir (`pos`) |
| `/produk` | Katalog produk & paket | admin (`products.view`) |
| `/transaksi` | Riwayat, refund, ekspor CSV | admin & kasir (`tx.view`; kasir: miliknya) |
| `/member` | Benefit, member, produk, meja, hadiah, penukaran | admin & kasir (`members.view`) |
| `/memberku` | Portal member mandiri | publik (login member) |
| `/shift` | Jadwal & sesi shift | admin & kasir (`shift.view`) |
| `/analitik` | Analitik penjualan | admin (`analytics`) |
| `/notifikasi` | Log aktivitas sistem | admin (`notif.view`) |
| `/pengaturan` | Pengaturan aplikasi & toko | bertingkat (`settings.*`) |
| `/beranda` | Landing page pelanggan | publik |
| `/login` | Login staff | publik |

Tab halaman **Member**: Benefit Member · Member · Produk Tersedia · Meja · Katalog Hadiah · Penukaran.
Tab **Portal Member**: Ringkasan · Produk & Promo · Meja · Poin & Hadiah · Transaksi · Profil.

---

## Data & Backup

### Penyimpanan

- Seluruh state aplikasi disimpan di localStorage key **`nusapos:v1`**
  (format `{ v: 1, rev, writer, state }`).
- Penulisan di-debounce ±250 ms setiap perubahan state.
- Login member tersimpan terpisah di **`nusapos:member-logins:v2`**
  (maks 5 akun, PIN di-obfuscate, **fitur default nonaktif**).
- Foto produk & logo disimpan inline sebagai data URL (WebP, dikompresi otomatis).
- Kalau kuota penuh, kegagalan tulis **memunculkan peringatan di console**
  dengan langkah perbaikan — tidak lagi bisu.
- Meteran pemakaian tampil di Pengaturan → Data & Backup.

### Data demo awal

Dibuat otomatis saat pertama kali dibuka (`lib/seed.ts`, seed `20261116`):

- 27 produk (24 satuan + 3 paket bundling)
- 9 pelanggan (4 member + 4 non-member + pelanggan umum)
- 3 akun staff, 13 template jadwal shift mingguan
- 6 katalog hadiah, 5 saved views
- **13 meja demo (42 kursi)** — Indoor, Outdoor, Bar; semua mulai kosong
- ±90 hari transaksi simulasi: 9–19 order/hari (+5 weekend), jam ramai siang & sore,
  mix bayar 42% QRIS / 36% Tunai / 22% Kartu, ~2% refund, kas awal shift Rp150.000
- Toko demo: jam operasional 07.00–22.00, pajak 11%, service 0%

### Kelola data (admin, Pengaturan → Data)

- **Ekspor JSON** seluruh data aplikasi
- **Impor JSON** — selalu melewati `normalize()` (SKU, stok, foto, meja, migrasi tier,
  buang transaksi uji), lalu ditampilkan **pratinjau** berisi jumlah produk/transaksi/
  member/meja/hadiah sebelum diterapkan. Bisa **diurungkan** lewat notifikasi.
  Akun terdaftar & sesi login tetap dipertahankan.
- **Acak ulang** data demo (regenerate seed; akun & sesi tetap)
- **Hapus data demo** (kosongkan produk/transaksi/member; akun, pengaturan,
  dan denah meja tetap)
- Ekspor **CSV transaksi**, **CSV member**, **CSV produk**, **CSV performa kasir**

> Pindah browser/perangkat = mulai dari data demo baru.
> Gunakan ekspor/impor JSON untuk memindahkan data.

---

## Keamanan & Hardening

Yang **sudah** dikerjakan:

| Item | Status |
|---|---|
| Ekspor CSV anti formula injection | Sel diawali `= + - @` dinetralkan (rekomendasi OWASP) |
| PIN member | Dibangkitkan dengan `crypto.getRandomValues` + rejection sampling (tanpa bias modulo) |
| "Ingat login" member | **Default nonaktif**; PIN hanya di-obfuscate, bukan dienkripsi |
| `/api/geocode` | Rate limit **20 req/menit/IP**, `400` untuk query invalid, `429` + `Retry-After` saat kuota habis |
| Geocoding User-Agent | Identitas + kontak nyata sesuai policy Nominatim |
| API key Google | Key server tidak pernah dikirim ke browser |
| Route guard | Per segmen path, izin granular, akun admin diproteksi |
| Impor backup | Satu pintu validasi (`normalize`), pratinjau, bisa diurungkan |
| `.env.local` | Masuk `.gitignore` |
| Header | `poweredByHeader: false`, `X-Robots-Tag: noindex` di API |

Yang **belum** — dan harus lu tahu sebelum dipakai serius:

- **Hash password custom** (`lib/auth.ts`, FNV-like + salt statis) — cukup untuk demo
  lokal, **bukan** hashing kriptografis (bcrypt/argon2).
- **Obfuscation PIN** (XOR + base64) bukan enkripsi. Siapa pun yang punya akses
  perangkat bisa membacanya.
- **Route guard 100% klien.** Semua data ada di browser, jadi ini bukan access
  control sungguhan — hanya pembatas UI.
- **Rate limit in-memory**, per instance. Di serverless multi-region perlu
  backing store seperti Upstash Redis / Vercel KV.
- **Pembayaran disimulasikan.** QRIS & kartu (EDC demo) tidak terhubung gateway.

---

## Deployment

```bash
npm run build
npm run start
```

Atau deploy ke platform seperti Vercel:

1. Push repo ke GitHub.
2. Import project di Vercel (framework terdeteksi: Next.js).
3. (Opsional) set environment variables Google Maps.
4. Deploy.

Yang perlu diingat:

- Aplikasi berjalan **sepenuhnya di sisi klien** untuk data — hosting hanya
  menyajikan halaman dan API geocode.
- Data setiap pengunjung tersimpan di browser masing-masing, **tidak terpusat di server**.
- Cocok untuk demo, presentasi klien, atau uji alur operasional —
  **belum untuk transaksi produksi multi-perangkat**.

---

## Known Limitations

1. **Penyimpanan per-browser** — data tidak tersinkron antar perangkat/tab private;
   hapus storage = data hilang.
2. **"Realtime" terbatas satu browser** — antar tab sudah sinkron, antar perangkat
   butuh backend.
3. **Hash password custom** — bukan bcrypt/argon2. Lihat [Keamanan](#keamanan--hardening).
4. **PIN "ingat login" hanya di-obfuscate** (XOR + base64), bukan enkripsi.
   Fitur ini default nonaktif.
5. **Pembayaran disimulasikan** — QRIS & kartu tidak terhubung payment gateway.
6. **Kuota localStorage** (±5 MB) — banyak foto besar bisa memenuhi storage.
   Kegagalan tulis kini memunculkan peringatan console + meteran di Pengaturan.
7. **Test masih unit-level** — 23 kasus Vitest untuk logika inti.
   Belum ada E2E (Playwright) untuk alur browser.
8. **Rate limit in-memory** — per instance, belum terdistribusi.
9. **Admin tidak bisa mencatat penjualan nyata** — semua transaksi admin adalah mode uji.
10. Batas bawaan: 300 notifikasi, 500 riwayat penukaran, 5 login member tersimpan,
    stok maks 99.999, kursi meja 1–20.

---

## Troubleshooting

### Aplikasi

| Masalah | Solusi |
|---|---|
| Data hilang / kembali ke demo | Storage browser terhapus, ganti browser, atau mode private. Pulihkan dari impor JSON. |
| Tidak bisa jualan di kasir | Kasir wajib punya **shift aktif** — buka shift dulu di `/shift` atau dari halaman kasir. |
| Tombol bayar tidak aktif saat Makan di sini | Belum pilih meja kosong. Pilih meja di denah, atau ganti ke **Bawa pulang**. |
| Semua meja terisi | Kosongkan meja yang tamunya sudah pulang (Member → Meja → Kosongkan), atau pakai Bawa pulang. |
| Meja tidak ikut terisi setelah bayar | Pastikan bukan **mode uji admin**, dan tipe pesanan = Makan di sini. |
| Status meja tidak berubah di perangkat lain | Memang belum antar perangkat — data per-browser. |
| Tab lain tidak ikut update | Pastikan bukan mode private/incognito dan origin sama. Sync antar tab pakai event `storage`. |
| Login staff gagal | Pakai akun demo (`admin/admin123`, `kasir/kasir123`) atau akun yang dibuat admin. |
| Login portal member gagal | Pakai username/nomor member/HP + PIN 6 digit. Member harus aktif & portal aktif. PIN demo: `123456`. |
| Menu Notifikasi hilang | Itu benar untuk kasir — halaman ini butuh izin `notif.view` (admin). |
| Peta tidak muncul / lokasi meleset | Isi `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`; tanpa key, fallback Nominatim/Photon bisa kurang akurat. |
| Foto produk tidak tersimpan | localStorage penuh — kurangi/hapus foto lama. Cek meteran di Pengaturan → Data. |
| Shift tertutup sendiri | Auto-close mengikuti jam akhir jadwal (fallback jam tutup toko 22.00). Perpanjang shift sebelum jamnya. |
| Ingin mulai bersih | Pengaturan → Data → hapus data demo, atau acak ulang untuk data segar. |
| Port 3000 dipakai | `npm run dev -- -p 3001` |

### Build & tooling

| Masalah | Solusi |
|---|---|
| `npm ci` gagal "in sync" | `package.json` berubah tanpa update lockfile. Jalankan `npm install`, commit `package-lock.json`. |
| CI merah tapi lokal hijau | Cek versi toolchain: `npm ls eslint eslint-config-next`. Keduanya dipin persis di `package.json`. |
| `Committing semi space failed` / `NewSpace::EnsureCurrentCapacity` | **Bukan** kurang heap. Jalankan `npm run doctor`, lalu `npm run clean`, bunuh node yatim, aktifkan page file. Lihat [bagian khusus](#build-di-mesin-ram-terbatas). |
| Build mati di "Collecting page data using N workers" | Terlalu banyak worker. `npm run build:safe` atau set `NEXT_BUILD_CPUS=1`. |
| Disk C: habis setelah beberapa build | Cache Turbopack menumpuk. `npm run clean` (atau `-- --all`). |
| Lint error `react-hooks/immutability` | Rule compiler-only, sudah di-off di config. Kalau muncul, berarti config belum terpakai — cek `eslint.config.mjs`. |
| Test gagal resolve `@/...` | `vitest.config.ts` hilang atau alias belum aktif. |
| `vitest` tidak jalan di Node lama | Vitest 5 butuh Node `^22.12 \|\| ^24 \|\| >=26`. Upgrade Node. |

---

## Roadmap

Rencana pengembangan (belum diimplementasikan):

- [ ] Backend sungguhan + database (multi-perangkat, data terpusat)
- [ ] Autentikasi server-side dengan hashing standar (bcrypt/argon2) + sesi aman
- [ ] Integrasi payment gateway QRIS dinamis & EDC sungguhan
- [ ] Sinkronisasi real-time antar perangkat (termasuk status meja)
- [ ] PWA / mode offline-first
- [ ] Dukungan printer thermal & laci kas
- [ ] Laporan pajak & akuntansi yang lebih lengkap
- [ ] Fitur meja lanjutan: pindah meja, timer durasi duduk, denah per lantai
- [ ] E2E test (Playwright) untuk alur kritis: login → shift → jual → refund
- [ ] Rate limit terdistribusi (Upstash Redis / Vercel KV)
- [ ] Pemisahan `app/kasir/page.tsx` (2.400 baris) jadi sub-komponen

Sudah selesai dari roadmap sebelumnya:

- [x] Automated unit test (Vitest) — 23 kasus, 60 assertion
- [x] Sinkronisasi antar tab di browser yang sama
- [x] Quality gate CI: lint + typecheck + test + build

---

## Riwayat Update

### v1.1.3 — quality gate hijau penuh

- **0 error / 0 warning ESLint**, TypeScript strict lolos, build produksi sukses,
  CI dua job hijau.
- **Unit test aktif**: `lib/core.test.ts` (23 kasus) + `vitest.config.ts`.
- **Build tahan mesin RAM terbatas**: worker page-data dibatasi (`experimental.cpus`),
  plus tooling `doctor`, `clean`, `build:smart/safe/webpack`, `verify:safe`, `lint:safe`.
- **Chart dirapikan**: konstanta layout di module scope, offset donut dihitung murni
  (tanpa reassign akumulator saat render), dependency hook bersih.
- **Form denah meja** memakai snapshot `ref` — sinkron antar tab tidak lagi mereset
  form yang sedang diisi admin.
- Tooling migrasi sekali pakai dihapus dari repo.

### v1.1.x — perbaikan logika & hardening

- **Sinkron antar tab**: amplop ber-revisi (`rev` + `writer`), anti-gema,
  sesi login tetap per tab.
- **Batalkan refund** mengisi meja kembali (hanya jika masih kosong & aktif).
- **Hapus semua meja** dihormati — denah tidak dibangkitkan ulang saat reload.
- **Meja yatim** dikosongkan otomatis saat hydrate (`reconcileTables`).
- **Impor backup** melewati `normalize()` + pratinjau + urungkan.
- **Akses `/notifikasi`** khusus admin (`notif.view`); route dicocokkan per segmen
  sehingga `/memberku` tidak terjepit prefiks `/member`.
- **CSV anti formula injection**, **rate limit `/api/geocode`**,
  **PIN CSPRNG**, "ingat login" default nonaktif, UA Nominatim kontak nyata.
- **Pengaturan diperkaya**: meteran penyimpanan, ganti password + indikator kekuatan,
  simulasi struk interaktif, pencarian akun.
- Peringatan saat kuota localStorage penuh (tidak lagi bisu).

### Milestone sebelumnya

1. **Program member disempurnakan** — bonus diskon bisa diatur untuk semua tier
   termasuk Bronze; penjelasan tier menampilkan angka bonus persis sesuai pengaturan.
2. **Landing page dirapikan** — benefit member tampil lebih bersih.
3. **Portal member diperkaya** — tab Produk & Promo (katalog live + estimasi harga
   member) dan tampilan benefit yang lebih modern.
4. **Sistem meja dine-in** — tipe pesanan di kasir, denah visual, meja otomatis
   terisi saat bayar & kosong saat refund, pemantauan live, kelola denah oleh admin,
   info meja di struk.
5. **Quality gate dasar** — lisensi MIT, ESLint 9 flat config, typecheck strict,
   CI otomatis via GitHub Actions.

---

## License

Dirilis di bawah **MIT License** — lihat [LICENSE](LICENSE) untuk teks lengkap.

Bebas dipakai, dimodifikasi, dan didistribusikan (termasuk komersial), dengan
syarat menyertakan pemberitahuan hak cipta dan lisensi.

> Catatan: proyek ini demo lokal. Pembayaran bersifat simulasi dan penyimpanan
> data berbasis `localStorage` — **belum untuk transaksi produksi**.
> Lihat [Known Limitations](#known-limitations) dan [Keamanan & Hardening](#keamanan--hardening).