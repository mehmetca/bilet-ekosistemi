import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { NextRequest, NextResponse } from "next/server";
import { withSupabaseAuth } from "@/utils/supabase/middleware";

const intlMiddleware = createMiddleware(routing);

/** www ↔ apex: OAuth PKCE doğrulayıcısı origin’e bağlı; kanonik host’a 308 ile hizala. */
function redirectToCanonicalSiteHost(request: NextRequest): NextResponse | null {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) return null;
  let canonical: URL;
  try {
    canonical = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  const reqHost = request.nextUrl.hostname.toLowerCase();
  const canonHost = canonical.hostname.toLowerCase();
  if (!canonHost || reqHost === canonHost) return null;
  if (reqHost.endsWith(".vercel.app") || canonHost.endsWith(".vercel.app")) return null;
  if (reqHost === "localhost" || reqHost === "127.0.0.1") return null;

  const dest = new URL(request.nextUrl.pathname + request.nextUrl.search, canonical.origin);
  return NextResponse.redirect(dest, 308);
}

export async function middleware(request: NextRequest) {
  const canonical = redirectToCanonicalSiteHost(request);
  if (canonical) return canonical;

  const pathname = request.nextUrl.pathname;

  // Eski yönetim URL'leri → slider-yonetimi (reklam engelleyici / kısa ömürlü path uyumu)
  if (pathname === "/yonetim/reklamlar" || pathname.startsWith("/yonetim/reklamlar/")) {
    const u = request.nextUrl.clone();
    u.pathname = pathname.replace(/^\/yonetim\/reklamlar/, "/yonetim/slider-yonetimi");
    return NextResponse.redirect(u, 308);
  }
  if (pathname === "/yonetim/banner-yonetimi" || pathname.startsWith("/yonetim/banner-yonetimi/")) {
    const u = request.nextUrl.clone();
    u.pathname = pathname.replace(/^\/yonetim\/banner-yonetimi/, "/yonetim/slider-yonetimi");
    return NextResponse.redirect(u, 308);
  }

  // OAuth: Site URL köküne veya locale köküne ?code= (ve bazen ?state=) düşerse /auth/callback'e al.
  // Supabase yanıtında yalnızca `code` olabiliyor; `state` şartı kaldırıldı.
  // Sadece locale kök path'lerde tetiklenir (/kontrol?code=, /tr/etkinlik?... ile karışmaz).
  const oauthCode = request.nextUrl.searchParams.get("code");
  const isLocaleRoot =
    pathname === "/" || /^\/(tr|de|en|ku|ckb)\/?$/.test(pathname);
  if (
    oauthCode &&
    isLocaleRoot &&
    !pathname.startsWith("/auth/callback") &&
    !pathname.startsWith("/api")
  ) {
    const fixed = request.nextUrl.clone();
    fixed.pathname = "/auth/callback";
    return NextResponse.redirect(fixed);
  }

  // /de/de, /de/de/, /de/de/sanatci — aynı locale iki kez (dil menüsü / eski link)
  const dupCollapse = pathname.match(/^\/(tr|de|en|ku|ckb)\/(tr|de|en|ku|ckb)(\/.*)?$/);
  if (dupCollapse && dupCollapse[1] === dupCollapse[2]) {
    const suffix = dupCollapse[3] ?? "";
    const url = request.nextUrl.clone();
    url.pathname = `/${dupCollapse[1]}${suffix}`;
    if (url.pathname !== pathname) {
      return NextResponse.redirect(url, 308);
    }
  }

  if (pathname === "/sepet" || pathname === "/sepet/") {
    const url = request.nextUrl.clone();
    url.pathname = `/${routing.defaultLocale}/sepet`;
    return withSupabaseAuth(request, NextResponse.redirect(url));
  }

  if (pathname === "/organizator-basvuru" || pathname === "/organizator-basvuru/") {
    const url = request.nextUrl.clone();
    url.pathname = `/${routing.defaultLocale}/organizator-basvuru`;
    return withSupabaseAuth(request, NextResponse.redirect(url));
  }

  if (pathname === "/bilgilerim" || pathname === "/bilgilerim/") {
    const url = request.nextUrl.clone();
    url.pathname = `/${routing.defaultLocale}/bilgilerim`;
    return withSupabaseAuth(request, NextResponse.redirect(url));
  }

  // OAuth PKCE: do not run getUser() here — it can refresh/clear storage before route.ts exchanges the code.
  if (pathname.startsWith("/auth/callback")) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-next-intl-locale", routing.defaultLocale);
    requestHeaders.set("X-NEXT-INTL-LOCALE", routing.defaultLocale);
    requestHeaders.set("x-pathname", pathname);
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  if (pathname.startsWith("/yonetim") || pathname.startsWith("/giris") || pathname.startsWith("/auth")) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-next-intl-locale", routing.defaultLocale);
    requestHeaders.set("X-NEXT-INTL-LOCALE", routing.defaultLocale);
    requestHeaders.set("x-pathname", pathname);
    const res = NextResponse.next({ request: { headers: requestHeaders } });
    return withSupabaseAuth(request, res);
  }

  const match = pathname.match(/^\/(tr|de|en|ku|ckb)(?:\/|$)/);
  const locale = match ? match[1] : routing.defaultLocale;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-next-intl-locale", locale);
  requestHeaders.set("X-NEXT-INTL-LOCALE", locale);
  requestHeaders.set("x-pathname", pathname);
  const modifiedRequest = new NextRequest(request.url, { method: request.method, headers: requestHeaders });
  const intlResponse = intlMiddleware(modifiedRequest);
  return withSupabaseAuth(request, intlResponse);
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
