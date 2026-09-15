/**
 * Supabase Storage + CDN: Etkinlik afişleri ve diğer statik görseller için.
 * NEXT_PUBLIC_STORAGE_CDN_URL tanımlıysa Storage URL'leri CDN üzerinden sunulur.
 *
 * NOT: Coolify/Docker gibi ortamlarda NEXT_PUBLIC_* değişkenleri build sırasında
 * koda gömülmeyebilir. Bu yüzden CDN adresi ÖNCE runtime'dan okunur:
 * - tarayıcıda `[locale]` layout'unun yazdığı `window.__KURDEVENTS_STORAGE_CDN_URL`
 * - sunucuda `process.env.NEXT_PUBLIC_STORAGE_CDN_URL`
 */

function getSupabaseOrigin(): string {
  if (typeof globalThis === "undefined") return "";
  const runtimeProcess = (globalThis as typeof globalThis & { process?: RuntimeProcess }).process;
  const value = runtimeProcess?.env?.NEXT_PUBLIC_SUPABASE_URL || "";
  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
}

const CDN_GLOBAL_KEY = "__KURDEVENTS_STORAGE_CDN_URL";

type RuntimeProcess = { env?: Record<string, string | undefined> };

function getRuntimeEnv(name: string): string {
  if (typeof globalThis === "undefined") return "";
  const runtimeProcess = (globalThis as typeof globalThis & { process?: RuntimeProcess }).process;
  return runtimeProcess?.env?.[name] || "";
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
  if (!cdnUrl) return url;
  try {
    const parsed = new URL(url);
    const supabaseOrigin = getSupabaseOrigin();
    const isSupabaseStorage =
      parsed.pathname.startsWith("/storage/v1/object/") &&
      (!supabaseOrigin || parsed.origin === supabaseOrigin || parsed.hostname.endsWith(".supabase.co"));

    if (isSupabaseStorage) {
      const cdnOrigin = new URL(cdnUrl).origin;
      return `${cdnOrigin}${parsed.pathname}${parsed.search}`;
    }
  } catch {
    /* Keep non-URL and non-Storage values unchanged. */
  }
  return url;
}
