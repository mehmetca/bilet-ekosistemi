import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "./supabase-browser-client";
import { createServerSupabase } from "./supabase-server";

/**
 * Tarayıcıda: `createSupabaseBrowserClient()` (PKCE + çerez, @supabase/ssr) — singleton.
 * Sunucuda (SSR import): `createServerSupabase()` — singleton.
 * İstek başına çerezli oturum için `createSupabaseServerClient()` kullanın.
 */
function getSupabaseClient(): SupabaseClient {
  if (typeof window !== "undefined") {
    return createSupabaseBrowserClient() as unknown as SupabaseClient;
  }
  return createServerSupabase();
}

/** Lazy proxy: ilk erişimde singleton istemci döner (build sırasında env yoksa gecikmeli hata). */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop: string) {
    const target = getSupabaseClient() as unknown as Record<string, unknown>;
    const val = target[prop];
    return typeof val === "function" ? (val as (...args: unknown[]) => unknown).bind(target) : val;
  },
});
