import "server-only";
import { createClient } from "@supabase/supabase-js";

function getEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `[NusaPOS] Environment variable "${name}" tidak ditemukan di server. ` +
      `Pastikan sudah diisi di .env.local dan server sudah di-restart.`
    );
  }
  return value;
}

export function supabaseAdmin() {
  const url = getEnv("NEXT_PUBLIC_SUPABASE_URL");
  const secret = getEnv("SUPABASE_SECRET_KEY");

  // Sanity check: pastikan ini bukan publishable key yang salah tempat
  if (secret.startsWith("sb_publishable_")) {
    throw new Error(
      `[NusaPOS] SUPABASE_SECRET_KEY harus sb_secret_..., tapi yang diisi sb_publishable_. ` +
      `Ambil key yang tepat dari Settings → API Keys.`
    );
  }

  return createClient(url, secret, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}