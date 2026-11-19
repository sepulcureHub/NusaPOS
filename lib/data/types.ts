// lib/data/types.ts
import type { Product, Customer, DiningTable, Settings } from "@/lib/types";

export interface CatalogData {
  products: Product[];
  customers: Customer[];
  tables: DiningTable[];
  settings: Settings;
}

export interface SaleInput {
  items: { productId: string; qty: number }[];
  customerId: string | null;
  method: "Tunai" | "QRIS" | "Kartu";
  tendered: number;
  orderType: "dinein" | "takeaway";
  tableId: string | null;
  discount: { type: "rp" | "pct"; value: number };
  isTest: boolean;
}

export interface SaleResult {
  ok: boolean;
  id?: string;
  txNumber?: string;
  error?: string;
}

export interface AuthResult {
  ok: boolean;
  error?: string;
}