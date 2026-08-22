import path from "path";
import { fileURLToPath } from "url";
import createNextIntlPlugin from "next-intl/plugin";
import { PHASE_PRODUCTION_BUILD } from "next/constants.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["lucide-react", "next-intl", "use-intl", "konva"],
  experimental: {
    optimizePackageImports: ["lucide-react"],
    staleTimes: {
      static: 180,
      dynamic: 3600,
    },
  },
};

export default nextConfig;
  
  // Cloudflare Pages için ayarlar (geçiş hazırlığı)
  // Bunları Vercel deployment'de sorun yaratmaz
  trailingSlash: true,
  // Sentry / OpenTelemetry webpack vendor-chunks (örn. @opentelemetry.js) Windows dev'de
  // eksik dosya → MODULE_NOT_FOUND. Sunucuda paketleri bundle dışı bırakır.
  serverExternalPackages: [
    "@sentry/nextjs",
    "@sentry/node",
    "@sentry/opentelemetry",
    "@opentelemetry/api",
    "@opentelemetry/semantic-conventions",
    // Windows dev: eksik ./vendor-chunks/@supabase.js hatasını önlemek için sunucu bundle'dan çıkar
    "@supabase/supabase-js",
    "@supabase/ssr",
    // use-intl burada external yapma — IntlProvider SSR'de "useMemo of null" + vendor-chunk sorunları
    // Windows dev: eksik ./vendor-chunks/@formatjs.js — sadece formatjs ailesi (next-intl'i external yapma)
    "intl-messageformat",
    "@formatjs/ecma402-abstract",
    "@formatjs/icu-messageformat-parser",
    "@formatjs/fast-memoize",
  ],
  async redirects() {
    return [
      { source: "/turne", destination: "/", permanent: true },
      { source: "/turne/:path*", destination: "/", permanent: true },
      // Search Console / kullanıcı typo toleransı: localized robots/sitemap isteklerini köke topla
      { source: "/:locale(tr|de|en|ku|ckb)/robots-txt", destination: "/robots.txt", permanent: true },
      { source: "/:locale(tr|de|en|ku|ckb)/robots.txt", destination: "/robots.txt", permanent: true },
      { source: "/:locale(tr|de|en|ku|ckb)/sitemap.xml", destination: "/sitemap.xml", permanent: true },
      // Bilgilendirme kökü → SSS (kalıcı; tek kanonik cluster için)
      {
        source: "/:locale(tr|de|en|ku|ckb)/bilgilendirme",
        destination: "/:locale/bilgilendirme/sss",
        permanent: true,
      },
    ];
  },
  async headers() {
    const isDev = process.env.NODE_ENV === "development";

    /** Tüm ortamlarda (HTML fetch araçları header görmese de tarayıcıya gider). */
    const securityHeaders = [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        value: "camera=(self), microphone=(), geolocation=(), payment=(self)",
      },
      { key: "X-DNS-Prefetch-Control", value: "on" },
      {
        key: "Content-Security-Policy",
        value: [
          "default-src 'self'",
          "base-uri 'self'",
          "object-src 'none'",
          "frame-ancestors 'none'",
          // Next.js + Stripe Checkout Embedded; 'unsafe-inline'/'unsafe-eval' App Router için gerekli
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://*.stripe.com https://va.vercel-scripts.com https://*.sentry.io https://browser.sentry-cdn.com",
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
          "img-src 'self' data: blob: https:",
          "font-src 'self' data: https://fonts.gstatic.com",
          "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://*.stripe.com https://*.sentry.io https://*.ingest.sentry.io https://vitals.vercel-insights.com https://*.vercel-insights.com https://translate.googleapis.com",
          "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://*.stripe.com https://www.youtube.com https://www.youtube-nocookie.com https://youtube.com",
          "media-src 'self' https: blob:",
          "form-action 'self' https://hooks.stripe.com",
          "upgrade-insecure-requests",
        ].join("; "),
      },
    ];

    if (!isDev) {
      securityHeaders.push({
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      });
    }

    const rules = [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];

    if (isDev) {
      // _next ve statik asset'lere dokunma; chunk 500 hatalarını önlemek için sadece sayfa isteklerine header ekle
      rules.push(
        {
          source: "/((?!_next|api|favicon|.*\\.(?:ico|png|jpg|jpeg|gif|svg|woff2?|css|js)$).*)",
          headers: [
            {
              key: "Cache-Control",
              value: "no-store, no-cache, must-revalidate, max-age=0",
            },
          ],
        },
        {
          source: "/seatplans/:path*",
          headers: [
            {
              key: "Cache-Control",
              value: "no-store, no-cache, must-revalidate, max-age=0",
            },
          ],
        }
      );
    } else {
      // Production'da agresif caching
      rules.push(
        {
          source: "/api/events",
          headers: [
            {
              key: "Cache-Control",
              value: "public, s-maxage=60, stale-while-revalidate=30",
            },
          ],
        },
        {
          source: "/api/(.*)",
          headers: [
            {
              key: "Cache-Control",
              value: "public, s-maxage=30, stale-while-revalidate=15",
            },
          ],
        }
      );
    }

    return rules;
  },
  // Vercel build'in lint uyarılarından düşmemesi için (lint yerelde npm run lint ile çalıştırılabilir)
  eslint: { ignoreDuringBuilds: true },
  webpack: (config, { isServer }) => {
    config.resolve = config.resolve || {};
    // React alias kullanma: Next 15 client `react.use()` (React 19) ile React 18 çakışır → hydration kırılır.
    // Webpack dev cache stays on (avoids HMR ./9085.js missing on Windows). npm run dev:fresh = clean + webpack.
    // react-konva / Konva: optional Node `canvas` modülü — Next derlemesinde yok say.
    config.resolve.fallback = {
      ...config.resolve.fallback,
      canvas: false,
    };
    if (isServer) {
      config.externals = [...(config.externals || []), { canvas: "commonjs canvas" }];
    }
    return config;
  },
  images: {
    // Next 16+: Image quality prop must be listed here (hero uses 70; 75 is Next default)
    qualities: [70, 75],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'dzncmwjffopednfgjwlo.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'localhost',
        port: '3000',
        pathname: '/uploads/**',
      },
    ],
    // Cache optimization
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60,
  },
  // Cache optimization
  swcMinify: true,
  compress: true,
};

export default async function config(phase) {
  const configWithIntl = withNextIntl(nextConfig);
  // NODE_ENV bazen shell'de production kalır; `next dev` yine de Sentry webpack'i tetikleyebiliyordu.
  // Sadece `next build` fazında withSentryConfig kullan (Vercel üretim derlemesi dahil).
  const sentryWebpackEnabled =
    Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN) &&
    phase === PHASE_PRODUCTION_BUILD;
  if (sentryWebpackEnabled) {
    const { withSentryConfig } = await import("@sentry/nextjs");
    return withSentryConfig(configWithIntl, {
      org: process.env.SENTRY_ORG || "bilet-ekosistemi",
      project: process.env.SENTRY_PROJECT || "bilet-ekosistemi",
      silent: !process.env.CI,
    });
  }
  return configWithIntl;
}
