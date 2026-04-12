import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { authCookieDomainFromHost } from "@/lib/auth-cookie-domain";

// Server-side client (Server Components, Server Actions, Route Handlers)
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const cookieDomain = authCookieDomainFromHost(headers().get("host"));

  return createServerClient(
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
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // Server component'ta set çağrılamaz, ignore
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch {
            // Server component'ta remove çağrılamaz, ignore
          }
        },
      },
    }
  );
}
