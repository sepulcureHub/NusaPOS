/**
 * NusaPOS — PUSAT DATA DEMO
 */

import type { Category, Customer, DayPromo, Discount, ProductKind, SavedView, Settings, User } from "./types";
import { ALL_DAYS, WEEKEND_DAYS } from "./pricing";
import { hashPassword } from "./auth";

export const DEMO_SEED = 20261116;

export const OPERATING_HOURS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];
export const DEMO_HOUR_WEIGHTS = [3, 5, 4, 3, 4, 8, 7, 4, 3, 3, 4, 7, 8, 6, 4];
export const DEMO_SHIFT_SPLIT = 15;
export const STORE_OPEN = "07:00";
export const STORE_CLOSE = "22:00";

export const DEFAULT_DEMO_PASSWORDS = ["admin123", "kasir123"];
export const DEMO_MEMBER_PIN = "123456";

export const DEMO_BEHAVIOR = {
  days: 90, baseOrders: 9, orderVariance: 10, weekendBoost: 5, maxItems: 3,
  extraItemChance: 0.15, doubleQtyChance: 0.3, tripleQtyChance: 0.06,
  orderDiscountChance: 0.08, orderDiscountFlat: 5000, orderDiscountPct: 0.1,
  refundChance: 0.02, qrisThreshold: 0.42, tunaiThreshold: 0.78,
  cashRoundTo: 5000, cashExtraChance: 0.2, cashExtra: 10000,
  walkInChance: 0.45, memberChance: 0.34, lowStockEvery: 7, lowStockOffset: 3, openingCash: 150000,
};

export const DEMO_USERS: User[] = [
  { id: "u-admin", name: "Rani Pramesti", username: "admin", role: "admin", passHash: hashPassword("admin123"), active: true, createdAt: Date.now(), isRoot: true },
  { id: "u-kasir", name: "Dimas Saputra", username: "kasir", role: "kasir", passHash: hashPassword("kasir123"), active: true, createdAt: Date.now(), isRoot: false },
  { id: "u-kasir2", name: "Ayu Lestari", username: "kasir2", role: "kasir", passHash: hashPassword("kasir123"), active: true, createdAt: Date.now(), isRoot: false },
];

export interface DemoShiftDef { username: string; day: number; start: string; end: string; note: string }

export const DEMO_SHIFT_TEMPLATE: DemoShiftDef[] = [
  { username: "kasir", day: 1, start: "07:00", end: "15:00", note: "Buka toko · siapkan bar" },
  { username: "kasir2", day: 1, start: "15:00", end: "22:00", note: "Tutup toko · rekap kas" },
  { username: "kasir2", day: 2, start: "07:00", end: "15:00", note: "Buka toko" },
  { username: "kasir", day: 2, start: "15:00", end: "22:00", note: "Sore · rush pulang kerja" },
  { username: "kasir", day: 3, start: "07:00", end: "15:00", note: "Buka toko" },
  { username: "kasir2", day: 3, start: "15:00", end: "22:00", note: "Tutup toko" },
  { username: "kasir2", day: 4, start: "07:00", end: "15:00", note: "Pastry day" },
  { username: "kasir", day: 4, start: "15:00", end: "22:00", note: "Sore" },
  { username: "kasir", day: 5, start: "07:00", end: "15:00", note: "Donat day" },
  { username: "kasir2", day: 5, start: "15:00", end: "22:00", note: "Tutup toko · donat day" },
  { username: "kasir", day: 6, start: "07:00", end: "15:00", note: "Sabtu pagi · matcha day" },
  { username: "kasir2", day: 6, start: "15:00", end: "22:00", note: "Sabtu sore · ramai" },
  { username: "kasir2", day: 0, start: "07:00", end: "15:00", note: "Minggu pagi · keluarga" },
];

export const WALK_IN_CUSTOMER: Customer = { id: "umum", name: "Pelanggan Umum", phone: "-", member: false };

const DAY_MS = 86400000;
const now = Date.now();
const pinHash = hashPassword(DEMO_MEMBER_PIN);

