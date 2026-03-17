import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase-server";
import CityPageClient from "./CityPageClient";
import { getLocalizedCity } from "@/lib/i18n-content";
import { getEventsForCity } from "@/lib/events-server";
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
