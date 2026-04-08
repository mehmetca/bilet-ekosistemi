import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export const dynamic = "force-dynamic";

/**
 * PKCE code exchange on the server reads the verifier from the Cookie header
 * (set before redirect to Google). Client-only exchange can fail with hydration /
 * storage timing; this matches Supabase's Next.js OAuth guide (app/auth/callback/route.ts).
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  let next = url.searchParams.get("next") ?? "/";
  if (!next.startsWith("/")) next = "/";

  const cookieStore = cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );

  if (!code) {
    return NextResponse.redirect(new URL("/giris", url.origin));
  }

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const login = new URL("/giris", url.origin);
    login.searchParams.set("error", "oauth");
    return NextResponse.redirect(login);
  }

  const userId = data.user?.id ?? "";
  let finalPath = next;
  if (userId) {
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();

    const role = roleData?.role as string | undefined;
    const hasManagementRole = role === "admin" || role === "controller" || role === "organizer";
    if (hasManagementRole && next === "/") {
      finalPath = "/yonetim";
    }
  }

  const forwardedHost = request.headers.get("x-forwarded-host");
  const isLocal = process.env.NODE_ENV === "development";

  let redirectUrl: URL;
  if (isLocal) {
    redirectUrl = new URL(finalPath, url.origin);
  } else if (forwardedHost) {
    redirectUrl = new URL(`https://${forwardedHost}${finalPath}`);
  } else {
    redirectUrl = new URL(finalPath, url.origin);
  }

  return NextResponse.redirect(redirectUrl);
}
