import createMiddleware from "next-intl/middleware";
import { routing } from "./src/i18n/routing";
import { NextRequest, NextResponse } from "next/server";

const intlMiddleware = createMiddleware(routing);

export default function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // /yonetim ve /giris locale prefix olmadan erişilebilir; sadece header set et, intl redirect yapma
  if (pathname.startsWith("/yonetim") || pathname.startsWith("/giris")) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-next-intl-locale", routing.defaultLocale);
    requestHeaders.set("X-NEXT-INTL-LOCALE", routing.defaultLocale);
    requestHeaders.set("x-pathname", pathname);
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // Diğer path'ler: intl middleware'e pathname ile locale bilgisini header'da ilet
  const match = pathname.match(/^\/(tr|de|en)(?:\/|$)/);
  const locale = match ? match[1] : routing.defaultLocale;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-next-intl-locale", locale);
  requestHeaders.set("X-NEXT-INTL-LOCALE", locale);
  requestHeaders.set("x-pathname", pathname);
  const modifiedRequest = new NextRequest(request.url, { method: request.method, headers: requestHeaders });
  return intlMiddleware(modifiedRequest);
}

export const config = {
  matcher: [
    "/((?!api|_next|_vercel|.*\\..*).*)",
  ],
};