export const DEMO_CUSTOMERS: Customer[] = [
  WALK_IN_CUSTOMER,
  { id: "c1", name: "Budi Santoso", phone: "081211112222", member: false },
  {
    id: "c2", name: "Siti Rahma", phone: "081333334444", member: true, memberNo: "NUSA-0001",
    username: "siti",
    email: "siti.rahma@mail.com", birthDate: "1996-04-18", joinedAt: now - 320 * DAY_MS,
    points: 240, visits: 64, spend: 2260000, memberActive: true,
    notes: "Suka matcha, minta less sugar.", portal: true, pinHash,
    createdBy: "u-kasir", createdByName: "Dimas Saputra",
  },
  { id: "c3", name: "Agus Wijaya", phone: "082155556666", member: false },
  {
    id: "c4", name: "Dewi Lestari", phone: "082277778888", member: true, memberNo: "NUSA-0002",
    username: "dewi",
    email: "dewi.lestari@mail.com", birthDate: "1993-11-02", joinedAt: now - 210 * DAY_MS,
    points: 620, visits: 128, spend: 5140000, memberActive: true,
    notes: "Pelanggan korporat, sering pesan 10 gelas.", portal: true, pinHash,
    createdBy: "u-kasir2", createdByName: "Ayu Lestari",
  },
  { id: "c5", name: "Rizky Pratama", phone: "085699990000", member: false },
  {
    id: "c6", name: "Maya Putri", phone: "085712123434", member: true, memberNo: "NUSA-0003",
    username: "maya",
    email: "maya.putri@mail.com", birthDate: "2000-07-25", joinedAt: now - 96 * DAY_MS,
    points: 180, visits: 27, spend: 940000, memberActive: true,
    notes: "Datang tiap Kamis untuk croissant.", portal: true, pinHash,
    createdBy: "u-kasir", createdByName: "Dimas Saputra",
  },
  { id: "c7", name: "Joko Susilo", phone: "081856567878", member: false },
  {
    id: "c8", name: "Nina Kartika", phone: "081990901212", member: true, memberNo: "NUSA-0004",
    username: "nina",
    email: "", birthDate: "1998-01-09", joinedAt: now - 41 * DAY_MS,
    points: 60, visits: 9, spend: 310000, memberActive: true, notes: "",
    portal: true, pinHash,
    createdBy: "u-kasir2", createdByName: "Ayu Lestari",
  },
];

export interface DemoProductDef {
  name: string; sku: string; category: Category; price: number; cost: number;
  emoji: string; popularity: number; discount?: Discount; promos?: DayPromo[];
  days?: number[]; kind?: ProductKind; bundle?: { sku: string; qty: number }[]; desc?: string;
}

