import { unstable_cache } from "next/cache";
import { createServerSupabase } from "@/lib/supabase-server";
import { DATA_CACHE_REVALIDATE } from "@/lib/server-data-cache";

export type PublicAdvertisement = {
  id: string;
  title: string;
  image_url: string;
  link_url: string | null;
  placement?: string | null;
  is_active: boolean;
  locale?: string | null;
  sort_order?: number | null;
  created_at?: string;
  overlay_title?: string | null;
  overlay_day?: string | null;
  overlay_month_year?: string | null;
};

const AD_COLUMNS =
  "id,title,image_url,link_url,placement,is_active,sort_order,locale,overlay_title,overlay_day,overlay_month_year,created_at";

async function fetchActiveAdvertisements(locale?: string): Promise<PublicAdvertisement[]> {
  const supabase = createServerSupabase();
  let query = supabase
    .from("advertisements")
    .select(AD_COLUMNS)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  const loc = locale && ["tr", "de", "en"].includes(locale) ? locale : undefined;
  if (loc === "tr") {
    query = query.or("locale.eq.tr,locale.is.null");
  } else if (loc) {
    query = query.or(`locale.eq.${loc},locale.eq.tr,locale.is.null`);
  }

  const { data, error } = await query;
  if (error || !data) return [];
  return data as PublicAdvertisement[];
}

export async function getActiveAdvertisements(locale?: string): Promise<PublicAdvertisement[]> {
  const key = locale && ["tr", "de", "en"].includes(locale) ? locale : "all";
  return unstable_cache(() => fetchActiveAdvertisements(locale), ["advertisements-active", key], {
    revalidate: DATA_CACHE_REVALIDATE.advertisements,
    tags: ["advertisements"],
  })();
}
