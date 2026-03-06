import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase-server";
import CityPageClient from "./CityPageClient";
import type { Event } from "@/types/database";
import { getLocalizedCity } from "@/lib/i18n-content";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface PageProps {
  params: Promise<{ locale?: string; slug: string }>;
}

async function getCity(slug: string) {
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

function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/ı/g, "i")
    .replace(/İ/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c");
}

function getMatchTerms(slug: string, city?: { name_tr?: string | null; name_de?: string | null; name_en?: string | null } | null): string[] {
  const slugLower = slug.toLowerCase().trim();
  const parts = slugLower.split(/-+/).filter(Boolean);
  const terms = new Set<string>([slugLower, ...parts]);
  if (city) {
    [city.name_tr, city.name_de, city.name_en].filter(Boolean).forEach((n) => {
      if (n) terms.add(n.toLowerCase().trim());
    });
  }
  return Array.from(terms);
}

function matchesCity(loc: string, vc: string, matchTerms: string[]): boolean {
  const locNorm = normalizeForMatch(loc);
  const vcNorm = normalizeForMatch(vc);
  return matchTerms.some((term) => {
    if (!term) return false;
    const termNorm = normalizeForMatch(term);
    return (
      loc === term || vc === term ||
      locNorm === termNorm || vcNorm === termNorm ||
      locNorm.includes(termNorm) || vcNorm.includes(termNorm)
    );
  });
}

async function getEventsForCity(citySlug: string, city?: { name_tr?: string | null; name_de?: string | null; name_en?: string | null } | null): Promise<Event[]> {
  const supabase = createServerSupabase();
  const matchTerms = getMatchTerms(citySlug, city);

  const { data: eventsData, error } = await supabase
    .from("events")
    .select("*, venues(city)")
    .eq("is_active", true)
    .order("date", { ascending: true })
    .order("time", { ascending: true });

  if (error || !eventsData) return [];

  const filtered = eventsData.filter((e: Record<string, unknown>) => {
    const loc = ((e.location as string) || "").toLowerCase().trim();
    const v = e.venues;
    let venueCity = "";
    if (v != null) {
      if (Array.isArray(v)) venueCity = (v[0] as { city?: string })?.city || "";
      else venueCity = (v as { city?: string }).city || "";
    }
    const vc = venueCity.toLowerCase().trim();
    return matchesCity(loc, vc, matchTerms);
  });

  return filtered.map((e: Record<string, unknown>) => {
    const { venues, ...ev } = e;
    return ev;
  }) as unknown as Event[];
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolved = await params;
  const slug = resolved?.slug || "";
  const city = await getCity(slug);
  if (!city) return { title: "Şehir" };
  const name = getLocalizedCity(city as Record<string, unknown>, "tr").name || city.slug;
  return { title: `${name} - Etkinlikler` };
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
