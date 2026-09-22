import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import { SimpleAuthProvider } from "@/contexts/SimpleAuthContext";
import { getSiteUrl } from "@/lib/site-url";
import { buildOgImageUrl } from "@/lib/seo/locale-path-metadata";
import { validateEnv } from "@/lib/env-validation";

const inter = Inter({ subsets: ["latin", "latin-ext"], display: "swap" });

/** Next 14.2+: viewport metadata'dan ayrı olmalı; aksi halde RSC/metadata uyarıları ve istikrarsız prefetch görülebilir. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

const SITE_OG_TITLE = "KurdEvents - Tiyatro ve Etkinlik Biletleri";
const SITE_OG_DESCRIPTION =
  "KurdEvents ile tiyatro, konser ve etkinlik biletlerini güvenle satın. Çoklu dil desteği ve kolay ödeme.";
const SITE_OG_IMAGE = buildOgImageUrl({ title: SITE_OG_TITLE });

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: { default: SITE_OG_TITLE, template: "%s | KurdEvents" },
  description: SITE_OG_DESCRIPTION,
  openGraph: {
    type: "website",
    locale: "tr_TR",
    url: getSiteUrl(),
    siteName: "KurdEvents",
    title: SITE_OG_TITLE,
    description: SITE_OG_DESCRIPTION,
    images: [{ url: SITE_OG_IMAGE, width: 1200, height: 630, alt: SITE_OG_TITLE }],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_OG_TITLE,
    description: SITE_OG_DESCRIPTION,
    images: [SITE_OG_IMAGE],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true
    }
  }
};

// Environment validation at app startup
if (typeof window === 'undefined') {
  try {
    validateEnv();
  } catch (error) {
    console.error('Environment validation failed:', error);
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let supabaseOrigin: string | null = null;
  try {
    const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (raw) supabaseOrigin = new URL(raw).origin;
  } catch {
    /* ignore */
  }

  return (
    <html lang="tr" suppressHydrationWarning translate="no">
      <head>
        <meta name="google" content="notranslate" />
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
        {/* Eski service worker kayıtlarını ve cache'leri temizle (stale fetch engeli) */}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
