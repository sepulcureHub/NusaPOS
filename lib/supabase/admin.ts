import "server-only";
import { createClient } from "@supabase/supabase-js";

export function supabaseAdmin() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("[NusaPOS] SUPABASE_SECRET_KEY belum diisi di .env.local");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}