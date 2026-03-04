import { NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as "tr" | "de" | "en")) {
    notFound();
  }
  setRequestLocale(locale);
  // URL'deki locale'e göre mesajları doğrudan yükle (request cache sorunlarını önler)
  const messages = (await import(`../../../messages/${locale}.json`)).default;
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
