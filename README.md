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
| Next.js | Framework React full-stack |
| React | UI library |
| TypeScript | Static typing |
| Tailwind CSS | Styling utility-first |
| localStorage | Penyimpanan demo lokal |
| Google Maps Embed | Peta lokasi toko |
| Nominatim / Photon | Fallback geocoding publik |

Versi yang digunakan pada project ini:

- Next.js 16
- React 19
- TypeScript 5
- Tailwind CSS v4

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
- menahan order
- membuka/menutup shift kasir

Kasir hanya bisa bekerja jika sedang memiliki **shift aktif**.

---

### 2. Katalog Produk

Halaman `/produk` dikelola oleh admin.

Fitur produk:

- nama produk
- SKU
- kategori
- harga jual
- HPP
- stok
- deskripsi
- emoji / foto
- status aktif
- diskon dasar
- promo harian
- hari ketersediaan
- produk satuan
- produk bundling / paket

Contoh kategori:

- Kopi
- Non-Kopi
- Makanan
- Cemilan
- Ritel

---

### 3. Promo Harian

Promo bisa dijadwalkan berdasarkan hari:

- Senin
- Selasa
- Rabu
- Kamis
- Jumat
- Sabtu
- Minggu

Promo harian menimpa diskon dasar jika keduanya aktif pada hari yang sama.

Contoh:

- Diskon dasar: 10%
- Promo Kamis: 20%

Maka pada hari Kamis harga menggunakan promo 20%.

---

### 4. Paket Bundling

Produk bisa berbentuk paket, misalnya:

- Paket Ngopi Berdua
- Paket Sarapan Nusantara
- Paket Kerja Fokus

Sistem menghitung:

- harga normal dari isi paket
- harga paket
- penghematan
- stok porsi
- ketersediaan hari

---

### 5. Halaman Pelanggan

Route:

```txt
/beranda