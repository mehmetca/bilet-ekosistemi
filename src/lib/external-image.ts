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

function toSupabaseTransformUrl(url: string, width: number, quality: number): string | null {
  try {
    const u = new URL(resolvePublicImageUrl(url) ?? url);
    const marker = "/storage/v1/object/public/";
    const markerIndex = u.pathname.indexOf(marker);
    if (markerIndex === -1) return null;
    u.pathname = `${u.pathname.slice(0, markerIndex)}/storage/v1/render/image/public/${u.pathname.slice(markerIndex + marker.length)}`;
    u.searchParams.set("width", String(width));
    u.searchParams.set("quality", String(quality));
    return u.toString();
  } catch {
    return null;
  }
}

export function getResponsivePublicImageUrl(
  url: string | null | undefined,
  width: number,
  quality = 75
): string | null | undefined {
  if (!url || typeof url !== "string") return url;
  if (isLegacyWordPressImageUrl(url)) return null;
  return toSupabaseTransformUrl(url, width, quality) ?? resolvePublicImageUrl(url);
}

export function getResponsivePublicImageSrcSet(
  url: string | null | undefined,
  widths = [640, 960, 1280, 1920],
  quality = 75
): string | undefined {
  if (!url || typeof url !== "string" || isLegacyWordPressImageUrl(url)) return undefined;
  const entries = widths
    .map((width) => {
      const transformed = toSupabaseTransformUrl(url, width, quality);
      return transformed ? `${transformed} ${width}w` : null;
    })
    .filter(Boolean);
  return entries.length > 0 ? entries.join(", ") : undefined;
}
