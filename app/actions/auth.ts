"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import type { AuthResult } from "@/lib/data/types";

export async function login(email: string, password: string): Promise<AuthResult> {
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
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return null;

  const { data: profile } = await sb
    .from("profiles")
    .select("id, store_id, name, role, is_root, active")
    .eq("id", session.user.id)
    .single();

  if (!profile || !profile.active) return null;
  return {
    userId: profile.id,
    storeId: profile.store_id,
    name: profile.name,
    role: profile.role,
    isRoot: profile.is_root,
  };
}