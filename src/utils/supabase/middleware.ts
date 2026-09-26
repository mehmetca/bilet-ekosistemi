import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { authCookieDomainFromHost } from "@/lib/auth-cookie-domain";

/** Refresh session and write auth cookies onto the given response (redirect or next). */
export async function withSupabaseAuth(request: NextRequest, response: NextResponse) {
  const cookieDomain = authCookieDomainFromHost(request.headers.get("host"));
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      ...(cookieDomain
        ? {
            cookieOptions: {
              domain: cookieDomain,
              path: "/",
              sameSite: "lax" as const,
              secure: process.env.NODE_ENV === "production",
            },
          }
        : {}),
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  try {
    await supabase.auth.getUser();
  } catch {
    // Süresi dolmuş veya geçersiz refresh token — sessizce yut.
    // Tarayıcı çerezleri bir sonraki istekte silinir; kullanıcı yeniden giriş yapar.
  }
  return response;
}

export async function updateSession(request: NextRequest) {
  const supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });
  return withSupabaseAuth(request, supabaseResponse);
}
