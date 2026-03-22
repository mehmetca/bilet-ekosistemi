import { supabase } from "@/lib/supabase-client";

/**
 * API route'larına gönderilecek güncel access token.
 * Önce refreshSession ile JWT yenilenir; bazı ortamlarda getSession eski token döndürebilir.
 */
export async function getAccessTokenForApi(): Promise<string | null> {
  const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
  if (!refreshErr && refreshed.session?.access_token) {
    return refreshed.session.access_token;
  }

  await supabase.auth.getUser();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.access_token) return session.access_token;

  return null;
}
