import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import Footer from "@/components/Footer";

/**
 * Çeviri bağlamı kök `app/layout.tsx` içindeki tek `NextIntlClientProvider` ile verilir
 * (çift sarmalayıcı RSC’de "Element type is invalid: undefined" ve dev’de chunk 404/beyaz sayfaya yol açıyordu).
 */
export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }> | { locale: string };
}) {
  const resolved = "then" in params ? await params : params;
  const locale = resolved?.locale || routing.defaultLocale;
  if (!routing.locales.includes(locale as "tr" | "de" | "en")) {
    notFound();
  }
  setRequestLocale(locale);
  return (
    <>
      {children}
      <Footer />
    </>
  );
}
