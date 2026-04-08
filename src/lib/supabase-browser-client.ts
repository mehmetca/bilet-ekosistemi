import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-only Supabase client (PKCE + cookies via @supabase/ssr defaults).
 * Kept separate from supabase-ssr.ts so client components never pull in next/headers.
 */
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
    }
  );
}