export const DEMO_PRODUCTS: DemoProductDef[] = [
  { name: "Kopi Susu Gula Aren", sku: "KOP-001", category: "Kopi", price: 22000, cost: 11000, emoji: "🧋", popularity: 10, desc: "Espresso double shot, susu segar, dan gula aren cair yang dimasak tiap pagi." },
  { name: "Espresso", sku: "KOP-002", category: "Kopi", price: 18000, cost: 8000, emoji: "☕", popularity: 6, desc: "Single origin Gayo, diseduh 25 detik." },
  { name: "Americano Dingin", sku: "KOP-003", category: "Kopi", price: 20000, cost: 9000, emoji: "🥤", popularity: 5, desc: "Espresso + air dingin. Ringan dan segar." },
  { name: "Cappuccino", sku: "KOP-004", category: "Kopi", price: 25000, cost: 12000, emoji: "🥛", popularity: 7, desc: "Foam susu tebal, taburan kayu manis tipis." },
  { name: "Matcha Latte", sku: "NKP-001", category: "Non-Kopi", price: 28000, cost: 13000, emoji: "🍵", popularity: 8, promos: [{ day: 6, type: "pct", value: 20 }], desc: "Matcha upacara asal Uji. Sabtu Matcha Day 20%." },
  { name: "Chocolate Signature", sku: "NKP-002", category: "Non-Kopi", price: 24000, cost: 11000, emoji: "🍫", popularity: 7, desc: "Cokelat couverture 55% dilelehkan." },
  { name: "Es Teh Melati", sku: "NKP-003", category: "Non-Kopi", price: 15000, cost: 5000, emoji: "🌺", popularity: 6, discount: { type: "pct", value: 10 }, promos: [{ day: 1, type: "pct", value: 25 }], desc: "Senin segar 25%." },
  { name: "Es Teh Lemon", sku: "NKP-004", category: "Non-Kopi", price: 18000, cost: 6000, emoji: "🍋", popularity: 5, desc: "Teh hitam pekat dengan lemon segar." },
  { name: "Es Kelapa Jeruk", sku: "NKP-005", category: "Non-Kopi", price: 20000, cost: 8000, emoji: "🥥", popularity: 4, desc: "Air kelapa muda dan jeruk peras." },
  { name: "Nasi Goreng Kampung", sku: "MKN-001", category: "Makanan", price: 32000, cost: 15000, emoji: "🍚", popularity: 9, promos: [{ day: 2, type: "pct", value: 15 }, { day: 3, type: "pct", value: 15 }], desc: "Selasa & Rabu 15%." },
  { name: "Mie Goreng Jawa", sku: "MKN-002", category: "Makanan", price: 28000, cost: 13000, emoji: "🍜", popularity: 7, desc: "Mie tebal bumbu kemiri." },
  { name: "Ayam Geprek Sambal Bawang", sku: "MKN-003", category: "Makanan", price: 30000, cost: 14000, emoji: "🍗", popularity: 8, desc: "Level 1–5, pilih di kasir." },
  { name: "Roti Bakar Srikaya", sku: "MKN-004", category: "Makanan", price: 20000, cost: 8000, emoji: "🥪", popularity: 5, discount: { type: "pct", value: 15 }, promos: [{ day: 0, type: "rp", value: 6000 }], desc: "Minggu hemat Rp 6.000." },
  { name: "Nasi Ayam Bali", sku: "MKN-005", category: "Makanan", price: 35000, cost: 17000, emoji: "🍛", popularity: 6, days: WEEKEND_DAYS, desc: "Hanya Sabtu & Minggu." },
  { name: "Croissant Butter", sku: "CML-001", category: "Cemilan", price: 24000, cost: 10000, emoji: "🥐", popularity: 7, promos: [{ day: 4, type: "pct", value: 20 }], desc: "Kamis 20%." },
  { name: "Kentang Goreng", sku: "CML-002", category: "Cemilan", price: 18000, cost: 7000, emoji: "🍟", popularity: 6, desc: "Dua kali goreng." },
  { name: "Pisang Goreng Keju", sku: "CML-003", category: "Cemilan", price: 18000, cost: 7000, emoji: "🍌", popularity: 5, desc: "Keju cheddar melimpah." },
  { name: "Donat Gula Aren", sku: "CML-004", category: "Cemilan", price: 12000, cost: 4500, emoji: "🍩", popularity: 4, discount: { type: "rp", value: 2000 }, promos: [{ day: 5, type: "pct", value: 30 }], desc: "Jumat Donat Day 30%." },
  { name: "Risol Mayo", sku: "CML-005", category: "Cemilan", price: 15000, cost: 6000, emoji: "🥟", popularity: 5, desc: "Digoreng saat dipesan." },
  { name: "Brownies Lava", sku: "CML-006", category: "Cemilan", price: 26000, cost: 11000, emoji: "🍰", popularity: 4, days: [5, 6, 0], desc: "Jumat–Minggu saja." },
  { name: "Biji Kopi Aren 250g", sku: "RTL-001", category: "Ritel", price: 65000, cost: 38000, emoji: "🫘", popularity: 3, desc: "Roasting mingguan." },
  { name: "Tote Bag Nusantara", sku: "RTL-002", category: "Ritel", price: 55000, cost: 25000, emoji: "👜", popularity: 2, desc: "Kanvas tebal 12oz." },
  { name: "Tumbler Nusa", sku: "RTL-003", category: "Ritel", price: 85000, cost: 42000, emoji: "🏺", popularity: 2, desc: "Baja 500ml." },
  { name: "Drip Bag Kit (10 sachet)", sku: "RTL-004", category: "Ritel", price: 45000, cost: 22000, emoji: "📦", popularity: 3, desc: "Kopi saring praktis." },
  { name: "Paket Ngopi Berdua", sku: "PKT-001", category: "Kopi", price: 79000, cost: 0, emoji: "🎁", popularity: 6, kind: "bundle", bundle: [{ sku: "KOP-001", qty: 2 }, { sku: "CML-001", qty: 2 }], desc: "Cukup buat ngobrol lama." },
  { name: "Paket Sarapan Nusantara", sku: "PKT-002", category: "Makanan", price: 42000, cost: 0, emoji: "🎁", popularity: 7, kind: "bundle", bundle: [{ sku: "MKN-001", qty: 1 }, { sku: "NKP-003", qty: 1 }], promos: [{ day: 1, type: "rp", value: 5000 }], desc: "Senin potong ekstra." },
  { name: "Paket Kerja Fokus", sku: "PKT-003", category: "Kopi", price: 39000, cost: 0, emoji: "🎁", popularity: 5, kind: "bundle", bundle: [{ sku: "KOP-003", qty: 1 }, { sku: "CML-006", qty: 1 }], days: [5, 6, 0], desc: "Teman deadline akhir pekan." },
];

