# NusaPOS

**Sistem Point of Sale (POS) berbasis web untuk UMKM Indonesia** — dibangun dengan Next.js, React, TypeScript, dan Tailwind CSS.

NusaPOS dirancang sebagai aplikasi kasir modern dengan fitur:

- Kasir cepat untuk admin & kasir
- Katalog produk, promo harian, dan paket bundling
- Program member berbasis **akumulasi belanja**
- Sistem poin yang bisa ditukar hadiah
- Portal member mandiri
- Shift kasir dengan tutup otomatis
- Notifikasi aktivitas sistem
- Halaman pelanggan / landing page
- Integrasi peta Google Maps untuk lokasi toko
- Penyimpanan lokal demo menggunakan `localStorage`

> Proyek ini adalah **demo lokal / prototype operasional**, bukan backend produksi.  
> Semua data disimpan di browser perangkat yang sedang digunakan.

---

## Daftar Isi

- [Tech Stack](#tech-stack)
- [Fitur Utama](#fitur-utama)
- [Role Pengguna](#role-pengguna)
- [Alur Login](#alur-login)
- [Sistem Member](#sistem-member)
- [Sistem Poin & Hadiah](#sistem-poin--hadiah)
- [Mode Uji Admin di Kasir](#mode-uji-admin-di-kasir)
- [Notifikasi Sistem](#notifikasi-sistem)
- [Sinkronisasi Data Produk](#sinkronisasi-data-produk)
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
- [License](#license)

---

## Tech Stack

| Teknologi | Keterangan |
|---|---|
| Next.js 16 | Framework React full-stack (App Router) |
| React 19 | UI library |
| TypeScript 5 | Static typing |
| Tailwind CSS v4 | Styling utility-first (via `@tailwindcss/postcss`) |
| localStorage | Penyimpanan demo lokal |
| Google Maps Embed | Peta lokasi toko |
| Nominatim / Photon | Fallback geocoding publik |

Catatan:

- Runtime minimal **Node.js >= 20.9.0** (lihat `engines` di `package.json`).
- Dependencies sengaja minimalis: hanya `next`, `react`, `react-dom`.
- State management, komponen UI, ikon, dan chart **dibangun sendiri** tanpa library pihak ketiga (`lib/store.tsx`, `components/ui.tsx`, `components/charts.tsx`).

---

## Fitur Utama

### 1. Kasir Cepat

Halaman `/kasir` digunakan untuk:

- memilih produk
- menambah item ke cart
- memilih pelanggan/member
- menerapkan diskon member otomatis
- membayar Tunai / QRIS / Kartu
- mencetak struk
- menahan order (hold order)
- membuka/menutup shift kasir

Kasir hanya bisa bekerja jika sedang memiliki **shift aktif**.

Setiap penjualan otomatis:

- memotong stok produk (termasuk stok komponen paket bundling)
- menambah poin, kunjungan, dan akumulasi belanja member
- mencatat notifikasi aktivitas
- mengaitkan transaksi ke shift yang sedang berjalan

Refund membalik semuanya: stok dikembalikan, poin/kunjungan/akumulasi belanja member dikurangi kembali.

### 2. Katalog Produk

Halaman `/produk` dikelola oleh admin.

Fitur produk:

- nama produk
- SKU (auto-generate per kategori: `KOP`, `NKP`, `MKN`, `CML`, `RTL`, `PKT`)
- kategori
- harga jual
- HPP (harga pokok penjualan)
- stok
- deskripsi
- emoji / foto (foto disimpan sebagai data URL di localStorage)
- status aktif
- diskon dasar (persen atau nominal Rp)
- promo harian
- hari ketersediaan
- produk satuan
- produk bundling / paket

Kategori:

- Kopi
- Non-Kopi
- Makanan
- Cemilan
- Ritel

Fitur katalog tambahan:

- drag & drop / pindah urutan produk
- aksi massal (aktif/nonaktif, diskon dasar, hapus + pulihkan)
- penyesuaian stok manual
- **saved views** — preset filter (contoh: "Stok menipis", "Promo hari ini", "Paket bundling")
- margin & HPP paket dihitung otomatis dari komponennya

### 3. Promo Harian

Promo bisa dijadwalkan berdasarkan hari:

- Senin
- Selasa
- Rabu
- Kamis
- Jumat
- Sabtu
- Minggu

Promo harian **menimpa diskon dasar** jika keduanya aktif pada hari yang sama.

Contoh:

- Diskon dasar: 10%
- Promo Kamis: 20%

Maka pada hari Kamis harga menggunakan promo 20%.

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

Produk bisa berbentuk paket, misalnya:

- Paket Ngopi Berdua (2 Kopi Susu Gula Aren + 2 Croissant Butter)
- Paket Sarapan Nusantara (1 Nasi Goreng Kampung + 1 Es Teh Melati)
- Paket Kerja Fokus (1 Americano Dingin + 1 Brownies Lava, Jumat–Minggu)

Sistem menghitung:

- harga normal dari isi paket (memakai harga efektif komponen hari itu)
- harga paket
- penghematan
- stok porsi — `min(stok komponen ÷ qty kebutuhan)`
- ketersediaan hari
- HPP & margin paket dari total HPP komponen

Saat paket terjual, stok **komponen**-nya yang dipotong, bukan stok paket.

### 5. Halaman Pelanggan

Route:

```txt
/beranda
```

Landing page publik untuk pelanggan, berisi:

- hero & cerita brand (kedai demo: **Nusa Coffee & Eatery**, Jl. Malioboro No. 88, Yogyakarta)
- janji layanan (roasting mingguan, jam dapur, promo harian, program member)
- katalog menu & promo yang sedang aktif
- benefit program member (dibaca langsung dari pengaturan admin)
- testimoni pelanggan
- FAQ (cara daftar member, naik tier, pakai poin, metode bayar)
- peta lokasi toko (`StoreMap`) dengan Google Maps Embed
- ajakan daftar member / login portal

### 6. Portal Member Mandiri

Route:

```txt
/memberku
```

Pelanggan login memakai **username + PIN 6 digit** (dibuatkan kasir saat pendaftaran), lalu bisa:

- melihat tier, progres ke tier berikutnya, dan sisa belanja yang dibutuhkan
- melihat saldo poin
- menukar poin dengan hadiah di katalog
- melihat riwayat transaksi & penukaran pribadi
- melihat benefit yang sedang aktif

Login juga menerima **nomor member** (`NUSA-XXXX`) atau **nomor HP** sebagai identitas alternatif.

Fitur "ingat login": maksimal **5 akun member** terakhir disimpan di perangkat (key `nusapos:member-logins:v2`). PIN hanya di-obfuscate (XOR + base64), **bukan dienkripsi** — lihat [Known Limitations](#known-limitations).

### 7. Shift Kasir

Halaman `/shift`:

- jadwal shift mingguan per kasir (dikelola admin)
- buka shift dengan modal kas awal
- tutup shift dengan hitung kas akhir
- rekonsiliasi: `kas diharapkan = kas awal + penjualan tunai − refund tunai`
- perpanjang shift aktif
- **tutup otomatis** mengikuti jam akhir jadwal (fallback jam tutup toko, mendukung shift lintas tengah malam)
- pengecekan auto-close berjalan tiap 15 detik dan saat tab kembali visible
- admin bisa buka/tutup paksa shift kasir

Laporan performa kasir dihitung dengan skor berbobot:

| Komponen | Bobot | Target |
|---|---|---|
| Kecepatan layanan | 20% | 8 transaksi/jam |
| Nilai keranjang | 20% | rata-rata Rp45.000 |
| Ketepatan shift | 15% | buka tepat waktu |
| Akurasi kas | 20% | selisih kas kecil |
| Kualitas transaksi | 15% | refund < 5% |
| Akuisisi member | 10% | member baru & transaksi member |

### 8. Dashboard & Analitik

- `/` — dashboard bisnis (admin): ringkasan penjualan, metode bayar, produk terlaris
- `/analitik` — analitik mendalam: tren harian, jam ramai, kategori, margin, performa produk
- `/transaksi` — riwayat transaksi, filter, refund, cetak ulang struk, **ekspor CSV** (admin)
- Chart digambar sendiri (`components/charts.tsx`), tanpa library chart eksternal

### 9. Pengaturan

Halaman `/pengaturan` (bertingkat sesuai role):

- tema dark / light / system + 5 aksen warna (tosca, ungu, nila, lembayung, lavender)
- suara notifikasi
- branding: nama, tagline, logo (bentuk/ukuran/plat), wordmark
- identitas toko: nama, alamat, telepon, footer struk
- pajak (default 11% PPN) & service charge
- ambang stok menipis (default 10)
- program member: aktif/nonaktif, rate poin, diskon, bonus tier, ambang tier, poin sambutan
- kelola pengguna & akses (admin)
- backup, acak ulang, dan hapus data demo (admin)

---

## Role Pengguna

| Role | Akses |
|---|---|
| **admin** | Seluruh sistem: dashboard, kasir, produk, semua transaksi, refund, ekspor CSV, semua member, hapus member, sesuaikan poin, analitik, semua shift, pengaturan toko & pengguna, kelola data demo |
| **kasir** | Ruang kerja operasional: kasir (`pos`), lihat transaksi sendiri, cari & daftarkan/edit member, shift sendiri, pengaturan pribadi (tema, suara, password) |

Detail teknis (`lib/auth.ts`):

- Permission granular via `ROLE_PERMS` +守卫 route `routeAllowed`.
- Setelah login: admin diarahkan ke `/`, kasir ke `/kasir`.
- Akun admin/root **dilindungi**: tidak bisa dihapus, dinonaktifkan, atau diubah role/username-nya.
- Akun baru yang dibuat admin **selalu ber-role kasir**.
- Menonaktifkan/menghapus kasir otomatis menutup shift-nya yang masih terbuka.
- Shift hanya berlaku untuk role kasir.

---

## Alur Login

### Staff (admin / kasir)

1. Buka `/login`.
2. Masukkan username + password.
3. Password diverifikasi terhadap hash (`lib/auth.ts`).
4. Sesi disimpan di state aplikasi (persist di localStorage).
5. Redirect sesuai role: admin → `/`, kasir → `/kasir`.
6. Setiap route dicek terhadap permission role — akses di luar hak ditolak.

### Member (portal)

1. Kasir mendaftarkan member (nama, HP, username, tanggal lahir, dll).
2. Sistem membuatkan **nomor member** `NUSA-XXXX` dan **PIN 6 digit acak**.
3. Member buka `/memberku`, login dengan **username / nomor member / nomor HP + PIN**.
4. Syarat login: member aktif, portal aktif, dan punya PIN.
5. Sesi member terpisah dari sesi staff.

Validasi pendaftaran member:

- nama minimal 3 karakter
- nomor HP 8–16 digit, dinormalisasi (`+62` → `0`), tidak boleh duplikat
- username 3–20 karakter (`a-z`, `0-9`, `.`, `-`, `_`), unik antar member
- email opsional, divalidasi formatnya
- tanggal lahir tidak boleh di masa depan

---

## Sistem Member

Tier naik otomatis dari **TOTAL AKUMULASI BELANJA (Rp)** — **bukan dari poin**.

| Tier | Ambang default | Bonus diskon |
|---|---|---|
| Bronze | Rp0 | +0% |
| Silver | Rp1.500.000 | +1% |
| Gold | Rp5.000.000 | +3% |
| Platinum | Rp15.000.000 | +5% |

Komposisi diskon member saat transaksi:

```txt
diskon member = diskon dasar + bonus tier + bonus ulang tahun
```

- Diskon dasar default: **5%** (pengaturan 0–25%)
- Bonus ulang tahun: **+10%** di hari-H (pengaturan 0–25%)
- Total diskon member di-cap **40%**
- Diskon hanya berlaku jika program member aktif dan member aktif
- Semua ambang & bonus bisa diubah admin di Pengaturan

Aturan lain:

- Akumulasi belanja & poin hanya dihitung dari transaksi berstatus **Selesai**
- Transaksi **mode uji** tidak pernah memengaruhi statistik member
- Refund mengurangi kembali akumulasi belanja, poin, dan kunjungan
- Progres tier & sisa menuju tier berikutnya ditampilkan di portal member
- Migrasi otomatis: data lama dengan ambang tier berbasis poin dikonversi ke ambang berbasis belanja saat hydrate

---

## Sistem Poin & Hadiah

### Perolehan poin

- **1 poin per Rp1.000** belanja (rate bisa diatur, minimum Rp100)
- **+50 poin sambutan** saat pertama mendaftar (bisa diatur)
- Poin masuk otomatis saat transaksi selesai
- Admin bisa menyesuaikan poin manual (dengan catatan)

### Penukaran poin

- Katalog hadiah dikelola admin (nama, emoji, deskripsi, harga poin, status aktif)
- Penukaran bisa dari **portal member** atau **kasir** — keduanya tercatat di riwayat
- Poin dipotong otomatis; riwayat penukaran menyimpan hadiah, biaya, waktu, pelaku, dan channel
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

## Mode Uji Admin di Kasir

Admin bisa mencoba alur kasir **tanpa mencemari data**:

- Transaksi mode uji ditandai `isTest` dan **tidak pernah dicatat** ke riwayat
- Stok tidak dipotong, poin/akumulasi member tidak berubah, notifikasi penjualan tidak dibuat
- Banner `KasirTestBanner` menandakan mode uji sedang aktif
- Saat hydrate, transaksi `isTest` lama (jika ada) dibuang dari data

Berguna untuk demo ke klien atau latihan kasir baru.

---

## Notifikasi Sistem

Halaman `/notifikasi` mencatat seluruh aktivitas penting:

| Kind | Contoh kejadian |
|---|---|
| `auth` | login / logout staff |
| `sale` | penjualan baru, order ditahan |
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
| `system` | kejadian lain |

- Setiap notifikasi menyimpan waktu, judul, detail, dan **aktor** (siapa yang melakukan)
- Disimpan maksimal **300 entri** terbaru
- Status dibaca/tidak dibaca per timestamp

---

## Sinkronisasi Data Produk

Semua halaman membaca **satu sumber data yang sama** (`StoreProvider` di `lib/store.tsx`):

- Perubahan katalog oleh admin (harga, promo, stok, status aktif) langsung tercermin di kasir, landing page, dan analitik pada perangkat yang sama
- Penjualan memotong stok via reducer terpusat; refund mengembalikannya
- Stok paket selalu **dihitung turunan** dari stok komponennya, tidak disimpan ganda
- Saat aplikasi dimuat, data dinormalisasi: SKU duplikat diperbaiki, hari ketersediaan divalidasi (0–6), diskon/promo dibersihkan, foto divalidasi harus `data:image/`
- Stok dibatasi 0–99.999

> Karena penyimpanan berbasis localStorage, "sinkronisasi" ini berlaku **dalam satu browser/perangkat yang sama** — bukan antar perangkat.

---

## Struktur Folder

```txt
NusaPOS/
├── app/                        # App Router (halaman & API)
│   ├── analitik/               # /analitik — analitik penjualan (admin)
│   ├── api/geocode/            # API server: geocoding lokasi toko
│   ├── beranda/                # /beranda — landing page publik
│   ├── kasir/                  # /kasir — POS
│   ├── login/                  # /login — login staff
│   ├── member/                 # /member — manajemen member
│   ├── memberku/               # /memberku — portal member mandiri
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
│   ├── MemberBenefits.tsx      # daftar benefit member
│   ├── MemberForm.tsx          # form daftar/edit member
│   ├── MemberPicker.tsx        # pilih pelanggan di kasir
│   ├── PaymentModal.tsx        # modal pembayaran
│   ├── ProductAnalytics.tsx    # insight per produk
│   ├── ProductForm.tsx         # form produk & paket
│   ├── ProductThumb.tsx        # thumbnail emoji/foto
│   ├── QRISCenter.tsx          # tampilan pembayaran QRIS
│   ├── Receipt.tsx             # struk (cetak)
│   ├── SearchField.tsx         # input pencarian
│   ├── Shell.tsx               # kerangka navigasi aplikasi
│   ├── StoreMap.tsx            # peta Google Maps toko
│   ├── Toasts.tsx              # notifikasi toast
│   ├── charts.tsx              # chart custom (tanpa library)
│   ├── icons-extra.tsx         # ikon tambahan
│   ├── icons.tsx               # ikon utama
│   └── ui.tsx                  # primitif UI (button, card, dll)
├── lib/                        # logika bisnis & state
│   ├── analytics.ts            # agregasi analitik penjualan
│   ├── auth.ts                 # hash password, role & permission
│   ├── brand.ts                # aksen warna & branding
│   ├── demo-data.ts            # pusat data demo (produk, akun, settings)
│   ├── format.ts               # format rupiah, tanggal, util angka
│   ├── geo-attribution.ts      # atribusi penyedia geocoding
│   ├── geo.ts                  # util geo klien
│   ├── geocode-server.ts       # geocoding sisi server + fallback
│   ├── media.ts                # penanganan foto/logo (data URL)
│   ├── member-login.ts         # simpan login member (maks 5)
│   ├── member.ts               # tier, poin, diskon, validasi member
│   ├── pricing.ts              # diskon, promo harian, bundling, stok
│   ├── product-analytics.ts    # analitik per produk
│   ├── seed.ts                 # generator data demo 90 hari
│   ├── shift.ts                # sesi shift, auto-close, skor kasir
│   ├── sound.ts                # efek suara
│   ├── store.tsx               # StoreProvider + reducer + persist
│   └── types.ts                # seluruh tipe data aplikasi
├── .env.example
├── .gitignore
├── next.config.ts
├── package.json
├── postcss.config.mjs
├── tsconfig.json
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

# 4. jalankan development server
npm run dev
```

Buka `http://localhost:3000`, lalu login dengan [akun demo](#akun-demo).

Saat pertama kali dibuka (belum ada data tersimpan), aplikasi otomatis membuat **data demo 90 hari** memakai seed tetap (`20261116`) agar hasil konsisten.

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
| `/kasir` | POS / kasir | admin & kasir |
| `/produk` | Katalog produk & paket | admin |
| `/transaksi` | Riwayat transaksi, refund, ekspor CSV | admin & kasir (kasir: miliknya) |
| `/member` | Manajemen member & pelanggan | admin & kasir |
| `/memberku` | Portal member mandiri | publik (login member) |
| `/shift` | Jadwal & sesi shift | admin & kasir |
| `/analitik` | Analitik penjualan | admin |
| `/notifikasi` | Log aktivitas sistem | admin |
| `/pengaturan` | Pengaturan aplikasi & toko | bertingkat |
| `/beranda` | Landing page pelanggan | publik |
| `/login` | Login staff | publik |

---

## Data & Backup

### Penyimpanan

- Seluruh state aplikasi disimpan di localStorage key **`nusapos:v1`** (format `{ v: 1, state }`)
- Penulisan di-debounce ±250ms setiap perubahan state
- Login member tersimpan terpisah di **`nusapos:member-logins:v2`** (maks 5 akun, PIN di-obfuscate)
- Foto produk & logo disimpan inline sebagai data URL

### Data demo awal

Dibuat otomatis saat pertama kali dibuka (`lib/seed.ts`, seed `20261116`):

- 27 produk (24 satuan + 3 paket bundling)
- 9 pelanggan (4 member + 4 non-member + pelanggan umum)
- 3 akun staff, 13 template jadwal shift mingguan
- 6 katalog hadiah, 5 saved views
- ±90 hari transaksi simulasi: 9–19 order/hari (+5 saat weekend), jam ramai siang & sore, mix bayar 42% QRIS / 36% Tunai / 22% Kartu, ~2% refund, kas awal shift Rp150.000
- Toko demo: jam operasional 07.00–22.00, pajak 11%, service 0%

### Kelola data (admin, Pengaturan → Data)

- **Backup** data aplikasi
- **Acak ulang** data demo (regenerate seed; akun & sesi tetap)
- **Hapus data demo** (kosongkan produk/transaksi/member; akun & pengaturan tetap)
- Ekspor **CSV transaksi** dari halaman `/transaksi`

> Pindah browser/perangkat = mulai dari data demo baru. Gunakan backup untuk memindahkan data.

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

- Aplikasi tetap **berjalan sepenuhnya di sisi klien** untuk data — hosting hanya menyajikan halaman dan API geocode.
- Data setiap pengunjung tersimpan di browser masing-masing, **tidak terpusat di server**.
- Cocok untuk demo, presentasi klien, atau uji alur operasional — belum untuk transaksi produksi multi-perangkat.

---

## Known Limitations

1. **Penyimpanan per-browser** — data tidak tersinkron antar perangkat/tab private; hapus storage = data hilang.
2. **Hash password custom** (`lib/auth.ts`, FNV-like + salt) — cukup untuk demo lokal, **bukan** hashing kriptografis (bcrypt/argon2). Jangan dipakai produksi.
3. **PIN member tersimpan hanya di-obfuscate** (XOR + base64) di fitur "ingat login" — bukan enkripsi.
4. **Pembayaran disimulasikan** — QRIS & kartu (EDC demo) tidak terhubung payment gateway sungguhan.
5. **Kuota localStorage** (±5MB) — banyak foto produk beresolusi besar bisa memenuhi storage; penulisan gagal diabaikan diam-diam.
6. **Belum ada** automated tests, lint script, CI, dan file LICENSE.
7. Batas bawaan: 300 notifikasi, 500 riwayat penukaran, 5 login member tersimpan, stok maks 99.999.

---

## Troubleshooting

| Masalah | Solusi |
|---|---|
| Data hilang / kembali ke demo | Storage browser terhapus, ganti browser, atau mode private. Pulihkan dari backup. |
| Tidak bisa jualan di kasir | Kasir wajib punya **shift aktif** — buka shift dulu di `/shift` atau dari halaman kasir. |
| Login staff gagal | Pastikan pakai akun demo (`admin/admin123`, `kasir/kasir123`) atau akun yang dibuat admin. |
| Login portal member gagal | Pakai username/nomor member/HP + PIN 6 digit. Member harus aktif & portal aktif. PIN demo: `123456`. |
| Peta tidak muncul / lokasi meleset | Isi `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`; tanpa key, geocoding fallback Nominatim/Photon bisa kurang akurat. |
| Foto produk tidak tersimpan | localStorage penuh — kurangi/hapus foto lama, atau kecilkan ukuran gambar. |
| Shift tertutup sendiri | Auto-close mengikuti jam akhir jadwal (fallback jam tutup toko 22.00). Perpanjang shift sebelum jamnya tiba. |
| Ingin mulai bersih | Pengaturan → Data → hapus data demo, atau acak ulang untuk data segar. |
| Port 3000 dipakai | `npm run dev -- -p 3001` |

---

## Roadmap

Rencana pengembangan (belum diimplementasikan):

- [ ] Backend sungguhan + database (multi-perangkat, data terpusat)
- [ ] Autentikasi server-side dengan hashing standar (bcrypt/argon2) + sesi aman
- [ ] Integrasi payment gateway QRIS dinamis & EDC sungguhan
- [ ] Sinkronisasi real-time antar kasir
- [ ] PWA / mode offline-first
- [ ] Dukungan printer thermal & laci kas
- [ ] Laporan pajak & akuntansi yang lebih lengkap
- [ ] Automated tests + lint + CI
- [ ] Lisensi resmi

---

## License

Proyek ini belum menyertakan file `LICENSE`. Seluruh hak cipta dipegang pemilik repository sampai lisensi ditetapkan. Untuk penggunaan open source, tambahkan file `LICENSE` (misalnya MIT) lalu perbarui bagian ini.