import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import { SimpleAuthProvider } from "@/contexts/SimpleAuthContext";
import { getSiteUrl } from "@/lib/site-url";
import { validateEnv } from "@/lib/env-validation";

const inter = Inter({ subsets: ["latin", "latin-ext"], display: "swap" });

/** Next 14.2+: viewport metadata'dan ayrı olmalı; aksi halde RSC/metadata uyarıları ve istikrarsız prefetch görülebilir. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: { default: "KurdEvents - Tiyatro ve Etkinlik Biletleri", template: "%s | KurdEvents" },
  description: "KurdEvents ile tiyatro, konser ve etkinlik biletlerini güvenle satın. Çoklu dil desteği ve kolay ödeme.",
  openGraph: {
    type: "website",
    locale: "tr_TR",
    url: getSiteUrl(),
    siteName: "KurdEvents",
    title: "KurdEvents - Tiyatro ve Etkinlik Biletleri",
    description: "KurdEvents ile tiyatro, konser ve etkinlik biletlerini güvenle satın. Çoklu dil desteği ve kolay ödeme.",
    images: [
      {
        url: "/images/kurdevents-og.png",
        width: 1200,
        height: 630,
        alt: "KurdEvents - Tiyatro ve Etkinlik Biletleri"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "KurdEvents - Tiyatro ve Etkinlik Biletleri",
    description: "KurdEvents ile tiyatro, konser ve etkinlik biletlerini güvenle satın. Çoklu dil desteği ve kolay ödeme.",
    images: ["/images/kurdevents-og.png"]
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

const inter = Inter({ subsets: ["latin", "latin-ext"], display: "swap" });

/** Next 14.2+: viewport metadata'dan ayrı olmalı; aksi halde RSC/metadata uyarıları ve istikrarsız prefetch görülebilir. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: { default: "KurdEvents - Tiyatro ve Etkinlik Biletleri", template: "%s | KurdEvents" },
  description: "KurdEvents ile tiyatro, konser ve etkinlik biletlerini güvenle satın. Çoklu dil desteği ve kolay ödeme.",
  openGraph: {
    type: "website",
    locale: "tr_TR",
    url: getSiteUrl(),
    siteName: "KurdEvents",
    title: "KurdEvents - Tiyatro ve Etkinlik Biletleri",
    description: "KurdEvents ile tiyatro, konser ve etkinlik biletlerini güvenle satın. Çoklu dil desteği ve kolay ödeme.",
    images: [
      {
        url: "/images/kurdevents-og.png",
        width: 1200,
        height: 630,
        alt: "KurdEvents - Tiyatro ve Etkinlik Biletleri"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "KurdEvents - Tiyatro ve Etkinlik Biletleri",
    description: "KurdEvents ile tiyatro, konser ve etkinlik biletlerini güvenle satın. Çoklu dil desteği ve kolay ödeme.",
    images: ["/images/kurdevents-og.png"]
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
