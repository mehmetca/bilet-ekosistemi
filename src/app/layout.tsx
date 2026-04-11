import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SimpleAuthProvider } from "@/contexts/SimpleAuthContext";
import Providers from "@/components/Providers";
import { NextIntlClientProvider } from "next-intl";
import { headers } from "next/headers";
import { routing } from "@/i18n/routing";
import { getSiteUrl } from "@/lib/site-url";
const inter = Inter({ subsets: ["latin"] });
const LOCALES = ["tr", "de", "en"] as const;

export const dynamic = "force-dynamic";

/** Next 14.2+: viewport metadata’dan ayrı olmalı; aksi halde RSC/metadata uyarıları ve istikrarsız prefetch görülebilir. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: { default: "Eventseat", template: "%s | Eventseat" },
  description: "Theater- und Event-Ticketing",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Locale: middleware x-next-intl-locale veya path'ten (/tr/, /de/, /en/). Locale-prefix'li sayfalarda
  // mesajları [locale]/layout.tsx yükler; root'ta sadece locale-prefix olmayan (giris, yonetim) için yükleyelim.
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
    // Locale-prefix'li route'larda mesajları [locale]/layout yükleyeceği için burada yükleme (çift yükleme önlenir)
    if (!pathLocale) {
      messages = (await import(`../../messages/${validLocale}.json`)).default;
    }
  } catch (e) {
    console.error("RootLayout locale/messages load error:", e);
  }
  if (Object.keys(messages).length === 0) {
    try {
      messages = (await import(`../../messages/${validLocale}.json`)).default;
    } catch {
      try {
        messages = (await import("../../messages/tr.json")).default;
      } catch {
        messages = { common: { backToHome: "Ana Sayfaya Dön" }, home: { heroTitle: "EventSeat" } };
      }
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
            </Providers>
          </SimpleAuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
