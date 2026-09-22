import type { Metadata } from "next";
import { routing } from "@/i18n/routing";
import { getSiteUrl } from "@/lib/site-url";
import type { Locale } from "@/lib/i18n-content";

/**
 * Tüm sayfalar için tek tip 1200×630 sosyal paylaşım kartı.
 * Görseli `src/app/api/og/route.tsx` üretir; böylece WhatsApp/Facebook/X
 * önizlemeleri her sayfada aynı formatta görünür.
 */
export function buildOgImageUrl(opts: {
  title: string;
  locale?: string;
  date?: string;
  venue?: string;
  image?: string | null;
}): string {
  const params = new URLSearchParams();
  params.set("title", opts.title);
  params.set("locale", opts.locale || routing.defaultLocale);
  if (opts.date) params.set("date", opts.date);
  if (opts.venue) params.set("venue", opts.venue);
  if (opts.image) params.set("image", opts.image);
  return `${getSiteUrl()}/api/og?${params.toString()}`;
}

/** pathSuffix: "" veya "/mekanlar" gibi locale öneki olmadan yol. */
export function buildLanguageAlternates(base: string, pathSuffix: string): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const l of routing.locales) {
    languages[l] = `${base}/${l}${pathSuffix}`;
  }
  languages["x-default"] = `${base}/${routing.defaultLocale}${pathSuffix}`;
  return languages;
}

export function buildCanonicalAlternates(
  locale: string,
  pathSuffix: string
): Metadata["alternates"] {
  const base = getSiteUrl();
  const loc = (routing.locales.includes(locale as Locale) ? locale : routing.defaultLocale) as string;
  const canonical = `${base}/${loc}${pathSuffix}`;
  return { canonical, languages: buildLanguageAlternates(base, pathSuffix) };
}

export function buildLocalePathMetadata(
  locale: string,
  pathSuffix: string,
  opts: { title: string; description: string }
): Metadata {
  const base = getSiteUrl();
  const loc = (routing.locales.includes(locale as Locale) ? locale : routing.defaultLocale) as string;
  const canonical = `${base}/${loc}${pathSuffix}`;
  const ogImage = buildOgImageUrl({ title: opts.title, locale: loc });

  return {
    title: opts.title,
    description: opts.description,
    alternates: buildCanonicalAlternates(loc, pathSuffix),
    openGraph: {
      title: opts.title,
      description: opts.description,
      url: canonical,
      siteName: "KurdEvents",
      type: "website",
      images: [{ url: ogImage, width: 1200, height: 630, alt: opts.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: opts.title,
      description: opts.description,
      images: [ogImage],
    },
    robots: { index: true, follow: true },
  };
}
