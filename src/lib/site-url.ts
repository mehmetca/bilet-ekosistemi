/**
 * Kanonik site kökü (SEO: canonical, sitemap, Open Graph, robots).
 * Üretimde mutlaka `NEXT_PUBLIC_SITE_URL=https://alanadiniz.com` (Search Console ile aynı host) ayarlayın.
 */

function stripTrailingSlash(url: string): string {
  return url.trim().replace(/\/$/, "");
}

/** Vercel env'den gelen host veya tam URL → https kökü */
function httpsOriginFromHostOrUrl(value: string): string {
  const v = value.trim();
  if (!v) return v;
  if (/^https?:\/\//i.test(v)) {
    try {
      const u = new URL(v);
      return `${u.protocol}//${u.host}`;
    } catch {
      return stripTrailingSlash(v);
    }
  }
  return `https://${v.replace(/^\/+/, "")}`;
}

export function getSiteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromEnv) return stripTrailingSlash(fromEnv);

  // Üretim: Vercel atadığı production hostname (çoğu zaman özel alan adı). NEXT_PUBLIC_SITE_URL yoksa yedek.
  if (process.env.VERCEL_ENV === "production") {
    const prodHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
    if (prodHost) return httpsOriginFromHostOrUrl(prodHost);
  }

  // Önizleme / geliştirme dağıtımı: geçerli deployment URL'si
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  }

  return "http://localhost:3000";
}

/**
 * Tarayıcıda OAuth `redirectTo` kökü: `NEXT_PUBLIC_SITE_URL` tanımlıysa onu kullanır (www / apex
 * ile PKCE localStorage uyumsuzluğunu önler). Yoksa `window.location.origin`.
 */
export function getPublicSiteOrigin(): string {
  if (typeof window === "undefined") return "http://localhost:3000";
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromEnv) {
    try {
      const u = new URL(fromEnv.startsWith("http") ? fromEnv : `https://${fromEnv}`);
      return u.origin;
    } catch {
      /* ignore */
    }
  }
  return window.location.origin;
}
