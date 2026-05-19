import type { Metadata } from "next";
import ClientHomePage from "./ClientHomePage";
import { createServerSupabase } from "@/lib/supabase-server";
import { buildHomeMetadata } from "@/lib/seo/home-metadata";
import { sortCitiesByUpcomingEventCount } from "@/lib/city-event-sort";
import { getHomeSliderAds } from "@/lib/home-slider-ads";
import HomeHeroBackgrounds from "@/components/home/HomeHeroBackgrounds";
import type { Event } from "@/types/database";

type HomePageProps = {
  params: Promise<{ locale: string }>;
};

export const revalidate = 60;

export async function generateMetadata({ params }: HomePageProps): Promise<Metadata> {
  const { locale } = await params;
  return buildHomeMetadata(locale);
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

async function getHomeData(locale: string) {
  const supabase = createServerSupabase();
  const [eventsRes, heroRes, citiesRes, sliderAds] = await Promise.all([
    supabase
      .from("events")
      .select("*, venues(city)")
      .eq("is_active", true)
      .eq("is_approved", true)
      .eq("is_draft", false)
      .order("created_at", { ascending: false }),
    supabase.from("hero_backgrounds").select("*").eq("is_active", true).order("sort_order", { ascending: true }),
    supabase
      .from("cities")
      .select("id, slug, name_tr, name_de, name_en, image_url, sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    getHomeSliderAds(locale, "main_slider"),
  ]);
  const rawEvents = (eventsRes.data || []) as Array<Record<string, unknown>>;
  const events = rawEvents.map(({ venues: _v, ...ev }) => ev) as unknown as Event[];
  const citiesUnsorted = (citiesRes.data || []) as City[];
  const cities = sortCitiesByUpcomingEventCount(citiesUnsorted, rawEvents);
  return {
    events,
    heroBackgrounds: (heroRes.data || []) as HeroBg[],
    cities,
    sliderAds,
  };
}

export default async function HomePage({ params }: HomePageProps) {
  const { locale } = await params;
  let events: Event[] = [];
  let heroBackgrounds: HeroBg[] = [];
  let cities: City[] = [];
  let sliderAds: Awaited<ReturnType<typeof getHomeSliderAds>> = [];
  try {
    const data = await getHomeData(locale);
    events = data.events;
    heroBackgrounds = data.heroBackgrounds;
    cities = data.cities;
    sliderAds = data.sliderAds;
  } catch (e) {
    console.error("HomePage getHomeData error:", e);
  }

  const lcpHero = heroBackgrounds[0]?.image_url;

  return (
    <>
      {lcpHero ? <link rel="preload" as="image" href={lcpHero} fetchPriority="high" /> : null}
      <ClientHomePage
        initialEvents={events}
        initialHeroBackgrounds={heroBackgrounds}
        initialCities={cities}
        initialSliderAds={sliderAds}
        heroBackground={
          <HomeHeroBackgrounds backgrounds={heroBackgrounds} />
        }
      />
    </>
  );
}
