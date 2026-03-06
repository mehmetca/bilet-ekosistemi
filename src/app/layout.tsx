import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SimpleAuthProvider } from "@/contexts/SimpleAuthContext";
import CookieConsent from "@/components/CookieConsent";
import Providers from "@/components/Providers";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import { NextIntlClientProvider } from "next-intl";
import { headers } from "next/headers";
import { routing } from "@/i18n/routing";
const inter = Inter({ subsets: ["latin"] });
const LOCALES = ["tr", "de", "en"] as const;

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Bilet Ekosistemi",
  description: "Etkinlik biletleri ve daha fazlası",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let validLocale = "tr" as (typeof LOCALES)[number];
  let messages: Record<string, unknown> = {};
  try {
    const headersList = await headers();
    let locale = (headersList.get("x-next-intl-locale") || headersList.get("X-NEXT-INTL-LOCALE") || routing.defaultLocale) as string;
    const pathname = headersList.get("x-pathname") || "";
    const pathLocale = pathname.match(/^\/(tr|de|en)(?:\/|$)/)?.[1];
    if (pathLocale && LOCALES.includes(pathLocale as (typeof LOCALES)[number])) {
      locale = pathLocale;
    }
    validLocale = LOCALES.includes(locale as (typeof LOCALES)[number]) ? (locale as (typeof LOCALES)[number]) : routing.defaultLocale;
    messages = (await import(`../../messages/${validLocale}.json`)).default;
  } catch (e) {
    console.error("RootLayout locale/messages load error:", e);
    try {
      messages = (await import("../../messages/tr.json")).default;
    } catch {
      messages = {};
    }
  }
  if (Object.keys(messages).length === 0) {
    try {
      messages = (await import("../../messages/tr.json")).default;
    } catch {
      messages = { common: { backToHome: "Ana Sayfaya Dön" }, home: { heroTitle: "Bilet Ekosistemi" } };
    }
  }
  return (
    <html lang={validLocale}>
      <head />
      <body className={inter.className}>
        <NextIntlClientProvider locale={validLocale} messages={messages}>
            <SimpleAuthProvider>
              <Providers>
                {children}
                <CookieConsent />
                <ServiceWorkerRegister />
              </Providers>
            </SimpleAuthProvider>
          </NextIntlClientProvider>
      </body>
    </html>
  );
}
