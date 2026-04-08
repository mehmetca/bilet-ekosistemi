import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "./supabase-browser-client";

/**
 * Tarayıcıda: `createSupabaseBrowserClient()` (PKCE + çerez, @supabase/ssr).
 * `giris/page.tsx` doğrudan aynı modülü import eder; davranış aynı singleton’dır, localStorage kullanılmaz.
 * Eski localStorage tabanlı ikinci createClient kaldırıldı — aksi halde
 * "Multiple GoTrueClient instances" ve çıkış/yönlendirme sorunları oluşuyordu.
 */
let _serverAnon: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (typeof window !== "undefined") {
    return createSupabaseBrowserClient() as unknown as SupabaseClient;
  }

  if (_serverAnon) return _serverAnon;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "supabaseUrl is required. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel Environment Variables."
    );
  }
  _serverAnon = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    db: { schema: "public" },
    global: { headers: { "X-Client-Info": "bilet-ekosistemi/ssr-anon" } },
  });
  return _serverAnon;
}

/** Lazy proxy: ilk erişimde istemci oluşturulur (build sırasında env yoksa gecikmeli hata). */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop: string) {
    const target = getSupabaseClient() as unknown as Record<string, unknown>;
    const val = target[prop];
    return typeof val === "function" ? (val as (...args: unknown[]) => unknown).bind(target) : val;
  },
});
