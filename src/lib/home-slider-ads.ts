import { createServerSupabase } from "@/lib/supabase-server";

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

async function fetchAdsForLocale(locale?: string) {
  const supabase = createServerSupabase();
  let query = supabase.from("advertisements").select("*").order("created_at", { ascending: false });

  if (locale && ["tr", "de", "en"].includes(locale)) {
    if (locale === "tr") {
      query = query.or("locale.eq.tr,locale.is.null");
    } else {
      query = query.or(`locale.eq.${locale},locale.eq.tr,locale.is.null`);
    }
  }

  const { data, error } = await query;
  if (error) return [];
  return (data || []) as HomeSliderAd[];
}

/** Ana sayfa slider reklamları — istemci /api/advertisements çağrısını önler. */
export async function getHomeSliderAds(
  locale: string,
  placement = "main_slider"
): Promise<HomeSliderAd[]> {
  try {
    const localized = filterSliderAds(await fetchAdsForLocale(locale), placement);
    if (localized.length > 0 || locale === "tr") return localized;

    const fallback = filterSliderAds(await fetchAdsForLocale("tr"), placement);
    if (fallback.length > 0) return fallback;

    return filterSliderAds(await fetchAdsForLocale(), placement);
  } catch {
    return [];
  }
}
