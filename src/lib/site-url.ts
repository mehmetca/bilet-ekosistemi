/**
 * Kanonik site kökü (SEO: canonical, sitemap, Open Graph, robots).
 * Üretimde mutlaka `NEXT_PUBLIC_SITE_URL=https://eventseat.de` (Search Console ile aynı host) ayarlayın.
 */

/** Eski alan adı; env veya Vercel URL hâlâ burayı gösterse bile kanonik çıktı eventseat.de olur. */
const LEGACY_PUBLIC_HOSTS = new Set(["kurdevents.com", "www.kurdevents.com"]);

const CANONICAL_PUBLIC_ORIGIN = "https://eventseat.de";

function stripTrailingSlash(url: string): string {
  return url.trim().replace(/\/$/, "");
}

/** kurdevents → eventseat.de (sitemap / robots / metadata tutarlılığı). */
function normalizePublicOrigin(url: string): string {
  const s = stripTrailingSlash(url);
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    if (LEGACY_PUBLIC_HOSTS.has(u.hostname.toLowerCase())) return CANONICAL_PUBLIC_ORIGIN;
  } catch {
    /* ignore */
  }
  return s;
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
  if (fromEnv) return normalizePublicOrigin(fromEnv);

  // Üretim: Vercel atadığı production hostname (çoğu zaman özel alan adı). NEXT_PUBLIC_SITE_URL yoksa yedek.
  if (process.env.VERCEL_ENV === "production") {
    const prodHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
    if (prodHost) return normalizePublicOrigin(httpsOriginFromHostOrUrl(prodHost));
  }

  // Önizleme / geliştirme dağıtımı: geçerli deployment URL'si
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  }

  return "http://localhost:3000";
}

/**
 * Tarayıcıda genel “site kökü” (eski davranış): env varsa o origin, yoksa `window.location.origin`.
 * OAuth için tercihen {@link getOAuthRedirectOrigin} kullanın.
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

/** Üretim kanonik: Supabase Redirect URL’leri ile uyum (www). */
const EVENTSEAT_WWW_ORIGIN = "https://www.eventseat.de";

/**
 * Google OAuth `signInWithOAuth({ options: { redirectTo } })` için kök URL.
 * Supabase Dashboard → Authentication → URL Configuration → Redirect URLs içinde
 * **aynı host** (örn. `https://www.eventseat.de/auth/callback`) tanımlı olmalı.
 *
 * Öncelik:
 * 1. `NEXT_PUBLIC_OAUTH_REDIRECT_ORIGIN` — tam origin (örn. `https://www.eventseat.de`)
 * 2. `NEXT_PUBLIC_SITE_URL` — `eventseat.de` (apex) ise OAuth için **www**’ye çevrilir; zaten `www` ise olduğu gibi
 * 3. `window.location.origin` (localhost / önizleme)
 */
export function getOAuthRedirectOrigin(): string {
  if (typeof window === "undefined") return "http://localhost:3000";

  const explicit = process.env.NEXT_PUBLIC_OAUTH_REDIRECT_ORIGIN?.trim();
  if (explicit) {
    try {
      const u = new URL(explicit.startsWith("http") ? explicit : `https://${explicit}`);
      return u.origin;
    } catch {
      /* fall through */
    }
  }

  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromEnv) {
    try {
      const u = new URL(fromEnv.startsWith("http") ? fromEnv : `https://${fromEnv}`);
      const host = u.hostname.toLowerCase();
      if (host === "eventseat.de") {
        return EVENTSEAT_WWW_ORIGIN;
      }
      return u.origin;
    } catch {
      /* fall through */
    }
  }

  return window.location.origin;
}
