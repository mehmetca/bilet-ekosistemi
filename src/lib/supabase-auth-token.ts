import { supabase } from "@/lib/supabase-client";

/**
 * API route'larına Authorization: Bearer ile gönderilecek güncel access token.
 * Önce getUser() ile oturum doğrulanır/yenilenir; ardından getSession ile JWT alınır.
 */
export async function getAccessTokenForApi(): Promise<string | null> {
  await supabase.auth.getUser();

  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) return session.access_token;

  const { data: ref, error } = await supabase.auth.refreshSession();
  if (error || !ref.session?.access_token) return null;
  return ref.session.access_token;
}
