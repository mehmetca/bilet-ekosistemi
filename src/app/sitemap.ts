import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { getSiteUrl } from "@/lib/site-url";
import { SEO_SITEMAP_PATHS } from "@/lib/seo/sitemap-paths";
import { fetchSitemapDynamicPaths } from "@/lib/seo/sitemap-dynamic";

/** Site haritası botlar tarafından sık istenir; public URL seti sık değişmediği için 30 dk cache yeterli. */
export const revalidate = 1800;

/** `trailingSlash: true` — sitemap adresleri sayfanın gerçek adresiyle birebir aynı bitmeli,
 *  aksi halde Google 985 adresin tamamında 308 görüp "Page with redirect" ile indekslemeyi erteliyor. */
function withTrailingSlash(url: string): string {
  return url.endsWith("/") ? url : `${url}/`;
}

function pushLocalizedEntries(
  entries: MetadataRoute.Sitemap,
  base: string,
  locales: readonly string[],
  defaultLocale: string,
  pathSuffix: string,
  lastModified: Date,
  changeFrequency: NonNullable<MetadataRoute.Sitemap[0]["changeFrequency"]>,
  priority: number
) {
  const path = pathSuffix.replace(/\/+$/, "");
  for (const locale of locales) {
    const url = withTrailingSlash(`${base}/${locale}${path}`);
    const languages: Record<string, string> = {};
    for (const l of locales) {
      languages[l] = withTrailingSlash(`${base}/${l}${path}`);
    }
    languages["x-default"] = withTrailingSlash(`${base}/${defaultLocale}${path}`);
    entries.push({
      url,
      lastModified,
      changeFrequency,
      priority,
      alternates: { languages },
    });
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl();
  const { locales, defaultLocale } = routing;
  const entries: MetadataRoute.Sitemap = [];
  const now = new Date();

  for (const pathSuffix of SEO_SITEMAP_PATHS) {
    pushLocalizedEntries(
      entries,
      base,
      locales,
      defaultLocale,
      pathSuffix,
      now,
      pathSuffix === "" ? "daily" : "weekly",
      pathSuffix === "" ? 1 : 0.8
    );
  }

  const dynamic = await fetchSitemapDynamicPaths();
  for (const { path, lastModified } of dynamic) {
    pushLocalizedEntries(entries, base, locales, defaultLocale, path, lastModified, "weekly", 0.7);
  }

  return entries;
}
