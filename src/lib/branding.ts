import { unstable_cache } from "next/cache";
import { createServerSupabase } from "@/lib/supabase-server";
import { DATA_CACHE_REVALIDATE } from "@/lib/server-data-cache";

export const BRANDING_SETTINGS_KEY = "branding_logos";

export type Branding = {
  logoHeader: string;
  logoFooter: string;
  favicon: string;
};

export const DEFAULT_BRANDING: Branding = {
  logoHeader: "/images/kurdevent-logo.png",
  logoFooter: "/images/kurdevent-logo-light.png",
  favicon: "/favicon.ico",
};

/** Yalnız site içi yol veya http(s) kabul edilir; javascript:/data: gibi değerler düşer. */
function safeUrl(value: unknown): string {
  if (typeof value !== "string") return "";
  const raw = value.trim();
  return raw.startsWith("/") || /^https:\/\//i.test(raw) ? raw : "";
}

export function normalizeBranding(raw: unknown): Branding {
  const input = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    logoHeader: safeUrl(input.logoHeader) || DEFAULT_BRANDING.logoHeader,
    logoFooter: safeUrl(input.logoFooter) || DEFAULT_BRANDING.logoFooter,
    favicon: safeUrl(input.favicon) || DEFAULT_BRANDING.favicon,
  };
}

async function fetchBranding(): Promise<Branding> {
  const supabase = createServerSupabase();
  const { data } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", BRANDING_SETTINGS_KEY)
    .maybeSingle();
  return normalizeBranding(data?.value);
}

export const getBranding = unstable_cache(fetchBranding, ["site-branding"], {
  revalidate: DATA_CACHE_REVALIDATE.home,
  tags: ["branding"],
});
