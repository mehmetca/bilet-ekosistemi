import path from "path";
import { fileURLToPath } from "url";
import createNextIntlPlugin from "next-intl/plugin";
import { PHASE_PRODUCTION_BUILD } from "next/constants.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // next-intl / use-intl: tek React grafiği (use-intl serverExternal yapılırsa SSR'de useMemo null hatası)
  transpilePackages: ["lucide-react", "next-intl", "use-intl", "konva"],
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
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
    if (process.env.NODE_ENV !== "development") return [];
    // _next ve statik asset'lere dokunma; chunk 500 hatalarını önlemek için sadece sayfa isteklerine header ekle
    return [
      {
        source: "/((?!_next|api|favicon|.*\\.(?:ico|png|jpg|jpeg|gif|svg|woff2?|css|js)$).*)",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate, max-age=0",
          },
        ],
      },
      // public/seatplans — tarayıcı eski SVG’yi tutmasın (Duisburg plan güncellemeleri)
      {
        source: "/seatplans/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate, max-age=0",
          },
        ],
      },
    ];
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
  },
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
