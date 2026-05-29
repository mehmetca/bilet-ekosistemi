import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Inter } from "next/font/google";
import "./globals.css";
import DeferredSpeedInsights from "@/components/DeferredSpeedInsights";
import Providers from "@/components/Providers";
import { SimpleAuthProvider } from "@/contexts/SimpleAuthContext";
import { getSiteUrl } from "@/lib/site-url";
import { routing } from "@/i18n/routing";

const inter = Inter({ subsets: ["latin", "latin-ext"], display: "swap" });

/** Next 14.2+: viewport metadata'dan ayrı olmalı; aksi halde RSC/metadata uyarıları ve istikrarsız prefetch görülebilir. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: { default: "KurdEvents", template: "%s | KurdEvents" },
  description: "Theater- und Event-Ticketing",
};

function isSupportedLocale(value: string | null): value is (typeof routing.locales)[number] {
  return !!value && routing.locales.includes(value as (typeof routing.locales)[number]);
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headerStore = await headers();
  const headerLocale =
    headerStore.get("x-next-intl-locale") ||
    headerStore.get("X-NEXT-INTL-LOCALE");
  const htmlLang = isSupportedLocale(headerLocale) ? headerLocale : routing.defaultLocale;
  let supabaseOrigin: string | null = null;
  try {
    const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (raw) supabaseOrigin = new URL(raw).origin;
  } catch {
    /* ignore */
  }

  return (
    <html lang={htmlLang} suppressHydrationWarning translate="no">
      <head>
        <meta name="google" content="notranslate" />
        <meta httpEquiv="content-language" content={htmlLang} />
        {supabaseOrigin ? (
          <>
            <link rel="preconnect" href={supabaseOrigin} crossOrigin="anonymous" />
            <link rel="dns-prefetch" href={supabaseOrigin} />
          </>
        ) : null}
      </head>
      <body className={`${inter.className} notranslate`} translate="no">
        <SimpleAuthProvider>
          <Providers>{children}</Providers>
        </SimpleAuthProvider>
        <DeferredSpeedInsights />
      </body>
    </html>
  );
}
