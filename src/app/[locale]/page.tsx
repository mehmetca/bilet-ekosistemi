import ClientHomePage from "./ClientHomePage";
import { createServerSupabase } from "@/lib/supabase-server";
import type { Event, News } from "@/types/database";

async function getHomeData() {
  const supabase = createServerSupabase();
  const [eventsRes, newsRes, heroRes, citiesRes] = await Promise.all([
    supabase.from("events").select("*").eq("is_active", true).order("created_at", { ascending: false }),
    supabase.from("news").select("*").eq("is_published", true).order("published_at", { ascending: false }).limit(5),
    supabase.from("hero_backgrounds").select("*").eq("is_active", true).order("sort_order", { ascending: true }),
    supabase.from("cities").select("id, slug, name_tr, name_de, name_en, image_url").eq("is_active", true).order("sort_order", { ascending: true }),
  ]);
  return {
    events: (eventsRes.data || []) as Event[],
    news: (newsRes.data || []) as News[],
    heroBackgrounds: heroRes.data || [],
    cities: citiesRes.data || [],
  };
}

export default async function HomePage() {
  const { events, news, heroBackgrounds, cities } = await getHomeData();
  return (
    <ClientHomePage
      initialEvents={events}
      initialNews={news}
      initialHeroBackgrounds={heroBackgrounds}
      initialCities={cities}
    />
  );
}
