import { unstable_cache } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { DATA_CACHE_REVALIDATE } from "@/lib/server-data-cache";

export type HomeSliderAd = {
  id: string;
  title: string;
  image_url: string;
  link_url: string | null;
  placement: string;
  is_active: boolean;
  sort_order?: number | null;
  locale?: string | null;
  overlay_title?: string | null;
  overlay_day?: string | null;
  overlay_month_year?: string | null;
};

function filterSliderAds(rows: HomeSliderAd[], placement: string) {
  return rows
    .filter((a) => a.is_active && a.placement === placement && !!a.image_url)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
}

const AD_COLUMNS =
  "id,title,image_url,link_url,placement,is_active,locale,overlay_title,overlay_day,overlay_month_year,created_at";

/** Ana sayfa slider reklamları — ISR önbellekli tek sorgu. */
export async function getHomeSliderAds(
  locale: string,
  placement = "main_slider"
): Promise<HomeSliderAd[]> {
  return unstable_cache(
    () => fetchHomeSliderAds(locale, placement),
    ["home-slider-ads-v3", locale, placement],
    { revalidate: DATA_CACHE_REVALIDATE.advertisements, tags: ["advertisements", "home"] }
  )();
}

async function fetchHomeSliderAds(
  locale: string,
  placement = "main_slider"
): Promise<HomeSliderAd[]> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("advertisements")
      .select(AD_COLUMNS)
      .eq("is_active", true)
      .eq("placement", placement)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error || !data?.length) return [];

    const rows = data as HomeSliderAd[];
    const loc = ["tr", "de", "en"].includes(locale) ? locale : "tr";
    const forLocale = rows.filter(
      (a) => !a.locale || a.locale === loc || a.locale === "tr"
    );
    const localized = filterSliderAds(forLocale.length ? forLocale : rows, placement);
    if (localized.length > 0) return localized;
    return filterSliderAds(rows, placement);
  } catch {
    return [];
  }
}
