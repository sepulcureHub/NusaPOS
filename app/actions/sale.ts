"use server";

import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { calcTotals } from "@/lib/format";
import { tierOf, memberDiscountPct, pointsFor } from "@/lib/member";
import { mapProduct, mapCustomer } from "@/lib/data/map";
import type { SaleResult } from "@/lib/data/types";
import type { TxItem, Settings } from "@/lib/types";

const schema = z.object({
  items: z.array(z.object({
    productId: z.string().uuid(),
    qty: z.number().int().min(1).max(999),
  })).min(1).max(50),
  customerId: z.string().uuid().nullable(),
  method: z.enum(["Tunai", "QRIS", "Kartu"]),
  tendered: z.number().int().min(0),
  orderType: z.enum(["dinein", "takeaway"]),
  tableId: z.string().uuid().nullable(),
  discount: z.object({ type: z.enum(["rp", "pct"]), value: z.number().min(0) }),
  isTest: z.boolean(),
});

export async function recordSale(raw: unknown): Promise<SaleResult> {
  const p = schema.safeParse(raw);
  if (!p.success) return { ok: false, error: "Input tidak valid" };
  const input = p.data;

  const sb = await supabaseServer();
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return { ok: false, error: "Belum login" };

  // ── 1. Produk OTORITATIF dari DB ──
  const baseIds = [...new Set(input.items.map(i => i.productId))];
  const { data: mainRows, error: e1 } = await sb
    .from("products").select("*").in("id", baseIds).eq("active", true);
  if (e1 || !mainRows || mainRows.length !== baseIds.length) {
    return { ok: false, error: "Produk tidak ditemukan / nonaktif" };
  }

  const pmap = new Map(mainRows.map(r => [r.id, mapProduct(r)]));

  // ── 1b. Resolve komponen bundle ──
  const compIds = [...new Set(
    mainRows.flatMap(r =>
      r.kind === "bundle"
        ? ((r.bundle_items as { productId: string }[]) ?? []).map(c => c.productId)
        : []
    )
  )].filter(id => !pmap.has(id));

  if (compIds.length) {
    const { data: compRows } = await sb
      .from("products").select("*").in("id", compIds);
    for (const r of compRows ?? []) pmap.set(r.id, mapProduct(r));
  }

  // ── 2. Settings toko ──
  const { data: store, error: e2 } = await sb.from("stores").select("settings").single();
  if (e2 || !store) return { ok: false, error: "Settings toko gagal diambil" };
  const settings = store.settings as Settings;

  // ── 3. Member (opsional) ──
  let customer: ReturnType<typeof mapCustomer> | null = null;
  if (input.customerId) {
    const { data: c, error: e3 } = await sb
      .from("customers").select("*").eq("id", input.customerId).single();
    if (e3 || !c) return { ok: false, error: "Member tidak ditemukan" };
    customer = mapCustomer(c);
  }

  // ── 4. Meja (opsional, dine-in) ──
  let tableLabel = "";
  if (input.orderType === "dinein") {
    if (!input.tableId) return { ok: false, error: "Dine-in wajib pilih meja" };
    const { data: t, error: e4 } = await sb
      .from("dining_tables").select("label, status").eq("id", input.tableId).single();
    if (e4 || !t) return { ok: false, error: "Meja tidak ditemukan" };
    if (t.status !== "kosong") return { ok: false, error: "Meja sudah terisi" };
    tableLabel = t.label;
  }

  // ── 5. Bangun TxItem[] + hitung total DI SERVER pakai calcTotals ──
  const items: TxItem[] = input.items.map(i => {
    const prod = pmap.get(i.productId)!;
    const txItem: TxItem = {
      productId: prod.id,
      name: prod.name,
      emoji: prod.emoji,
      category: prod.category,
      price: prod.price,
      basePrice: prod.price,
      qty: i.qty,
      kind: prod.kind,
      photo: prod.photo,
    };
    if (prod.kind === "bundle") {
      txItem.components = prod.bundleItems.map(c => ({
        productId: c.productId,
        name: pmap.get(c.productId)?.name ?? "",
        qty: c.qty,
      }));
    }
    return txItem;
  });

  const mPct = customer?.member ? memberDiscountPct(customer, settings) : 0;
  const totals = calcTotals(items, input.discount, settings, mPct);
  const points = customer?.member ? pointsFor(totals.total, settings) : 0;

  // ── 6. Validasi uang Tunai di server ──
  if (input.method === "Tunai" && input.tendered < totals.total) {
    return { ok: false, error: "Uang diterima kurang dari total" };
  }
  const tendered = input.method === "Tunai" ? input.tendered : totals.total;
  const change = input.method === "Tunai" ? input.tendered - totals.total : 0;

  // ── 7. Panggil RPC atomik ──
  const { data, error } = await sb.rpc("record_sale", {
    p: {
      items: items.map(i => ({
        product_id: i.productId,
        name: i.name,
        emoji: i.emoji,
        category: i.category,
        price: i.price,
        base_price: i.basePrice,
        qty: i.qty,
        kind: i.kind,
        components: (i.components ?? []).map(c => ({
          product_id: c.productId,
          name: c.name,
          qty: c.qty,
        })),
      })),
      customer_id: input.customerId ?? "",
      customer_name: customer?.name ?? "Pelanggan Umum",
      member_no: customer?.memberNo ?? "",
      member_tier: customer?.member ? tierOf(customer.spend ?? 0, settings) : "",
      discount: totals.discount,
      member_discount: totals.memberDiscount,
      member_points: points,
      subtotal: totals.subtotal,
      tax: totals.tax,
      service: totals.service,
      total: totals.total,
      method: input.method,
      tendered,
      change,
      order_type: input.orderType,
      table_id: input.tableId ?? "",
      table_label: tableLabel,
      is_test: input.isTest,
    },
  });

  if (error) return { ok: false, error: error.message };
  const res = data as { ok: boolean; id?: string; tx_number?: string; error?: string };
  if (!res.ok) return { ok: false, error: res.error ?? "Transaksi ditolak server" };

  return { ok: true, id: res.id, txNumber: res.tx_number };
}