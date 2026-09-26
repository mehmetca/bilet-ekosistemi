import { supabase } from "@/lib/supabase-client";

/**
 * API route'larına gönderilecek güncel access token.
 * Önce mevcut oturumdan token alınır; token yok veya süresi dolmak üzere ise refreshSession denenir.
 */
export async function getAccessTokenForApi(): Promise<string | null> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) return null;

    // Token hala geçerliyse direkt döndür (30 sn tampon)
    const expiresAt = session.expires_at ?? 0;
    const nowSec = Math.floor(Date.now() / 1000);
    if (expiresAt - nowSec > 30) {
      return session.access_token;
    }

    // Token süresi dolmak üzere — yenile
    const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
    if (!refreshErr && refreshed.session?.access_token) {
      return refreshed.session.access_token;
    }

    // Refresh başarısız (geçersiz token) — null döndür, kullanıcı yeniden giriş yapar
    return null;
  } catch {
    return null;
  }
}
