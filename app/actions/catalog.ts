"use server";

import { supabaseServer } from "@/lib/supabase/server";
import { mapProduct, mapCustomer, mapTable } from "@/lib/data/map";
import type { CatalogData } from "@/lib/data/types";
import type { Settings } from "@/lib/types";

export async function getCatalog(): Promise<CatalogData | { error: string }> {
  const sb = await supabaseServer();
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return { error: "belum_login" };

  const [prod, cust, tbl, store] = await Promise.all([
    sb.from("products").select("*").eq("active", true).order("sort_order"),
    sb.from("customers").select("*").order("name"),
    sb.from("dining_tables").select("*").eq("active", true).order("label"),
    sb.from("stores").select("settings").single(),
  ]);

  if (prod.error || cust.error || tbl.error || store.error) {
    return { error: "gagal_ambil_data" };
  }

  return {
    products: (prod.data ?? []).map(mapProduct),
    customers: (cust.data ?? []).map(mapCustomer),
    tables: (tbl.data ?? []).map(mapTable),
    settings: (store.data?.settings ?? {}) as Settings,
  };
}