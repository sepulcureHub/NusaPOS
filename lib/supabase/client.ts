import { createBrowserClient } from "@supabase/ssr";

function getEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `[NusaPOS] Environment variable "${name}" tidak ditemukan. ` +
      `Pastikan sudah diisi di .env.local dan dev server sudah di-restart.`
    );
  }
  return value;
}

export function supabaseBrowser() {
  return createBrowserClient(
    getEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")
  );
}