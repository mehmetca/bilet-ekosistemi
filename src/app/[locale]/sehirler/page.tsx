import { createServerSupabase } from "@/lib/supabase-server";
import { sortCitiesByUpcomingEventCount } from "@/lib/city-event-sort";
import Header from "@/components/Header";
import CitiesGrid from "./CitiesGrid";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import type { Locale } from "@/lib/i18n-content";
import { buildLocalePathMetadata } from "@/lib/seo/locale-path-metadata";

export const revalidate = 1800;

function todayIsoDate(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale?: string }>;
}): Promise<Metadata> {
  const { locale: locParam } = await params;
  const locale = locParam && routing.locales.includes(locParam as Locale)
    ? (locParam as Locale)
    : routing.defaultLocale;
  const t = await getTranslations({ locale, namespace: "cities" });
  return buildLocalePathMetadata(locale, "/sehirler", {
    title: `${t("title")} | KurdEvents`,
    description: t("subtitle"),
  });
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
