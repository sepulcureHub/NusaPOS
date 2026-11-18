import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { CookieMethodsServer } from "@supabase/ssr";

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

export async function supabaseServer() {
  const cookieStore = await cookies();

  return createServerClient(
    getEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // Server Component (async) nggak bisa set cookies — aman diabaikan
          // Route handler & Server Action tetap bisa set cookies
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Expected di Server Component, abaikan
          }
        },
      } satisfies CookieMethodsServer,
    }
  );
}