import { supabase } from "@/lib/supabase-client";

/** Admin oturumu ile public ISR / Data Cache etiketlerini temizler. */
export async function revalidatePublicSiteCache(): Promise<void> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) return;
    const res = await fetch("/api/admin/revalidate-public", {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok) {
      console.warn("Public site önbelleği temizlenemedi:", res.status);
    }
  } catch (err) {
    console.warn("Public site önbelleği temizlenemedi:", err);
  }
}
