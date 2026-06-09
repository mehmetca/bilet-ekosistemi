import { unstable_cache } from "next/cache";
import { createServerSupabase } from "@/lib/supabase-server";
import { DATA_CACHE_REVALIDATE } from "@/lib/server-data-cache";
import { sortCitiesByUpcomingEventCount } from "@/lib/city-event-sort";
import { getHomeSliderAds } from "@/lib/home-slider-ads";
import type { Event } from "@/types/database";

const HOME_EVENTS_COLUMNS =
  "id,title,slug,date,time,venue,location,image_url,category,price_from,currency,created_at,is_active,is_approved,is_draft,title_tr,title_de,title_en,title_ku,title_ckb,venue_tr,venue_de,venue_en,show_slug,venues(city)";

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

/** Hero + şehir + slider — ana sayfa LCP için hafif; etkinlik listesi dahil değil. */
async function fetchHomeShellData(locale: string): Promise<HomeShellData> {
  const supabase = createServerSupabase();
  const [heroRes, citiesRes, sliderAds] = await Promise.all([
    supabase
      .from("hero_backgrounds")
      .select(HERO_COLUMNS)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .limit(6),
    supabase
      .from("cities")
      .select("id, slug, name_tr, name_de, name_en, image_url, sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .limit(24),
    getHomeSliderAds(locale, "main_slider"),
  ]);

  return {
    heroBackgrounds: (heroRes.data || []) as HomeShellData["heroBackgrounds"],
    cities: (citiesRes.data || []) as HomeShellData["cities"],
    sliderAds,
  };
}

export async function getHomeShellData(locale: string): Promise<HomeShellData> {
  return unstable_cache(() => fetchHomeShellData(locale), ["home-shell", locale], {
    revalidate: DATA_CACHE_REVALIDATE.home,
    tags: ["home"],
  })();
}

async function fetchHomeEvents(_locale: string): Promise<Event[]> {
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

  if (error || !data) return [];

  const raw = data as Array<Record<string, unknown>>;
  return raw.map(({ venues: _v, ...ev }) => ev) as unknown as Event[];
}

export async function getHomeEvents(locale: string): Promise<Event[]> {
  // Ana sayfa listesi taslak değişimlerine duyarlı; kısa TTL + tag ile anında yenilenebilir.
  return unstable_cache(() => fetchHomeEvents(locale), ["home-events", locale], {
    revalidate: 60,
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
