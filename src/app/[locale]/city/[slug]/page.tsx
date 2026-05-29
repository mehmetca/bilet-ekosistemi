import { notFound } from "next/navigation";
import { cache } from "react";
import { createServerSupabase } from "@/lib/supabase-server";
import CityPageClient from "./CityPageClient";
import { getLocalizedCity } from "@/lib/i18n-content";
import { getEventsForCity } from "@/lib/events-server";
import type { Metadata } from "next";
import { routing } from "@/i18n/routing";
import type { Locale } from "@/lib/i18n-content";
import { buildLocalePathMetadata } from "@/lib/seo/locale-path-metadata";

export const revalidate = 300;

interface PageProps {
  params: Promise<{ locale?: string; slug: string }>;
}

const getCity = cache(async function getCity(slug: string) {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("cities")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();
  if (error || !data) return null;
  return data;
});

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolved = await params;
  const slug = resolved?.slug || "";
  const locale = resolved?.locale && routing.locales.includes(resolved.locale as Locale)
    ? (resolved.locale as Locale)
    : routing.defaultLocale;
  const city = await getCity(slug);
  const pathSuffix = `/city/${slug}`;
  if (!city) {
    return buildLocalePathMetadata(locale, pathSuffix, {
      title: "City | KurdEvents",
      description: "KurdEvents city event listings.",
    });
  }
  const localized = getLocalizedCity(city as Record<string, unknown>, locale);
  const name = localized.name || String(city.slug || slug);
  const cityDescriptions: Record<Locale, string> = {
    tr: `${name} şehrindeki etkinlikleri ve biletleri KurdEvents'te keşfedin.`,
    de: `Entdecken Sie Veranstaltungen und Tickets in ${name} auf KurdEvents.`,
    en: `Discover events and tickets in ${name} on KurdEvents.`,
    ku: `Bûyer û bilêtên li ${name} li KurdEvents bibîne.`,
    ckb: `بۆنە و بلیتەکانی ${name} لە KurdEvents ببینە.`,
  };
  return buildLocalePathMetadata(locale, pathSuffix, {
    title: `${name} | KurdEvents`,
    description: localized.description?.replace(/<[^>]*>/g, "").slice(0, 160).trim() || cityDescriptions[locale],
  });
}

export default async function CityPage({ params }: PageProps) {
  const resolved = await params;
  const slug = resolved?.slug || "";
  const city = await getCity(slug);
  if (!city) notFound();

  const events = await getEventsForCity(slug, city);

  return (
    <CityPageClient
      city={city as Record<string, unknown>}
      initialEvents={events}
    />
  );
}
