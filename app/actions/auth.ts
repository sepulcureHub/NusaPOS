"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { rateLimit, clientKey } from "@/lib/rate-limit";
import type { AuthResult } from "@/lib/data/types";

export async function login(email: string, password: string): Promise<AuthResult> {
  const h = await headers();
  const rl = rateLimit(`login:${clientKey(h)}`, 10, 60_000);
  if (!rl.ok) {
    return { ok: false, error: `Terlalu banyak percobaan. Coba lagi ${rl.retryAfter} detik` };
  }
  const sb = await supabaseServer();
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: "Email atau password salah" };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function logout(): Promise<void> {
  const sb = await supabaseServer();
  await sb.auth.signOut();
  revalidatePath("/", "layout");
}

export interface LiveSession {
  userId: string;
  storeId: string;
  name: string;
  role: "admin" | "kasir";
  isRoot: boolean;
}

export async function getLiveSession(): Promise<LiveSession | null> {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const { data: profile } = await sb
    .from("profiles")
    .select("id, store_id, name, role, is_root, active")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.active) return null;
  return {
    userId: profile.id as string,
    storeId: profile.store_id as string,
    name: profile.name as string,
    role: profile.role as "admin" | "kasir",
    isRoot: Boolean(profile.is_root),
  };
}