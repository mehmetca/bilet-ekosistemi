import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  const base = getSiteUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/admin/",
          "/yonetim/",
          "/search",
          "/arama",
          "/giris/",
          "/auth/",
          "/kontrol/",
          "/bilgilerim/",
          "/sifre-yenile/",
          "/*/search",
          "/*/arama",
          "/*/giris/",
          "/*/auth/",
          "/*/kontrol/",
          "/*/bilgilerim/",
          "/*/sifre-yenile/",
          "/*/sepet/",
        ],
      },
      {
        userAgent: "Googlebot",
        allow: "/",
        disallow: [
          "/api/",
          "/admin/",
          "/yonetim/",
          "/search",
          "/arama",
          "/*/search",
          "/*/arama",
        ],
      },
      {
        userAgent: "GPTBot",
        disallow: "/",
      },
      {
        userAgent: "ClaudeBot",
        disallow: "/",
      },
      {
        userAgent: "AhrefsBot",
        disallow: "/",
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
