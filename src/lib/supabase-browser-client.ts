import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Tarayıcıda tek Supabase + tek GoTrue örneği.
 * @supabase/ssr içindeki cache'e ek olarak modül seviyesinde tutuyoruz; aksi halde
 * (HMR / chunk bölünmesi vb.) "Multiple GoTrueClient instances" uyarısı görülebiliyor.
 */
let browserSingleton: SupabaseClient | null = null;

export function createSupabaseBrowserClient(): SupabaseClient {
  if (typeof window === "undefined") {
    throw new Error("createSupabaseBrowserClient is browser-only");
  }
  if (!browserSingleton) {
    browserSingleton = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          flowType: "pkce",
          detectSessionInUrl: true,
          persistSession: true,
          autoRefreshToken: true,
        },
      }
    ) as unknown as SupabaseClient;
  }
  return browserSingleton;
}
