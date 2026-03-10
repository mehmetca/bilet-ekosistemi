/**
 * Supabase Storage + CDN: Etkinlik afişleri ve diğer statik görseller için.
 * NEXT_PUBLIC_STORAGE_CDN_URL tanımlıysa Storage URL'leri CDN üzerinden sunulur (daha hızlı).
 * Örnek: NEXT_PUBLIC_STORAGE_CDN_URL=https://cdn.example.com
 * Supabase Dashboard > Project Settings > Storage'ta CDN etkinleştirilebilir.
 */
const SUPABASE_URL = typeof process !== "undefined" ? process.env.NEXT_PUBLIC_SUPABASE_URL : "";
const CDN_URL = typeof process !== "undefined" ? process.env.NEXT_PUBLIC_STORAGE_CDN_URL : "";

/**
 * Storage'dan gelen görsel URL'ini CDN URL'ine çevirir (env tanımlıysa).
 * Etkinlik afişleri, hero, haber, reklam görselleri için kullanın.
 */
export function getStorageImageUrl(url: string | null | undefined): string | null | undefined {
  if (!url || typeof url !== "string") return url;
  if (!CDN_URL || !SUPABASE_URL) return url;
  try {
    const supabaseOrigin = new URL(SUPABASE_URL).origin;
    if (url.startsWith(supabaseOrigin)) return url.replace(supabaseOrigin, CDN_URL.replace(/\/$/, ""));
  } catch {
    /* ignore */
  }
  return url;
}