export const DEMO_REWARDS = [
  { name: "Gratis Kopi Susu", emoji: "🧋", desc: "Tukar dengan 1 Kopi Susu Gula Aren ukuran reguler.", cost: 300, active: true },
  { name: "Diskon Rp 10.000", emoji: "🏷️", desc: "Potongan Rp 10.000 untuk transaksi berikutnya.", cost: 150, active: true },
  { name: "Croissant Gratis", emoji: "🥐", desc: "1 Croissant Butter hangat dari oven pagi.", cost: 350, active: true },
  { name: "Voucher Rp 25.000", emoji: "💳", desc: "Voucher belanja senilai Rp 25.000, berlaku semua menu.", cost: 400, active: true },
  { name: "Gratis Matcha Latte", emoji: "🍵", desc: "1 Matcha Latte ukuran reguler.", cost: 320, active: true },
  { name: "Tumbler Nusa Edisi Member", emoji: "🏺", desc: "Tumbler baja edisi khusus, hanya lewat penukaran poin.", cost: 900, active: false },
];

export const DEMO_VIEWS: SavedView[] = [
  { id: "v1", name: "Stok menipis", search: "", category: "Semua", sort: "stock-asc", status: "Semua", lowOnly: true },
  { id: "v2", name: "Kopi terlaris", search: "", category: "Kopi", sort: "sold-desc", status: "Semua", cats: ["Kopi"] },
  { id: "v3", name: "Paket bundling", search: "", category: "Semua", sort: "manual", status: "Semua", kind: "bundle" },
  { id: "v4", name: "Limited edition", search: "", category: "Semua", sort: "manual", status: "Semua", limitedOnly: true },
  { id: "v5", name: "Promo hari ini", search: "", category: "Semua", sort: "discount-desc", status: "Semua", promoToday: true },
];

export const DEMO_EDC = { brand: "NUSA EDC", pan: "•••• •••• •••• 4288", label: "DEBIT / KREDIT" };

