import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Sunucu tarafı service role istemcisi — her istek için yeni örnek.
 * Yalnızca API route'ları ve güvenli sunucu işlemlerinde kullanın.
 * Singleton pattern kullanılmaz (serverless/edge ortamı için güvenli).
 */
export function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase admin env (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) are required.");
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: "public" },
    global: { headers: { "X-Client-Info": "bilet-ekosistemi/server-admin" } },
  });
}
