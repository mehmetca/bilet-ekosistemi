import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SimpleAuthProvider } from "@/contexts/SimpleAuthContext";
import Script from "next/script";
import Footer from "@/components/Footer";
import { headers } from "next/headers";
import { NextIntlClientProvider } from "next-intl";

const inter = Inter({ subsets: ["latin"] });
const LOCALES = ["tr", "de", "en"] as const;

export const metadata: Metadata = {
  title: "Bilet Ekosistemi",
  description: "Etkinlik biletleri ve daha fazlası",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = await headers();
  const locale = (headersList.get("x-next-intl-locale") || "tr") as string;
  const validLocale = LOCALES.includes(locale as (typeof LOCALES)[number]) ? locale : "tr";
  const messages = (await import(`../../messages/${validLocale}.json`)).default;
  return (
    <html lang={validLocale}>
      <head>
        <Script
          id="sw-cache-hard-reset"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                try {
                  if ('serviceWorker' in navigator) {
                    navigator.serviceWorker.getRegistrations().then(function (regs) {
                      return Promise.all(regs.map(function (r) { return r.unregister(); }));
                    }).catch(function () {});
                  }
                  if ('caches' in window) {
                    caches.keys().then(function (keys) {
                      return Promise.all(keys.map(function (k) { return caches.delete(k); }));
                    }).catch(function () {});
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className={inter.className}>
        <NextIntlClientProvider locale={validLocale} messages={messages}>
          <SimpleAuthProvider>
            {children}
            <Footer />
          </SimpleAuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
