import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["lucide-react"],
  experimental: {
    instrumentationHook: false,
  },
  async redirects() {
    return [
      { source: "/turne", destination: "/", permanent: true },
      { source: "/turne/:path*", destination: "/", permanent: true },
      // Bilgilendirme ana sayfa → SSS (server redirect Sentry ile çakışmasın diye config'de)
      { source: "/tr/bilgilendirme", destination: "/tr/bilgilendirme/sss", permanent: false },
      { source: "/de/bilgilendirme", destination: "/de/bilgilendirme/sss", permanent: false },
      { source: "/en/bilgilendirme", destination: "/en/bilgilendirme/sss", permanent: false },
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
    ];
  },
  // Vercel build'in lint uyarılarından düşmemesi için (lint yerelde npm run lint ile çalıştırılabilir)
  eslint: { ignoreDuringBuilds: true },
  webpack: (config, { dev }) => {
    // Windows'ta .next-dev/cache pack dosyaları zaman zaman ENOENT verip
    // dev server'da unhandledRejection üretüyor; dev cache'i kapatıyoruz.
    if (dev) config.cache = false;
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

export default async function config() {
  const configWithIntl = withNextIntl(nextConfig);
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    const { withSentryConfig } = await import("@sentry/nextjs");
    return withSentryConfig(configWithIntl, {
      org: process.env.SENTRY_ORG || "bilet-ekosistemi",
      project: process.env.SENTRY_PROJECT || "bilet-ekosistemi",
      silent: !process.env.CI,
      reactComponentAnnotation: { enabled: false },
    });
  }
  return configWithIntl;
}
