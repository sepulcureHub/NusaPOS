export type Category = "Kopi" | "Non-Kopi" | "Makanan" | "Cemilan" | "Ritel";
export type PayMethod = "Tunai" | "QRIS" | "Kartu";
export type TxStatus = "Selesai" | "Refund";
export type Accent = "tosca" | "ungu" | "nila" | "lembayung" | "lavender";
export type ThemeMode = "dark" | "light" | "system";
export type LogoShape = "rounded" | "circle" | "square";
export type ProductKind = "single" | "bundle";
export type Role = "admin" | "kasir";

/* Tier naik otomatis dari AKUMULASI BELANJA, bukan poin. */
export type MemberTier = "Bronze" | "Silver" | "Gold" | "Platinum";

export interface Discount { type: "rp" | "pct"; value: number }
export interface DayPromo { day: number; type: "rp" | "pct"; value: number }
export interface BundleComponent { productId: string; qty: number }

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: Category;
  price: number;
  cost: number;
  stock: number;
  emoji: string;
  active: boolean;
  desc: string;
  popularity: number;
  photo: string | null;
  discount: Discount;
  dayPromos: DayPromo[];
  availableDays: number[];
  kind: ProductKind;
  bundleItems: BundleComponent[];
}

export interface TxComponent { productId: string; name: string; qty: number }

export interface TxItem {
  productId: string;
  name: string;
  emoji: string;
  category: Category;
  price: number;
  qty: number;
  photo?: string | null;
  basePrice?: number;
  kind?: ProductKind;
  components?: TxComponent[];
}

export interface Transaction {
  id: string;
  ts: number;
  items: TxItem[];
  subtotal: number;
  discount: number;
  memberDiscount?: number;
  memberPoints?: number;
  memberNo?: string;
  memberTier?: MemberTier;
  tax: number;
  service: number;
  total: number;
  method: PayMethod;
  tendered: number;
  change: number;
  customerId: string;
  customerName: string;
  cashier: string;
  status: TxStatus;
  shiftId?: string;
  isTest?: boolean;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  member: boolean;
  memberNo?: string;
  username?: string;
  email?: string;
  birthDate?: string;
  joinedAt?: number;
  points?: number;
  visits?: number;
  spend?: number;
  notes?: string;
  memberActive?: boolean;
  createdBy?: string;
  createdByName?: string;
  portal?: boolean;
  pinHash?: string;
}

export interface HeldOrder {
  id: string;
  ts: number;
  label: string;
  items: TxItem[];
  customerId: string;
  discount: Discount;
}

export interface User {
  id: string;
  name: string;
  username: string;
  role: Role;
  passHash: string;
  active: boolean;
  createdAt: number;
  isRoot: boolean;
}

export interface Session { userId: string; since: number }

export interface ShiftPlan {
  id: string;
  userId: string;
  day: number;
  start: string;
  end: string;
  note: string;
  active: boolean;
}

export interface ShiftSession {
  id: string;
  userId: string;
  userName: string;
  planId: string | null;
  openedAt: number;
  closedAt: number | null;
  autoCloseAt: number | null;
  openingCash: number;
  closingCash: number | null;
  note: string;
  closeNote?: string;
  source: "manual" | "auto";
  openedBy?: string;
  closedBy?: "manual" | "admin" | "auto" | null;
}

/* Katalog hadiah untuk penukaran poin (dikelola admin). */
export interface PointReward {
  id: string;
  name: string;
  emoji: string;
  desc: string;
  cost: number;
  active: boolean;
  createdAt: number;
}

/* Riwayat penukaran poin. */
export interface Redemption {
  id: string;
  customerId: string;
  memberNo: string;
  customerName: string;
  rewardId: string;
  rewardName: string;
  rewardEmoji: string;
  cost: number;
  ts: number;
  by: string;
  channel: "portal" | "kasir";
}

export type NotifKind =
  | "auth" | "sale" | "refund" | "product" | "stock" | "member" | "points"
  | "reward" | "shift" | "settings" | "user" | "view" | "data" | "system";

/* Log aktivitas sistem — mencatat seluruh perubahan. */
export interface AppNotification {
  id: string;
  ts: number;
  kind: NotifKind;
  title: string;
  detail?: string;
  actor?: string;
}

export interface MemberSession { customerId: string; since: number }

export interface Settings {
  theme: ThemeMode;
  accent: Accent;
  sound: boolean;
  brandName: string;
  brandTagline: string;
  logo: string | null;
  logoSize: number;
  logoShape: LogoShape;
  logoPlate: boolean;
  showWordmark: boolean;
  showTagline: boolean;
  storeName: string;
  tagline: string;
  address: string;
  phone: string;
  cashier: string;
  receiptFooter: string;
  taxPct: number;
  servicePct: number;
  lowStock: number;

  /* Program member — hanya admin yang boleh mengubah */
  memberEnabled: boolean;
  memberPointRate: number;
  memberDiscountPct: number;
  memberBirthdayPct: number;
  memberWelcomePoints: number;
  /* Ambang tier = total AKUMULASI BELANJA (Rp), bisa diatur admin */
  memberTierSilver: number;
  memberTierGold: number;
  memberTierPlatinum: number;
  /* Bonus diskon per tier (%) — termasuk Bronze, diatur admin */
  memberBonusBronze: number;
  memberBonusSilver: number;
  memberBonusGold: number;
  memberBonusPlatinum: number;
  memberBenefitNotes: string;
}

export interface SavedView {
  id: string;
  name: string;
  search: string;
  category: string;
  sort: string;
  status: string;
  cats?: string[];
  kind?: string;
  today?: boolean;
  discOnly?: boolean;
  promoToday?: boolean;
  lowOnly?: boolean;
  limitedOnly?: boolean;
  photoOnly?: boolean;
  minPrice?: string;
  maxPrice?: string;
}

export interface AppState {
  hydrated: boolean;
  products: Product[];
  transactions: Transaction[];
  customers: Customer[];
  held: HeldOrder[];
  views: SavedView[];
  settings: Settings;
  users: User[];
  session: Session | null;
  shiftPlans: ShiftPlan[];
  shiftSessions: ShiftSession[];
  rewards: PointReward[];
  redemptions: Redemption[];
  notifications: AppNotification[];
  notifReadAt: number;
  memberSession: MemberSession | null;
}

export type SeedData = Omit<AppState, "hydrated">;
export type DemoData = Omit<AppState, "hydrated" | "users" | "session" | "memberSession">;

export const CATEGORIES: Category[] = ["Kopi", "Non-Kopi", "Makanan", "Cemilan", "Ritel"];

export const CATEGORY_COLORS: Record<Category, string> = {
  Kopi: "var(--amber)",
  "Non-Kopi": "var(--pandan)",
  Makanan: "var(--chili)",
  Cemilan: "var(--magenta)",
  Ritel: "var(--laut)",
};

export const CATEGORY_EMOJI: Record<Category, string> = {
  Kopi: "☕", "Non-Kopi": "🍵", Makanan: "🍚", Cemilan: "🥐", Ritel: "📦",
};

export const METHODS: PayMethod[] = ["Tunai", "QRIS", "Kartu"];

export const METHOD_COLORS: Record<PayMethod, string> = {
  Tunai: "var(--amber)", QRIS: "var(--accent)", Kartu: "var(--laut)",
};

export const EMOJIS = ["☕","🧋","🍵","🍫","🥤","🍋","🥥","🌺","🍚","🍜","🍗","🍛","🥪","🥐","🍟","🍌","🍩","🥟","🍰","🫘","👜","🏺","📦","🥛","🧃","🍪","🧁","🍮"];