export const DEMO_LANDING = {
  eyebrow: "Kedai kopi & dapur Nusantara",
  headline: ["Setiap tegukan", "punya cerita", "dari rumah."],
  sub: "Kami menyangrai biji kopi dari Gayo, Kintamani, dan Toraja setiap minggu, lalu memasaknya bersama resep dapur rumahan.",
  promises: [
    { icon: "bean", title: "Disangrai mingguan", desc: "Biji kopi tidak pernah lebih tua dari 14 hari saat masuk cangkir kamu." },
    { icon: "clock", title: "Dapur buka 07.00", desc: "Sarapan hangat sejak pagi, dapur terakhir menerima pesanan 21.45." },
    { icon: "tag", title: "Promo ganti tiap hari", desc: "Senin teh melati, Kamis croissant, Jumat donat. Selalu ada yang murah." },
    { icon: "heart", title: "Member naik tier dari belanja", desc: "Daftar gratis, dapat username & PIN, belanja terus, tier naik otomatis dan poin bisa ditukar hadiah." },
  ],
  story: "Berawal dari gerobak di depan gang Malioboro tahun 2019, kami belajar satu hal: orang tidak hanya membeli kopi, mereka membeli tempat untuk pulang sebentar.",
  testimonials: [
    { name: "Maya Putri", role: "Member Bronze", rating: 5, quote: "Kopi susu arennya tidak kemanisan. Poinnya cepat kumpul, kemarin sudah bisa tukar croissant gratis." },
    { name: "Agus Wijaya", role: "Pelanggan umum", rating: 5, quote: "Nasi goreng kampungnya persis buatan ibu saya. Selasa diskon lagi." },
    { name: "Nina Kartika", role: "Member Bronze", rating: 4, quote: "Brownies lava cuma ada akhir pekan, jadi tiap Sabtu saya mampir." },
    { name: "Dewi Lestari", role: "Member Gold", rating: 5, quote: "Sudah Gold dari akumulasi belanja kantor. Potongan tier-nya terasa banget, plus poin bisa ditukar voucher." },
  ],
  faq: [
    { q: "Bagaimana cara jadi member?", a: "Minta kasir mendaftarkan nama, nomor HP, username, dan PIN. Setelah itu kamu bisa login ke portal member." },
    { q: "Bagaimana cara naik tier?", a: "Tier naik otomatis dari total akumulasi belanjamu. Semakin sering belanja, semakin cepat naik — tanpa syarat lain." },
    { q: "Poin dipakai untuk apa?", a: "Poin bisa ditukar dengan hadiah di katalog penukaran: minuman gratis, diskon, sampai merchandise." },
    { q: "Metode pembayaran apa saja?", a: "Tunai, QRIS semua bank & e-wallet, serta kartu debit/kredit. Tanpa biaya tambahan." },
  ],
};

export const DEMO_SETTINGS: Settings = {
  theme: "dark", accent: "tosca", sound: true,
  brandName: "NusaPOS", brandTagline: "KASIR NUSANTARA",
  logo: null, logoSize: 34, logoShape: "rounded", logoPlate: true, showWordmark: true, showTagline: true,
  storeName: "Nusa Coffee & Eatery",
  tagline: "Kopi & Rasa Nusantara",
  address: "Jl. Malioboro No. 88, Yogyakarta 55271",
  phone: "0812-3456-7890",
  cashier: "Rani",
  receiptFooter: "Terima kasih! Follow @nusacoffee untuk promo ☕",
  taxPct: 11, servicePct: 0, lowStock: 10,
  memberEnabled: true,
  memberPointRate: 1000,
  memberDiscountPct: 5,
  memberBirthdayPct: 10,
  memberWelcomePoints: 50,
  /* ambang tier = total belanja (Rp) */
  memberTierSilver: 1500000,
  memberTierGold: 5000000,
  memberTierPlatinum: 15000000,
  /* bonus diskon per tier (%) — Bronze ikut bisa diatur */
  memberBonusBronze: 0,
  memberBonusSilver: 1,
  memberBonusGold: 3,
  memberBonusPlatinum: 5,
  memberBenefitNotes: "Sebutkan username member saat bertanya ke kasir. Tier naik otomatis dari akumulasi belanja, dan poin bisa ditukar di katalog hadiah.",
};

export const DEMO_DEFAULT_DAYS = ALL_DAYS;