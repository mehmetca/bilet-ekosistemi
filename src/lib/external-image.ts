import { getStorageImageUrl } from "@/lib/storage-image";

/** kurdevents.org artık WordPress değil; veritabanındaki eski /wp-content/ linkleri 403 verir. */
export function isLegacyWordPressImageUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    return host === "kurdevents.org" && u.pathname.startsWith("/wp-content/");
  } catch {
    return false;
  }
}

/** Geçersiz eski WP URL'lerini atlar; Supabase/CDN URL'lerini normalize eder. */
export function resolvePublicImageUrl(url: string | null | undefined): string | null | undefined {
  if (!url || typeof url !== "string") return url;
  if (isLegacyWordPressImageUrl(url)) return null;
  return getStorageImageUrl(url) ?? url;
}
