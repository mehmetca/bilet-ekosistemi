import type { Metadata } from "next";
import { routing } from "@/i18n/routing";
import type { Locale } from "@/lib/i18n-content";
import { buildLocalePathMetadata } from "@/lib/seo/locale-path-metadata";
import LoginPage from "../../giris/page";

const LOGIN_SEO: Record<Locale, { title: string; description: string }> = {
  tr: {
    title: "Giriş Yap / Üye Ol | KurdEvents",
    description: "KurdEvents hesabınıza giriş yapın veya yeni hesap oluşturun.",
  },
  de: {
    title: "Anmelden / Registrieren | KurdEvents",
    description: "Melden Sie sich bei KurdEvents an oder erstellen Sie ein neues Konto.",
  },
  en: {
    title: "Log In / Sign Up | KurdEvents",
    description: "Log in to your KurdEvents account or create a new account.",
  },
  ku: {
    title: "Têkeve / Tomar bibe | KurdEvents",
    description: "Têkeve hesabê xwe yê KurdEvents an hesabek nû çêbike.",
  },
  ckb: {
    title: "چوونەژوورەوە / تۆماربوون | KurdEvents",
    description: "بچۆ ژوورەوە بۆ هەژماری KurdEvents یان هەژمارێکی نوێ دروست بکە.",
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale?: string }>;
}): Promise<Metadata> {
  const { locale: locParam } = await params;
  const locale = locParam && routing.locales.includes(locParam as Locale)
    ? (locParam as Locale)
    : routing.defaultLocale;
  return buildLocalePathMetadata(locale, "/giris", LOGIN_SEO[locale]);
}

export default function LocaleGirisPage() {
  return <LoginPage />;
}
