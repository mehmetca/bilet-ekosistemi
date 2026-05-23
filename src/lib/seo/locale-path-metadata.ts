import type { Metadata } from "next";
import { routing } from "@/i18n/routing";
import { getSiteUrl } from "@/lib/site-url";
import type { Locale } from "@/lib/i18n-content";

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
    },
    twitter: {
      card: "summary",
      title: opts.title,
      description: opts.description,
    },
    robots: { index: true, follow: true },
  };
}
