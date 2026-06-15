import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SERVER_ANON_AUTH = {
  autoRefreshToken: false,
  persistSession: false,
  detectSessionInUrl: false,
} as const;

let serverSupabase: SupabaseClient | null = null;

/**
 * Sunucu tarafı anon key istemcisi — process başına tek örnek (singleton).
 * Server Components, Route Handlers ve public okuma sorguları için kullanın.
 * Oturum çerezi gerekiyorsa `createSupabaseServerClient()` (istek başına) kullanın.
 */
export function createServerSupabase(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase env vars (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY) are required.");
  }
  if (serverSupabase) return serverSupabase;
  serverSupabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: SERVER_ANON_AUTH,
    db: { schema: "public" },
    global: { headers: { "X-Client-Info": "bilet-ekosistemi/server-anon" } },
  });
  return serverSupabase;
}

/** @deprecated createServerSupabase ile aynı — geriye dönük uyumluluk */
export const getServerSupabase = createServerSupabase;
