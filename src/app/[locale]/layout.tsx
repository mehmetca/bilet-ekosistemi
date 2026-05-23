import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { routing } from "@/i18n/routing";
import { ClientIntlBridge } from "@/components/ClientIntlBridge";
import Footer from "@/components/Footer";
import { buildCanonicalAlternates } from "@/lib/seo/locale-path-metadata";
import type { Locale } from "@/lib/i18n-content";

/** Alt sayfalarda generateMetadata yoksa bile self-canonical + hreflang (middleware x-pathname). */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const robots = { index: true, follow: true, googleBot: { index: true, follow: true } };
  if (!routing.locales.includes(locale as Locale)) return { robots };
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") || `/${locale}`;
  const m = pathname.match(/^\/(tr|de|en|ku|ckb)(\/.*)?$/);
  const pathSuffix = m?.[2] ?? "";
  return {
    robots,
    alternates: buildCanonicalAlternates(locale, pathSuffix),
  };
}

/**
 * Dil değişimi (client navigasyon) kök layout’taki provider’ı güncellemediği için
 * locale segmentine bağlı mesajlar burada verilir; iç provider üsttekini geçersiz kılar.
 */
export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const resolved = await params;
  const locale = resolved?.locale || routing.defaultLocale;
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }
  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <ClientIntlBridge locale={locale} messages={messages as Record<string, unknown>}>
      {children}
      <Footer />
    </ClientIntlBridge>
  );
}
