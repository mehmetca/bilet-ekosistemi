import { createServerClient, createBrowserClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { type CookieOptions } from "@supabase/ssr";

// Server-side client (Server Components, Server Actions, Route Handlers)
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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

// Client-side client (Browser Components)
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        flowType: "pkce",
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true,
      },
      cookies: {
        get(name: string) {
          if (typeof document === "undefined") return null;
          const value = document.cookie
            .split("; ")
            .find((row) => row.startsWith(`${name}=`))
            ?.split("=")[1];
          return value ? decodeURIComponent(value) : null;
        },
        set(name: string, value: string, options: { path?: string; maxAge?: number; domain?: string; secure?: boolean; sameSite?: string }) {
          if (typeof document === "undefined") return;
          let cookieString = `${name}=${encodeURIComponent(value)}`;
          if (options.path) cookieString += `; path=${options.path}`;
          if (options.maxAge) cookieString += `; max-age=${options.maxAge}`;
          if (options.domain) cookieString += `; domain=${options.domain}`;
          if (options.secure) cookieString += `; secure`;
          if (options.sameSite) cookieString += `; samesite=${options.sameSite}`;
          document.cookie = cookieString;
        },
        remove(name: string, options: { path?: string; domain?: string }) {
          if (typeof document === "undefined") return;
          let cookieString = `${name}=; max-age=0`;
          if (options.path) cookieString += `; path=${options.path}`;
          if (options.domain) cookieString += `; domain=${options.domain}`;
          document.cookie = cookieString;
        },
      },
    }
  );
}
