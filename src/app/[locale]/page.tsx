import type { Metadata } from "next";
import ClientHomePage from "./ClientHomePage";
import { createServerSupabase } from "@/lib/supabase-server";
import { buildHomeMetadata } from "@/lib/seo/home-metadata";
import { sortCitiesByUpcomingEventCount } from "@/lib/city-event-sort";
import type { Event, News } from "@/types/database";

type HomePageProps = {
  params: { locale: string };
};

export async function generateMetadata({ params }: HomePageProps): Promise<Metadata> {
  return buildHomeMetadata(params.locale);
}

type HeroBg = { id: string; title: string; image_url: string; is_active: boolean; sort_order: number; transition_duration: number };
type City = {
  id: string;
  slug: string;
  name_tr?: string | null;
  name_de?: string | null;
  name_en?: string | null;
  image_url?: string | null;
  sort_order?: number | null;
};

async function getHomeData() {
  const supabase = createServerSupabase();
  const [eventsRes, newsRes, heroRes, citiesRes] = await Promise.all([
    supabase
      .from("events")
      .select("*, venues(city)")
      .eq("is_active", true)
      .eq("is_approved", true)
      .eq("is_draft", false)
      .order("created_at", { ascending: false }),
    supabase.from("news").select("*").eq("is_published", true).order("published_at", { ascending: false }).limit(5),
    supabase.from("hero_backgrounds").select("*").eq("is_active", true).order("sort_order", { ascending: true }),
    supabase
      .from("cities")
      .select("id, slug, name_tr, name_de, name_en, image_url, sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
  ]);
  const rawEvents = (eventsRes.data || []) as Array<Record<string, unknown>>;
  const events = rawEvents.map(({ venues: _v, ...ev }) => ev) as unknown as Event[];
  const citiesUnsorted = (citiesRes.data || []) as City[];
  const cities = sortCitiesByUpcomingEventCount(citiesUnsorted, rawEvents);
  return {
    events,
    news: (newsRes.data || []) as News[],
    heroBackgrounds: (heroRes.data || []) as HeroBg[],
    cities,
  };
}

export default async function HomePage() {
  let events: Event[] = [];
  let news: News[] = [];
  let heroBackgrounds: HeroBg[] = [];
  let cities: City[] = [];
  try {
    const data = await getHomeData();
    events = data.events;
    news = data.news;
    heroBackgrounds = data.heroBackgrounds;
    cities = data.cities;
  } catch (e) {
    console.error("HomePage getHomeData error:", e);
  }
  return (
    <ClientHomePage
      initialEvents={events}
      initialNews={news}
      initialHeroBackgrounds={heroBackgrounds}
      initialCities={cities}
    />
  );
}
