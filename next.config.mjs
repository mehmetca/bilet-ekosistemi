import { withSentryConfig } from "@sentry/nextjs";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      { source: "/turne", destination: "/", permanent: true },
      { source: "/turne/:path*", destination: "/", permanent: true },
    ];
  },
  // Vercel build'in lint uyarılarından düşmemesi için (lint yerelde npm run lint ile çalıştırılabilir)
  eslint: { ignoreDuringBuilds: true },
  webpack: (config, { dev }) => {
    // Windows'ta .next-dev/cache pack dosyaları zaman zaman ENOENT verip
    // dev server'da unhandledRejection üretüyor; dev cache'i kapatıyoruz.
    if (dev) {
      config.cache = false;
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

export default withSentryConfig(withNextIntl(nextConfig), {
  org: process.env.SENTRY_ORG || "bilet-ekosistemi",
  project: process.env.SENTRY_PROJECT || "bilet-ekosistemi",
  silent: !process.env.CI,
});
