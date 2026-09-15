import { unstable_cache } from "next/cache";
import { createServerSupabase } from "@/lib/supabase-server";
import { DATA_CACHE_REVALIDATE } from "@/lib/server-data-cache";
import { sortCitiesByUpcomingEventCount } from "@/lib/city-event-sort";
import { getHomeSliderAds } from "@/lib/home-slider-ads";
import type { Event } from "@/types/database";

const HOME_EVENTS_COLUMNS =
  "id,title,slug,date,time,venue,location,city,address,image_url,category,price_from,currency,created_at,is_active,is_approved,is_draft,homepage_featured_order,title_tr,title_de,title_en,title_ku,title_ckb,venue_tr,venue_de,venue_en,show_slug,venues(city)";

const HOME_EVENTS_LIMIT = 72;

const HERO_COLUMNS =
  "id,title,image_url,is_active,sort_order,transition_duration";

function todayIsoDate(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export type HomeShellData = {
  heroBackgrounds: Array<{
    id: string;
    title: string;
    image_url: string;
    is_active: boolean;
    sort_order: number;
    transition_duration: number;
  }>;
  cities: Array<{
    id: string;
    slug: string;
    name_tr?: string | null;
    name_de?: string | null;
    name_en?: string | null;
    image_url?: string | null;
    sort_order?: number | null;
  }>;
  sliderAds: Awaited<ReturnType<typeof getHomeSliderAds>>;
};

/** Şehirler locale'e bağlı değil — tek ortak önbellek; dil başına gereksiz sorgu/bağlantı oluşmasın. */
async function fetchHomeCities(): Promise<HomeShellData["cities"]> {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("cities")
    .select("id, slug, name_tr, name_de, name_en, image_url, sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .limit(24);

  if (error) {
    console.error("fetchHomeCities error:", error.message, error.code);
    // Throw: geçici hatayı "boş şehir listesi" olarak cache'lemeyelim.
    throw new Error(`Home cities query failed: ${error.message}`);
  }

  return (data || []) as HomeShellData["cities"];
}

export async function getHomeCities(): Promise<HomeShellData["cities"]> {
  return unstable_cache(fetchHomeCities, ["home-cities-v2"], {
    revalidate: DATA_CACHE_REVALIDATE.cities,
    tags: ["home", "cities"],
  })();
}

/** Hero + şehir + slider — ana sayfa LCP için hafif; etkinlik listesi dahil değil. */
async function fetchHomeShellData(locale: string): Promise<HomeShellData> {
  const supabase = createServerSupabase();
  const [heroSettled, citiesSettled, sliderSettled] = await Promise.allSettled([
    supabase
      .from("hero_backgrounds")
      .select(HERO_COLUMNS)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .limit(6),
    getHomeCities(),
    getHomeSliderAds(locale, "main_slider"),
  ]);

  const heroRes = heroSettled.status === "fulfilled" ? heroSettled.value : null;
  if (heroRes?.error) {
    console.error("fetchHomeShellData hero error:", heroRes.error.message, heroRes.error.code);
  }

  let cities: HomeShellData["cities"] = [];
  if (citiesSettled.status === "fulfilled") {
    cities = citiesSettled.value;
  } else {
    // Şehir sorgusu geçici olarak düştüyse hero/slider'ı bozmadan boş geç; sonraki istek yeniden dener.
    console.error("fetchHomeShellData cities error:", citiesSettled.reason);
  }

  const sliderAds = sliderSettled.status === "fulfilled" ? sliderSettled.value : [];

  return {
    heroBackgrounds: (heroRes?.data || []) as HomeShellData["heroBackgrounds"],
    cities,
    sliderAds,
  };
}

export async function getHomeShellData(locale: string): Promise<HomeShellData> {
  return unstable_cache(() => fetchHomeShellData(locale), ["home-shell-v3", locale], {
    revalidate: DATA_CACHE_REVALIDATE.home,
    tags: ["home", "cities"],
  })();
}

async function fetchHomeEvents(): Promise<Event[]> {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("events")
    .select(HOME_EVENTS_COLUMNS)
    .eq("is_active", true)
    .eq("is_approved", true)
    .eq("is_draft", false)
    .gte("date", todayIsoDate())
    .order("date", { ascending: true })
    .order("time", { ascending: true })
    .limit(HOME_EVENTS_LIMIT);

  // Hata → [] yapma: locale bazlı cache (özellikle /de) boş listeyi saatlerce tutabiliyor.
  if (error) {
    console.error("fetchHomeEvents error:", error.message, error.code);
    throw new Error(`Home events query failed: ${error.message}`);
  }

  const raw = (data || []) as Array<Record<string, unknown>>;
  return raw.map((row) => {
    const { venues, ...ev } = row;
    return { ...(ev as unknown as Event), venues: venues as Event["venues"] } as unknown as Event;
  }) as Event[];
}

/** Sorgu locale’e bağlı değil — tek önbellek; dil başına boş “zehir” cache oluşmasın. */
export async function getHomeEvents(_locale?: string): Promise<Event[]> {
  return unstable_cache(fetchHomeEvents, ["home-events-v4"], {
    revalidate: DATA_CACHE_REVALIDATE.home,
    tags: ["home", "events"],
  })();
}

export function sortHomeCities(
  cities: HomeShellData["cities"],
  events: Event[]
): HomeShellData["cities"] {
  const rawEvents = events as unknown as Array<Record<string, unknown>>;
  return sortCitiesByUpcomingEventCount(cities, rawEvents);
}

export type HomePageData = HomeShellData & {
  events: Event[];
  cities: HomeShellData["cities"];
};

/** Tek round-trip: shell + etkinlikler paralel (Suspense/streaming LCP’yi geciktirmesin). */
export async function getHomePageData(locale: string): Promise<HomePageData> {
  const [shell, events] = await Promise.all([getHomeShellData(locale), getHomeEvents(locale)]);
  return {
    ...shell,
    events,
    cities: sortHomeCities(shell.cities, events),
  };
}
