"use server";

import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { calcTotals } from "@/lib/format";
import { memberDiscountPct, pointsFor, tierOf } from "@/lib/member";
import { isAvailableOn, stockNeed, toTxItem } from "@/lib/pricing";
import { mapProduct, mapCustomer } from "@/lib/data/map";
import { checkOrderDiscount, maxKasirDiscountPct, storeDow } from "@/lib/sale-policy";
import type { SaleResult } from "@/lib/data/types";
import type { Settings, TxItem } from "@/lib/types";

/* isTest SENGAJA tidak ada di schema — ditentukan server (RPC), bukan klien. */
const schema = z.object({
  items: z.array(z.object({
    productId: z.string().uuid(),
    qty: z.number().int().min(1).max(999),
  })).min(1).max(50),
  customerId: z.string().uuid().nullable(),
  method: z.enum(["Tunai", "QRIS", "Kartu"]),
  tendered: z.number().int().min(0).max(1_000_000_000),
  orderType: z.enum(["dinein", "takeaway"]),
  tableId: z.string().uuid().nullable(),
  discount: z.object({
    type: z.enum(["rp", "pct"]),
    value: z.number().min(0).max(1_000_000_000),
  }).refine((d) => d.type !== "pct" || d.value <= 100, "Persen diskon 0–100"),
});

export async function recordSale(raw: unknown): Promise<SaleResult> {
  const p = schema.safeParse(raw);
  if (!p.success) return { ok: false, error: "Input tidak valid" };
  const input = p.data;

  const sb = await supabaseServer();
  // getUser() = terverifikasi ke Auth server (getSession tidak boleh dipercaya di server)
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Belum login" };

  const { data: profile } = await sb
    .from("profiles").select("role, active").eq("id", user.id).single();
  if (!profile?.active) return { ok: false, error: "Akun nonaktif / tidak terdaftar" };
  const role = profile.role as "admin" | "kasir";

  // ── Settings toko ──
  const { data: store, error: e2 } = await sb.from("stores").select("settings").single();
  if (e2 || !store) return { ok: false, error: "Settings toko gagal diambil" };
  const settings = (store.settings ?? {}) as Settings;
  const dow = storeDow(settings.timezone ?? "Asia/Jakarta");

  // ── Produk OTORITATIF dari DB (+ komponen bundle) ──
  const baseIds = [...new Set(input.items.map((i) => i.productId))];
  const { data: mainRows, error: e1 } = await sb
    .from("products").select("*").in("id", baseIds).eq("active", true);
  if (e1 || !mainRows || mainRows.length !== baseIds.length) {
    return { ok: false, error: "Produk tidak ditemukan / nonaktif" };
  }
  const pmap = new Map(mainRows.map((r) => [r.id as string, mapProduct(r)]));
  const compIds = [...new Set(
    mainRows.flatMap((r) =>
      r.kind === "bundle"
        ? ((r.bundle_items as { productId: string }[]) ?? []).map((c) => c.productId)
        : []
    )
  )].filter((id) => !pmap.has(id));
  if (compIds.length) {
    const { data: compRows } = await sb.from("products").select("*").in("id", compIds);
    for (const r of compRows ?? []) pmap.set(r.id as string, mapProduct(r));
  }
  const all = [...pmap.values()];

  // ── Ketersediaan hari (paritas dengan demo) ──
  for (const i of input.items) {
    const prod = pmap.get(i.productId)!;
    if (!isAvailableOn(prod, dow)) {
      return { ok: false, error: `${prod.name} tidak tersedia hari ini` };
    }
  }

  // ── Item + harga EFEKTIF (promo harian menimpa diskon dasar — paritas demo) ──
  const items: TxItem[] = input.items.map((i) =>
    toTxItem(pmap.get(i.productId)!, all, i.qty, dow)
  );

  // ── Pre-check stok (fast-fail; RPC cek ulang di bawah kunci) ──
  const need = new Map<string, number>();
  for (const i of items) {
    for (const [pid, q] of stockNeed(i)) need.set(pid, (need.get(pid) ?? 0) + q);
  }
  for (const [pid, q] of need) {
    const pr = pmap.get(pid);
    if (!pr) return { ok: false, error: "Komponen paket tidak ditemukan" };
    if (pr.stock < q) return { ok: false, error: `Stok ${pr.name} tidak cukup (sisa ${pr.stock})` };
  }

  // ── Policy diskon order per role ──
  const subtotalPreview = items.reduce((a, i) => a + i.price * i.qty, 0);
  const discErr = checkOrderDiscount(role, input.discount, subtotalPreview, maxKasirDiscountPct(settings));
  if (discErr) return { ok: false, error: discErr };

  // ── Member (opsional) ──
  let customer: ReturnType<typeof mapCustomer> | null = null;
  if (input.customerId) {
    const { data: c, error: e3 } = await sb
      .from("customers").select("*").eq("id", input.customerId).single();
    if (e3 || !c) return { ok: false, error: "Member tidak ditemukan" };
    customer = mapCustomer(c);
  }

  // ── Meja (pre-check; RPC cek ulang di bawah kunci) ──
  let tableLabel = "";
  if (input.orderType === "dinein") {
    if (!input.tableId) return { ok: false, error: "Dine-in wajib pilih meja" };
    const { data: t, error: e4 } = await sb
      .from("dining_tables").select("label, status").eq("id", input.tableId).single();
    if (e4 || !t) return { ok: false, error: "Meja tidak ditemukan" };
    if (t.status !== "kosong") return { ok: false, error: "Meja sudah terisi" };
    tableLabel = t.label as string;
  }

  // ── Total DI SERVER, logika sama persis dengan demo ──
  const mPct = customer?.member ? memberDiscountPct(customer, settings) : 0;
  const totals = calcTotals(items, input.discount, settings, mPct);
  const isTestPreview = role === "admin" && settings.adminSalesAsTest === true;
  const points = customer?.member && !isTestPreview ? pointsFor(totals.total, settings) : 0;

  if (input.method === "Tunai" && input.tendered < totals.total) {
    return { ok: false, error: "Uang diterima kurang dari total" };
  }
  const tendered = input.method === "Tunai" ? input.tendered : totals.total;
  const change = input.method === "Tunai" ? input.tendered - totals.total : 0;

  // ── RPC atomik: harga divalidasi ulang dari DB, stok/meja di bawah kunci,
  //    shift kasir wajib, is_test ditentukan server ──
  const { data, error } = await sb.rpc("record_sale", {
    p: {
      items: items.map((i) => ({ product_id: i.productId, qty: i.qty })),
      customer_id: input.customerId ?? "",
      member_tier: customer?.member ? tierOf(customer.spend ?? 0, settings) : "",
      discount_input: { type: input.discount.type, value: input.discount.value },
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
      table_id: input.orderType === "dinein" ? input.tableId ?? "" : "",
      table_label: tableLabel,
    },
  });

  if (error) {
    // Jangan bocorkan pesan internal Postgres ke klien
    if (/jwt|auth|session/i.test(error.message ?? "")) {
      return { ok: false, error: "Sesi berakhir — silakan login ulang" };
    }
    return { ok: false, error: "Server gagal memproses transaksi — coba lagi" };
  }
  const res = data as {
    ok: boolean; id?: string; tx_number?: string; total?: number;
    is_test?: boolean; shift_id?: string | null; error?: string;
  };
  if (!res.ok) return { ok: false, error: res.error ?? "Transaksi ditolak server" };

  return {
    ok: true, id: res.id, txNumber: res.tx_number,
    total: res.total, isTest: res.is_test, shiftId: res.shift_id ?? undefined,
  };
}