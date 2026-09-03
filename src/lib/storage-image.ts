/**
 * Supabase Storage + CDN: Etkinlik afişleri ve diğer statik görseller için.
 * NEXT_PUBLIC_STORAGE_CDN_URL tanımlıysa Storage URL'leri CDN üzerinden sunulur.
 *
 * NOT: Coolify/Docker gibi ortamlarda NEXT_PUBLIC_* değişkenleri build sırasında
 * koda gömülmeyebilir. Bu yüzden CDN adresi ÖNCE runtime'dan okunur:
 * - tarayıcıda `[locale]` layout'unun yazdığı `window.__KURDEVENTS_STORAGE_CDN_URL`
 * - sunucuda `process.env.NEXT_PUBLIC_STORAGE_CDN_URL`
 */

const SUPABASE_URL =
  typeof process !== "undefined" ? (process.env.NEXT_PUBLIC_SUPABASE_URL as string) || "" : "";

const CDN_GLOBAL_KEY = "__KURDEVENTS_STORAGE_CDN_URL";

function getRuntimeEnv(name: string): string {
  if (typeof process === "undefined") return "";
  return (process.env[name as keyof typeof process.env] as string) || "";
}

function getCdnUrl(): string {
  if (typeof window !== "undefined") {
    const globalValue = (window as unknown as Record<string, unknown>)[CDN_GLOBAL_KEY];
    if (typeof globalValue === "string" && globalValue.trim()) return globalValue.trim();
  }
  return getRuntimeEnv("NEXT_PUBLIC_STORAGE_CDN_URL").trim();
}

/**
 * Storage'dan gelen görsel URL'ini CDN URL'ine çevirir (env tanımlıysa).
 * Etkinlik afişleri, hero, haber, reklam görselleri için kullanın.
 */
export function getStorageImageUrl(url: string | null | undefined): string | null | undefined {
  if (!url || typeof url !== "string") return url;
  const cdnUrl = getCdnUrl();
  if (!cdnUrl || !SUPABASE_URL) return url;
  try {
    const supabaseOrigin = new URL(SUPABASE_URL).origin;
    if (url.startsWith(supabaseOrigin)) return url.replace(supabaseOrigin, cdnUrl.replace(/\/$/, ""));
  } catch {
    /* ignore */
  }
  return url;
}
