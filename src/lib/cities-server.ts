import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createServerSupabase } from "@/lib/supabase-server";
import { sortCitiesByUpcomingEventCount } from "@/lib/city-event-sort";
import { DATA_CACHE_REVALIDATE } from "@/lib/server-data-cache";

function todayIsoDate(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

async function fetchCityBySlug(slug: string) {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("cities")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();
  if (error || !data) return null;
  return data;
}

const getCityCrossRequest = unstable_cache(fetchCityBySlug, ["city-by-slug"], {
  revalidate: DATA_CACHE_REVALIDATE.city,
  tags: ["cities"],
});

export const getCity = cache((slug: string) => getCityCrossRequest(slug));

async function fetchCitiesWithEventCounts() {
  const supabase = createServerSupabase();
  const [citiesRes, eventsRes] = await Promise.all([
    supabase
      .from("cities")
      .select("id, slug, name_tr, name_de, name_en, image_url, sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("slug", { ascending: true }),
    supabase
      .from("events")
      .select("id,date,time,location,city,venues(city)")
      .eq("is_active", true)
      .eq("is_approved", true)
      .eq("is_draft", false)
      .gte("date", todayIsoDate())
      .order("date", { ascending: true })
      .limit(500),
  ]);
  if (citiesRes.error) return [];
  const rawEvents = (eventsRes.data || []) as Record<string, unknown>[];
  const cities = citiesRes.data || [];
  return sortCitiesByUpcomingEventCount(cities, rawEvents);
}

export async function getCitiesWithEventCounts() {
  return unstable_cache(fetchCitiesWithEventCounts, ["cities-with-events"], {
    revalidate: DATA_CACHE_REVALIDATE.cities,
    tags: ["cities"],
  })();
}
