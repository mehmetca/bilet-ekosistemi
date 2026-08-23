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

  trailingSlash: true,

  serverExternalPackages: [
    "@sentry/nextjs",
    "@sentry/node",
    "@sentry/opentelemetry",
    "@opentelemetry/api",
    "@opentelemetry/semantic-conventions",
    "@supabase/supabase-js",
    "@supabase/ssr",
    "intl-messageformat",
    "@formatjs/ecma402-abstract",
    "@formatjs/icu-messageformat-parser",
    "@formatjs/fast-memoize",
  ],

  async redirects() {
    return [
      { source: "/turne", destination: "/", permanent: true },
      { source: "/turne/:path*", destination: "/", permanent: true },
      { source: "/:locale(tr|de|en|ku|ckb)/robots-txt", destination: "/robots.txt", permanent: true },
      { source: "/:locale(tr|de|en|ku|ckb)/robots.txt", destination: "/robots.txt", permanent: true },
      { source: "/:locale(tr|de|en|ku|ckb)/sitemap.xml", destination: "/sitemap.xml", permanent: true },
      {
        source: "/:locale(tr|de|en|ku|ckb)/bilgilendirme",
        destination: "/:locale/bilgilendirme/sss",
        permanent: true,
      },
    ];
  },

  async headers() {
    const isDev = process.env.NODE_ENV === "development";

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
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://*.stripe.com https://*.sentry.io https://browser.sentry-cdn.com",
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
          "img-src 'self' data: blob: https:",
          "font-src 'self' data: https://fonts.gstatic.com",
          "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://*.stripe.com https://*.sentry.io https://*.ingest.sentry.io https://translate.googleapis.com",
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

  eslint: { ignoreDuringBuilds: true },

  webpack: (config, { isServer }) => {
    config.resolve = config.resolve || {};
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
    qualities: [70, 75],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "dzncmwjffopednfgjwlo.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "localhost",
        port: "3000",
        pathname: "/uploads/**",
      },
    ],
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60,
  },
};

export default async function config(phase) {
  const configWithIntl = withNextIntl(nextConfig);

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
