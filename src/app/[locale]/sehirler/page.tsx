import { createServerSupabase } from "@/lib/supabase-server";
import { sortCitiesByUpcomingEventCount } from "@/lib/city-event-sort";
import Header from "@/components/Header";
import CitiesGrid from "./CitiesGrid";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getCities() {
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
      .select("*, venues(city)")
      .eq("is_active", true)
      .eq("is_approved", true)
      .eq("is_draft", false),
  ]);
  if (citiesRes.error) return [];
  const rawEvents = (eventsRes.data || []) as Record<string, unknown>[];
  const cities = citiesRes.data || [];
  return sortCitiesByUpcomingEventCount(cities, rawEvents);
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("cities");
  return {
    title: `${t("title")} - ${t("metaTitleSuffix")}`,
    description: t("subtitle"),
  };
}

export default async function SehirlerPage() {
  const cities = await getCities();
  const t = await getTranslations("cities");

  return (
    <div className="min-h-screen bg-[#f5f6f8]">
      <Header />
      <div className="site-container py-12">
        <div className="mb-10 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900">{t("title")}</h1>
          <p className="mt-4 text-lg text-slate-600">{t("subtitle")}</p>
        </div>
        <CitiesGrid cities={cities} />
      </div>
    </div>
  );
}
