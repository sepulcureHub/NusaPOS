"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { rateLimit, clientKey } from "@/lib/rate-limit";
import type { AuthResult } from "@/lib/data/types";

export interface LiveSession {
  userId: string;
  storeId: string;
  name: string;
  role: "admin" | "kasir";
  isRoot: boolean;
}

export interface LoginWithSessionResult {
  ok: boolean;
  error?: string;
  session?: LiveSession;
}

type Sb = Awaited<ReturnType<typeof supabaseServer>>;

interface ProfileRow {
  id: string;
  store_id: string;
  name: string;
  role: string;
  is_root: boolean | null;
  active: boolean | null;
}

const PROFILE_COLS = "id, store_id, name, role, is_root, active";

/** Baca profil staf. maybeSingle: 0 baris bukan error, cukup null. */
async function fetchProfile(sb: Sb, userId: string): Promise<ProfileRow | null> {
  const { data, error } = await sb
    .from("profiles")
    .select(PROFILE_COLS)
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return data as ProfileRow;
}

function toSession(p: ProfileRow): LiveSession {
  return {
    userId: p.id,
    storeId: p.store_id,
    name: p.name,
    role: p.role === "admin" ? "admin" : "kasir",
    isRoot: Boolean(p.is_root),
  };
}

/** Rate limit login: 10 percobaan / menit / IP. */
async function loginRateError(): Promise<string | null> {
  const h = await headers();
  const rl = rateLimit(`login:${clientKey(h)}`, 10, 60_000);
  if (rl.ok) return null;
  return `Terlalu banyak percobaan. Coba lagi ${rl.retryAfter} detik`;
}

/**
 * Login + ambil profil dalam SATU server action.
 * Dipakai layar login: hemat round-trip, dan pesan error membedakan
 * "kredensial salah" vs "profil staf belum ada" vs "akun nonaktif".
 */
export async function loginAndGetSession(
  email: string,
  password: string
): Promise<LoginWithSessionResult> {
  const limited = await loginRateError();
  if (limited) return { ok: false, error: limited };

  const ident = email.trim();
  if (!ident || !password) return { ok: false, error: "Email dan password wajib diisi." };

  const sb = await supabaseServer();
  const { data: authData, error: authErr } = await sb.auth.signInWithPassword({
    email: ident,
    password,
  });

  if (authErr || !authData.user) {
    return { ok: false, error: "Email atau password salah" };
  }

  const profile = await fetchProfile(sb, authData.user.id);

  // Auth sukses tapi bukan staf terdaftar → bersihkan sesi, jangan setengah login.
  if (!profile) {
    await sb.auth.signOut();
    return {
      ok: false,
      error:
        "Akun ini belum terdaftar sebagai staf. Buat user di Authentication, lalu jalankan supabase/seed.sql agar tabel profiles terisi.",
    };
  }
  if (profile.active === false) {
    await sb.auth.signOut();
    return { ok: false, error: "Akun ini dinonaktifkan. Hubungi administrator." };
  }

  revalidatePath("/", "layout");
  return { ok: true, session: toSession(profile) };
}

/** Login saja (tanpa profil). Dipertahankan untuk kompatibilitas pemakai lama. */
export async function login(email: string, password: string): Promise<AuthResult> {
  const limited = await loginRateError();
  if (limited) return { ok: false, error: limited };

  const sb = await supabaseServer();
  const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
  if (error) return { ok: false, error: "Email atau password salah" };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function logout(): Promise<void> {
  const sb = await supabaseServer();
  await sb.auth.signOut();
  revalidatePath("/", "layout");
}

/** Dipakai Shell untuk memulihkan sesi saat refresh browser. */
export async function getLiveSession(): Promise<LiveSession | null> {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const profile = await fetchProfile(sb, user.id);
  if (!profile || profile.active === false) return null;
  return toSession(profile);
}