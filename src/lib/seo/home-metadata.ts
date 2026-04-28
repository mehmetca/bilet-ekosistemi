import type { Metadata } from "next";
import { routing } from "@/i18n/routing";
import { getSiteUrl } from "@/lib/site-url";

const LOCALES = routing.locales;
type AppLocale = (typeof LOCALES)[number];

type HomeSeo = {
  title: string;
  description: string;
  openGraphLocale: string;
};

const HOME_SEO: Record<AppLocale, HomeSeo> = {
  de: {
    title: "KurdEvents – Ticketplattform für Theater & Events",
    description:
      "Online Tickets verkaufen, Sitzplätze verwalten und Events einfacher organisieren.",
    openGraphLocale: "de_DE",
  },
  en: {
    title: "KurdEvents – Ticketing Platform for Theaters & Events",
    description: "Sell tickets online, manage seating, and run events more efficiently.",
    openGraphLocale: "en_US",
  },
  tr: {
    title: "KurdEvents - Tüm etkinlikler için bilet platformu",
    description: "Biletleri online satın, koltuk planını yönetin ve etkinliklerinizi daha kolay organize edin.",
    openGraphLocale: "tr_TR",
  },
  ku: {
    title: "KurdEvents – Platforma Bilêtê ji bo Şano û Bûyeran",
    description: "Bilêtan online bifiroşe, plana cihan birêve bibe û bûyerên xwe bi hêsanî organîze bike.",
    openGraphLocale: "ku_TR",
  },
  ckb: {
    title: "KurdEvents – پلاتفۆرمی بلیت بۆ شانۆ و بۆنەکان",
    description: "بلیت بە ئۆنلاین بفرۆشە، پلانی کورسی بەڕێوەببە و بۆنەکانت بە ئاسانی ڕێکبخە.",
    openGraphLocale: "ckb_IQ",
  },
};

function languageAlternates(base: string, pathSuffix: string) {
  const languages: Record<string, string> = {};
  for (const l of LOCALES) {
    languages[l] = `${base}/${l}${pathSuffix}`;
  }
  languages["x-default"] = `${base}/${routing.defaultLocale}${pathSuffix}`;
  return languages;
}

export function buildHomeMetadata(locale: string): Metadata {
  const base = getSiteUrl();
  const loc = (LOCALES.includes(locale as AppLocale) ? locale : routing.defaultLocale) as AppLocale;
  const { title, description, openGraphLocale } = HOME_SEO[loc];
  const pathSuffix = "";
  const canonical = `${base}/${loc}${pathSuffix}`;

  return {
    title,
    description,
    alternates: {
      canonical,
      languages: languageAlternates(base, pathSuffix),
    },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: "KurdEvents",
      locale: openGraphLocale,
      type: "website",
      alternateLocale: LOCALES.filter((l) => l !== loc),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    robots: { index: true, follow: true },
  };
}
