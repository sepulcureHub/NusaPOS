# NusaPOS

[![CI](https://github.com/sepulcureHub/NusaPOS/actions/workflows/ci.yml/badge.svg)](https://github.com/sepulcureHub/NusaPOS/actions/workflows/ci.yml)
![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Next.js](https://img.shields.io/badge/Next.js-16-black.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue.svg)
![React](https://img.shields.io/badge/React-19-61dafb.svg)

**Sistem Point of Sale (POS) berbasis web untuk UMKM Indonesia** — dibangun dengan Next.js, React, TypeScript, dan Tailwind CSS.

NusaPOS adalah aplikasi kasir modern dengan fitur:

- Kasir cepat untuk admin & kasir, dengan opsi **Makan di sini / Bawa pulang**
- **Sistem meja dine-in**: pilih meja lewat denah visual, meja otomatis terisi saat pembayaran selesai
- **Pemantauan meja live** di halaman Member & Portal Member (customer bisa cek meja kosong sebelum datang)
- Katalog produk, promo harian, dan paket bundling
- Program member berbasis **akumulasi belanja** (tier Bronze–Platinum, bonus bisa diatur per tier)
- Sistem poin yang bisa ditukar hadiah
- Portal member mandiri: benefit, **produk & promo**, **ketersediaan meja**, poin, riwayat, profil
- Shift kasir dengan tutup otomatis + skor performa kasir
- Notifikasi aktivitas sistem
- Halaman pelanggan / landing page
- Integrasi peta Google Maps untuk lokasi toko
- Penyimpanan lokal demo menggunakan `localStorage`

> Proyek ini adalah **demo lokal / prototype operasional**, bukan backend produksi.
> Semua data disimpan di browser perangkat yang sedang digunakan.
> "Realtime" pada aplikasi ini berarti live di perangkat/browser yang sama — belum antar perangkat.

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
- [Struktur Folder](#struktur-folder)
- [Instalasi](#instalasi)
- [Environment Variables](#environment-variables)
- [Scripts](#scripts)
- [Akun Demo](#akun-demo)
- [Halaman Utama](#halaman-utama)
- [Data & Backup](#data--backup)
- [Deployment](#deployment)
- [Known Limitations](#known-limitations)
- [Troubleshooting](#troubleshooting)
- [Roadmap](#roadmap)
- [Riwayat Update](#riwayat-update)
- [License](#license)

---

## Tech Stack

| Teknologi | Keterangan |
|---|---|
| Next.js 16 | Framework React full-stack (App Router) |
| React 19 | UI library |
| TypeScript 5 | Static typing (`strict: true`) |
| Tailwind CSS v4 | Styling utility-first (via `@tailwindcss/postcss`) |
| ESLint 9 + flat config | Linting via CLI (Next.js 16 menghapus `next lint`) |
| GitHub Actions | CI otomatis: lint, build, typecheck |
| localStorage | Penyimpanan demo lokal |
| Google Maps Embed | Peta lokasi toko |
| Nominatim / Photon | Fallback geocoding publik |

Catatan:

- Runtime minimal **Node.js >= 20.9.0** (lihat `engines` di `package.json`).
- Dependencies sengaja minimalis: hanya `next`, `react`, `react-dom`.
- State management, komponen UI, ikon, chart, dan **denah meja** dibangun sendiri tanpa library pihak ketiga (`lib/store.tsx`, `components/ui.tsx`, `components/charts.tsx`, `components/TableGrid.tsx`).

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

Refund membalik semuanya: stok kembali, poin/akumulasi member dikurangi, dan **meja dikosongkan otomatis**.

### 2. Katalog Produk

Halaman `/produk` dikelola oleh admin.

Fitur produk:

- nama, SKU (auto-generate: `KOP`, `NKP`, `MKN`, `CML`, `RTL`, `PKT`)
- kategori: Kopi / Non-Kopi / Makanan / Cemilan / Ritel
- harga jual, HPP, stok, deskripsi
- emoji / foto (foto disimpan sebagai data URL)
- status aktif, diskon dasar (persen / nominal Rp)
- promo harian & hari ketersediaan
- produk satuan & paket bundling

Fitur katalog tambahan:

- drag & drop / pindah urutan produk
- aksi massal (aktif/nonaktif, diskon dasar, hapus + pulihkan)
- penyesuaian stok manual
- **saved views** — preset filter ("Stok menipis", "Promo hari ini", dll.)
- margin & HPP paket dihitung otomatis dari komponennya

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

Ketersediaan per hari juga didukung — contoh: Nasi Ayam Bali hanya Sabtu–Minggu, Brownies Lava hanya Jumat–Minggu.

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

Tab yang tersedia:

| Tab | Isi |
|---|---|
| Ringkasan | Kartu member, progres tier, benefit aktif, shortcut produk & meja |
| **Produk & Promo** | Katalog live dari admin: pencarian, filter kategori/promo/hari ini, **estimasi harga member** |
| **Meja** | Denah meja live — cek meja kosong sebelum datang |
| Poin & Hadiah | Katalog hadiah, tukar poin, riwayat penukaran |
| Transaksi | Riwayat belanja + badge meja untuk transaksi dine-in |
| Profil | Edit profil, ganti PIN, kalender bonus ulang tahun |

Fitur "ingat login": maksimal **5 akun member** terakhir disimpan di perangkat (key `nusapos:member-logins:v2`). PIN hanya di-obfuscate (XOR + base64), **bukan dienkripsi**.

### 8. Shift Kasir

Halaman `/shift`:

- jadwal shift mingguan per kasir (dikelola admin)
- buka shift dengan modal kas awal, tutup dengan hitung kas akhir
- rekonsiliasi: `kas diharapkan = kas awal + penjualan tunai − refund tunai`
- perpanjang shift aktif & **tutup otomatis** mengikuti jam jadwal (fallback jam tutup toko, support lintas tengah malam)
- pengecekan auto-close tiap 15 detik + saat tab kembali visible
- admin bisa buka/tutup paksa shift kasir

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
- Chart digambar sendiri (`components/charts.tsx`), tanpa library eksternal

### 10. Pengaturan

Halaman `/pengaturan` (bertingkat sesuai role):

- tema dark / light / system + 5 aksen warna (tosca, ungu, nila, lembayung, lavender)
- suara notifikasi
- branding: nama, tagline, logo (bentuk/ukuran/plat), wordmark
- identitas toko: nama, alamat, telepon, footer struk
- pajak (default 11% PPN) & service charge, ambang stok menipis
- kelola pengguna & akses (admin)
- backup / impor JSON, acak ulang & hapus data demo (admin)

> Pengaturan program member (poin, diskon, tier, bonus) dikelola di **Member → Benefit Member**, bukan di Pengaturan.

---

## Role Pengguna

| Role | Akses |
|---|---|
| **admin** | Seluruh sistem: dashboard, kasir, produk, semua transaksi, refund, ekspor CSV, semua member, hapus member, sesuaikan poin, analitik, semua shift, pengaturan toko & pengguna, **kelola denah meja**, atur benefit member |
| **kasir** | Ruang kerja operasional: kasir (`pos`), lihat transaksi sendiri, cari & daftarkan/edit member, shift sendiri, pengaturan pribadi, **kosongkan meja**, benefit member baca-saja |

Detail teknis (`lib/auth.ts`):

- Permission granular via `ROLE_PERMS` + route guard `routeAllowed`.
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
2. Sistem membuatkan **nomor member** `NUSA-XXXX` dan **PIN 6 digit acak**.
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

```txt
diskon member = diskon dasar + bonus tier + bonus ulang tahun
```

- Diskon dasar default **5%** (pengaturan 0–25%)
- Bonus per tier **semuanya bisa diatur admin (0–25%)**, termasuk **Bronze**
- Bonus ulang tahun default **+10%** di hari-H (pengaturan 0–25%)
- Total diskon member di-cap **40%**
- Berlaku hanya jika program member aktif dan member aktif

Tampilan penjelasan tier:

- Angka besar di kartu tier = **bonus yang diatur admin, persis** (atur 2% → tampil 2%, bukan dijumlah dengan dasar).
- Kartu benefit tier menampilkan mini-grid bonus per tier (Bronze/Silver/Gold/Platinum) tanpa terpotong.
- Rumus kasir tetap `dasar + bonus tier + ultah` — angka total riil hanya muncul di konteks simulasi/preview transaksi, bukan di penjelasan tier.

Aturan lain:

- Akumulasi & poin hanya dari transaksi berstatus **Selesai**; transaksi mode uji tidak memengaruhi statistik.
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
- **Manual** oleh staf: **Member → Meja → daftar meja terisi → Kosongkan** (saat tamu pulang).

### Kelola denah (admin)

Di **Member → Meja → Kelola denah meja**:

- tambah meja (label, area, jumlah kursi)
- edit meja (label/area/kursi tidak mengosongkan meja yang sedang terisi)
- hapus meja (bisa diurungkan lewat notifikasi)
- aktif / nonaktifkan meja

### Pemantauan live

- **Kasir**: chip "Meja X/Y" + modal overview denah.
- **Halaman Member → Meja**: statistik, denah live, daftar terisi + kosongkan, kelola denah (admin).
- **Portal Member → Meja**: customer melihat meja kosong/terisi **sebelum datang**.

> ⚠️ Batas "realtime": status meja update live **di browser/perangkat yang sama** (state React + localStorage). Antar perangkat berbeda belum tersinkron — membutuhkan backend (lihat Roadmap).

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

- Transaksi mode uji ditandai `isTest` dan **tidak pernah dicatat** ke riwayat
- Stok tidak dipotong, poin/akumulasi member tidak berubah, notifikasi penjualan tidak dibuat
- **Meja tidak ikut terisi** saat mode uji
- Banner `KasirTestBanner` menandakan mode uji aktif
- Saat hydrate, transaksi `isTest` lama dibuang dari data

Berguna untuk demo ke klien atau latihan kasir baru.

---

## Notifikasi Sistem

Halaman `/notifikasi` mencatat seluruh aktivitas penting:

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
| `system` | kejadian lain, termasuk **aktivitas meja** (tambah/edit/hapus/kosongkan) |

- Setiap notifikasi menyimpan waktu, judul, detail, dan **aktor**.
- Disimpan maksimal **300 entri** terbaru; status dibaca/tidak dibaca per timestamp.

---

## Sinkronisasi Data

Semua halaman membaca **satu sumber data yang sama** (`StoreProvider` di `lib/store.tsx`):

- Perubahan katalog oleh admin (harga, promo, stok, status) langsung tercermin di kasir, landing page, portal member, dan analitik.
- Penjualan memotong stok via reducer terpusat; refund mengembalikannya.
- Stok paket selalu **dihitung turunan** dari stok komponennya.
- **Status meja** berubah terpusat: terisi saat bayar dine-in, kosong saat refund / dikosongkan staf — semua tampilan meja (kasir, member, portal) ikut update seketika.
- Saat dimuat, data dinormalisasi: SKU duplikat diperbaiki, hari ketersediaan divalidasi, diskon/promo dibersihkan, foto harus `data:image/`, meja lama dilengkapi default.
- Stok dibatasi 0–99.999.

> Karena berbasis localStorage, sinkronisasi ini berlaku **dalam satu browser/perangkat yang sama** — bukan antar perangkat.

---

## Quality Gate

Proyek ini dilengkapi pipeline kualitas otomatis untuk menjaga standar kode:

| Script | Fungsi | Diblokir CI |
|---|---|---|
| `npm run lint` | ESLint 9 flat config (`eslint-config-next`) | Ya, error memblokir |
| `npm run typecheck` | TypeScript strict mode (`tsc --noEmit`) | Ya, error memblokir |
| `npm run build` | Build produksi Next.js 16 | Ya |
| `npm run check` | Gabungan lint + typecheck | Ya |

**CI otomatis** via GitHub Actions (lihat `.github/workflows/ci.yml`) jalan di setiap push ke `main` dan PR. Step lint terpisah dari build karena **Next.js 16 menghapus `next lint`** dan `next build` tidak lagi menjalankan ESLint.

**Strategi lint**:

- **Error** = memblokir CI (bug nyata: hooks salah, JSX invalid)
- **Warning** = terlihat di log, tidak memblokir (daftar kerjaan)

Beberapa override yang disengaja (dengan alasan):

| Rule | Alasan |
|---|---|
| `@next/next/no-img-element: off` | Foto produk/logo disimpan sebagai data URL base64 — `next/image` tidak mengoptimalkan data URL |
| `react/no-unescaped-entities: off` | Banyak teks UI Bahasa Indonesia memakai tanda kutip langsung |
| `@next/next/no-html-link-for-pages: warn` | Sebagian navigasi internal masih pakai `<a>` (mis. header portal member) |

---

## Struktur Folder

```txt
NusaPOS/
├── app/                        # App Router (halaman & API)
│   ├── analitik/               # /analitik — analitik penjualan (admin)
│   ├── api/geocode/            # API server: geocoding lokasi toko
│   ├── beranda/                # /beranda — landing page publik
│   ├── kasir/                  # /kasir — POS + tipe pesanan + pilih meja
│   ├── login/                  # /login — login staff
│   ├── member/                 # /member — benefit, member, produk, MEJA, hadiah, penukaran
│   ├── memberku/               # /memberku — portal: ringkasan, produk & promo, MEJA, poin, transaksi, profil
│   ├── notifikasi/             # /notifikasi — log aktivitas
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
│   ├── ProductAnalytics.tsx    # insight per produk
│   ├── ProductForm.tsx         # form produk & paket
│   ├── ProductThumb.tsx        # thumbnail emoji/foto
│   ├── QRISCenter.tsx          # tampilan pembayaran QRIS
│   ├── Receipt.tsx             # struk (tipe pesanan + meja)
│   ├── SearchField.tsx         # input pencarian
│   ├── Shell.tsx               # kerangka navigasi aplikasi
│   ├── StoreMap.tsx            # peta Google Maps toko
│   ├── TableGrid.tsx           # ★ denah meja visual (pilih / pantau)
│   ├── Toasts.tsx              # notifikasi toast
│   ├── charts.tsx              # chart custom (tanpa library)
│   ├── icons-extra.tsx         # ikon tambahan
│   ├── icons.tsx               # ikon utama
│   └── ui.tsx                  # primitif UI (button, card, dll)
├── lib/                        # logika bisnis & state
│   ├── analytics.ts            # agregasi analitik penjualan
│   ├── auth.ts                 # hash password, role & permission
│   ├── brand.ts                # aksen warna & branding
│   ├── demo-data.ts            # pusat data demo (produk, akun, settings, MEJA)
│   ├── format.ts               # format rupiah, tanggal, util angka
│   ├── geo-attribution.ts      # atribusi penyedia geocoding
│   ├── geo.ts                  # util geo klien
│   ├── geocode-server.ts       # geocoding sisi server + fallback
│   ├── media.ts                # penanganan foto/logo (data URL)
│   ├── member-login.ts         # simpan login member (maks 5)
│   ├── member.ts               # tier, poin, diskon, validasi member
│   ├── pricing.ts              # diskon, promo harian, bundling, stok
│   ├── product-analytics.ts    # analitik per produk
│   ├── seed.ts                 # generator data demo 90 hari + meja
│   ├── shift.ts                # sesi shift, auto-close, skor kasir
│   ├── sound.ts                # efek suara
│   ├── store.tsx               # StoreProvider + reducer + persist + aksi meja
│   ├── tables.ts               # ★ helper meja (statistik, area, label, factory)
│   └── types.ts                # seluruh tipe data (termasuk DiningTable & OrderType)
├── .github/
│   └── workflows/
│       └── ci.yml              # GitHub Actions: lint + build + typecheck
├── .env.example
├── .gitignore
├── eslint.config.mjs           # ESLint 9 flat config (Next.js 16)
├── LICENSE                     # MIT License
├── next.config.ts
├── package.json
├── postcss.config.mjs
├── tsconfig.json               # strict: true, noEmit: true
└── README.md
```

---

## Instalasi

Prasyarat: **Node.js >= 20.9.0** dan npm.

```bash
# 1. clone repo
git clone https://github.com/sepulcureHub/NusaPOS.git
cd NusaPOS

# 2. pasang dependencies
npm install

# 3. (opsional) siapkan environment
cp .env.example .env.local
# isi API key Google Maps jika punya — tanpa ini aplikasi tetap jalan

# 4. (opsional) verifikasi kualitas
npm run check    # lint + typecheck

# 5. jalankan development server
npm run dev
```

Buka `http://localhost:3000`, lalu login dengan [akun demo](#akun-demo).

Saat pertama kali dibuka (belum ada data tersimpan), aplikasi otomatis membuat **data demo 90 hari** memakai seed tetap (`20261116`) agar hasil konsisten — termasuk 13 meja demo.

---

## Environment Variables

Salin `.env.example` menjadi `.env.local`:

```env
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

Tanpa kedua key: peta memakai embed publik dan geocoding fallback ke **Nominatim/Photon** + basis lokasi offline. Aplikasi tetap berfungsi penuh.

---

## Scripts

| Script | Perintah | Fungsi |
|---|---|---|
| `dev` | `npm run dev` | Development server |
| `build` | `npm run build` | Build produksi |
| `start` | `npm run start` | Jalankan hasil build |
| `lint` | `npm run lint` | ESLint (Next.js 16: CLI langsung) |
| `lint:fix` | `npm run lint:fix` | ESLint dengan auto-fix |
| `typecheck` | `npm run typecheck` | TypeScript strict check (`tsc --noEmit`) |
| `check` | `npm run check` | Gabungan lint + typecheck |

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

> Akun demo hanya untuk pengujian lokal. Ganti password sebelum dipakai demo publik.

---

## Halaman Utama

| Route | Halaman | Akses |
|---|---|---|
| `/` | Dashboard bisnis | admin |
| `/kasir` | POS / kasir + tipe pesanan + meja | admin & kasir |
| `/produk` | Katalog produk & paket | admin |
| `/transaksi` | Riwayat transaksi, refund, ekspor CSV | admin & kasir (kasir: miliknya) |
| `/member` | Benefit, member, produk, **meja**, hadiah, penukaran | admin & kasir |
| `/memberku` | Portal: ringkasan, **produk & promo**, **meja**, poin, transaksi, profil | publik (login member) |
| `/shift` | Jadwal & sesi shift | admin & kasir |
| `/analitik` | Analitik penjualan | admin |
| `/notifikasi` | Log aktivitas sistem | admin |
| `/pengaturan` | Pengaturan aplikasi & toko | bertingkat |
| `/beranda` | Landing page pelanggan | publik |
| `/login` | Login staff | publik |

Tab halaman **Member**: Benefit Member · Member · Produk Tersedia · **Meja** · Katalog Hadiah · Penukaran.
Tab **Portal Member**: Ringkasan · **Produk & Promo** · **Meja** · Poin & Hadiah · Transaksi · Profil.

---

## Data & Backup

### Penyimpanan

- Seluruh state aplikasi disimpan di localStorage key **`nusapos:v1`** (format `{ v: 1, state }`).
- Penulisan di-debounce ±250ms setiap perubahan state.
- Login member tersimpan terpisah di **`nusapos:member-logins:v2`** (maks 5 akun, PIN di-obfuscate).
- Foto produk & logo disimpan inline sebagai data URL.

### Data demo awal

Dibuat otomatis saat pertama kali dibuka (`lib/seed.ts`, seed `20261116`):

- 27 produk (24 satuan + 3 paket bundling)
- 9 pelanggan (4 member + 4 non-member + pelanggan umum)
- 3 akun staff, 13 template jadwal shift mingguan
- 6 katalog hadiah, 5 saved views
- **13 meja demo (42 kursi)** — Indoor, Outdoor, Bar; semua mulai kosong
- ±90 hari transaksi simulasi: 9–19 order/hari (+5 weekend), jam ramai siang & sore, mix bayar 42% QRIS / 36% Tunai / 22% Kartu, ~2% refund, kas awal shift Rp150.000
- Toko demo: jam operasional 07.00–22.00, pajak 11%, service 0%

### Kelola data (admin, Pengaturan → Data)

- **Ekspor / impor JSON** seluruh data aplikasi
- **Acak ulang** data demo (regenerate seed; akun & sesi tetap; meja dibuat ulang)
- **Hapus data demo** (kosongkan produk/transaksi/member; akun, pengaturan, **dan denah meja tetap**)
- Ekspor **CSV transaksi** dari `/transaksi` dan **CSV member** dari halaman Member

> Pindah browser/perangkat = mulai dari data demo baru. Gunakan ekspor/impor JSON untuk memindahkan data.

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

- Aplikasi berjalan **sepenuhnya di sisi klien** untuk data — hosting hanya menyajikan halaman dan API geocode.
- Data setiap pengunjung tersimpan di browser masing-masing, **tidak terpusat di server**.
- Cocok untuk demo, presentasi klien, atau uji alur operasional — belum untuk transaksi produksi multi-perangkat.

---

## Known Limitations

1. **Penyimpanan per-browser** — data tidak tersinkron antar perangkat/tab private; hapus storage = data hilang.
2. **"Realtime" meja terbatas satu perangkat** — status meja live di browser yang sama; antar perangkat butuh backend.
3. **Hash password custom** (`lib/auth.ts`, FNV-like + salt) — cukup untuk demo lokal, **bukan** hashing kriptografis (bcrypt/argon2).
4. **PIN member tersimpan hanya di-obfuscate** (XOR + base64) di fitur "ingat login" — bukan enkripsi.
5. **Pembayaran disimulasikan** — QRIS & kartu (EDC demo) tidak terhubung payment gateway sungguhan.
6. **Kuota localStorage** (±5MB) — banyak foto beresolusi besar bisa memenuhi storage; penulisan gagal diabaikan diam-diam.
7. **Belum ada** automated tests dan integrasi payment sungguhan. Lint, type-check, dan CI sudah aktif (lihat badge CI di atas).
8. Batas bawaan: 300 notifikasi, 500 riwayat penukaran, 5 login member tersimpan, stok maks 99.999, kursi meja 1–20.

---

## Troubleshooting

| Masalah | Solusi |
|---|---|
| Data hilang / kembali ke demo | Storage browser terhapus, ganti browser, atau mode private. Pulihkan dari impor JSON. |
| Tidak bisa jualan di kasir | Kasir wajib punya **shift aktif** — buka shift dulu di `/shift` atau dari halaman kasir. |
| Tombol bayar tidak aktif saat Makan di sini | Belum pilih meja kosong. Pilih meja di denah, atau ganti ke **Bawa pulang**. |
| Semua meja terisi | Kosongkan meja yang tamunya sudah pulang (Member → Meja → Kosongkan), atau pakai Bawa pulang. |
| Meja tidak ikut terisi setelah bayar | Pastikan bukan **mode uji admin** (transaksi uji tidak mengisi meja), dan tipe pesanan = Makan di sini. |
| Status meja tidak berubah di perangkat lain | Memang belum antar perangkat — data per-browser. Lihat Known Limitations & Roadmap. |
| Login staff gagal | Pakai akun demo (`admin/admin123`, `kasir/kasir123`) atau akun yang dibuat admin. |
| Login portal member gagal | Pakai username/nomor member/HP + PIN 6 digit. Member harus aktif & portal aktif. PIN demo: `123456`. |
| Peta tidak muncul / lokasi meleset | Isi `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`; tanpa key, fallback Nominatim/Photon bisa kurang akurat. |
| Foto produk tidak tersimpan | localStorage penuh — kurangi/hapus foto lama, atau kecilkan ukuran gambar. |
| Shift tertutup sendiri | Auto-close mengikuti jam akhir jadwal (fallback jam tutup toko 22.00). Perpanjang shift sebelum jamnya tiba. |
| Ingin mulai bersih | Pengaturan → Data → hapus data demo, atau acak ulang untuk data segar. |
| Port 3000 dipakai | `npm run dev -- -p 3001` |
| CI merah / lint error | Jalankan `npm run check` lokal. Output-nya tunjukkan issue tracker untuk dibantu debug. |

---

## Roadmap

Rencana pengembangan (belum diimplementasikan):

- [ ] Backend sungguhan + database (multi-perangkat, data terpusat)
- [ ] Autentikasi server-side dengan hashing standar (bcrypt/argon2) + sesi aman
- [ ] Integrasi payment gateway QRIS dinamis & EDC sungguhan
- [ ] Sinkronisasi real-time antar kasir & antar perangkat (termasuk status meja)
- [ ] PWA / mode offline-first
- [ ] Dukungan printer thermal & laci kas
- [ ] Laporan pajak & akuntansi yang lebih lengkap
- [ ] Fitur meja lanjutan: pindah meja, timer durasi duduk, denah per lantai
- [ ] Automated tests (Vitest + Playwright) untuk alur kritis

---

## Riwayat Update

Ringkasan milestone pengembangan terbaru:

1. **Program member disempurnakan** — bonus diskon bisa diatur untuk semua tier termasuk **Bronze**; penjelasan tier menampilkan angka bonus **persis sesuai pengaturan admin** (tidak lagi dijumlah dengan diskon dasar).
2. **Landing page dirapikan** — section "Simulasi kenaikan tier" dihapus; benefit member tampil lebih bersih.
3. **Portal member diperkaya** — tab **Produk & Promo** (katalog live + estimasi harga member) dan tampilan benefit yang lebih modern (kartu tier premium, mini-grid bonus per tier, tanpa duplikasi).
4. **Sistem meja dine-in** — tipe pesanan Makan di sini / Bawa pulang di kasir, denah meja visual, meja otomatis terisi saat bayar & kosong saat refund, pemantauan live di halaman Member & Portal Member, kelola denah oleh admin, dan info meja di struk.
5. **Quality gate** — ditambah lisensi MIT, ESLint 9 flat config, typecheck strict, dan CI otomatis via GitHub Actions.

---

## License

Dirilis di bawah **MIT License** — lihat file [`LICENSE`](LICENSE) untuk teks lengkap.

Bebas dipakai, dimodifikasi, dan didistribusikan (termasuk komersial), dengan syarat menyertakan pemberitahuan hak cipta dan lisensi.

> Catatan: proyek ini demo lokal. Pembayaran bersifat simulasi dan penyimpanan data berbasis `localStorage` — **belum untuk transaksi produksi**. Lihat [Known Limitations](#known-limitations).