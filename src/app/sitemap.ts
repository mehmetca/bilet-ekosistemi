import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { getSiteUrl } from "@/lib/site-url";
import { SEO_SITEMAP_PATHS } from "@/lib/seo/sitemap-paths";
import { fetchSitemapDynamicPaths } from "@/lib/seo/sitemap-dynamic";

/** Site haritası veritabanından yenilensin (dakika). */
export const revalidate = 3600;

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
  for (const locale of locales) {
    const path = pathSuffix === "" ? "" : pathSuffix;
    const url = `${base}/${locale}${path}`;
    const languages: Record<string, string> = {};
    for (const l of locales) {
      languages[l] = `${base}/${l}${path}`;
    }
    languages["x-default"] = `${base}/${defaultLocale}${path}`;
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
