import type { Metadata } from "next";
import { routing } from "@/i18n/routing";
import { getSiteUrl } from "@/lib/site-url";
import type { Locale } from "@/lib/i18n-content";

export function buildLocalePathMetadata(
  locale: string,
  pathSuffix: string,
  opts: { title: string; description: string }
): Metadata {
  const base = getSiteUrl();
  const loc = (routing.locales.includes(locale as Locale) ? locale : routing.defaultLocale) as string;
  const canonical = `${base}/${loc}${pathSuffix}`;
  const languages: Record<string, string> = {};
  for (const l of routing.locales) {
    languages[l] = `${base}/${l}${pathSuffix}`;
  }
  languages["x-default"] = `${base}/${routing.defaultLocale}${pathSuffix}`;

  return {
    title: opts.title,
    description: opts.description,
    alternates: { canonical, languages },
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
