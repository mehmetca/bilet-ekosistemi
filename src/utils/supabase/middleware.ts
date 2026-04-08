import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

/** Refresh session and write auth cookies onto the given response (redirect or next). */
export async function withSupabaseAuth(request: NextRequest, response: NextResponse) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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

  await supabase.auth.getUser();
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
