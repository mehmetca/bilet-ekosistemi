import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase-server";
import type { Event, Ticket, Venue } from "@/types/database";
import EventDetailClient from "@/app/etkinlik/[id]/client";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface PageProps {
  params: {
    id: string;
  };
}

// Domain yoksa: Vercel'de VERCEL_URL, localde localhost kullanılır
function getSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

async function getVenue(venueId: string | null | undefined): Promise<Venue | null> {
  if (!venueId) return null;
  try {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase.from("venues").select("*").eq("id", venueId).single();
    if (error || !data) return null;
    return {
      id: data.id,
      name: data.name,
      address: data.address || null,
      city: data.city || null,
      capacity: data.capacity != null ? Number(data.capacity) : null,
      seating_layout_description: data.seating_layout_description || null,
      seating_layout_image_url: data.seating_layout_image_url || null,
      image_url_1: data.image_url_1 || null,
      image_url_2: data.image_url_2 || null,
      entrance_info: data.entrance_info || null,
      transport_info: data.transport_info || null,
      map_embed_url: data.map_embed_url || null,
      rules: data.rules || null,
      faq: Array.isArray(data.faq)
        ? (data.faq as Array<{ soru: string; cevap: string }>).filter((x) => x?.soru && x?.cevap)
        : [],
    };
  } catch {
    return null;
  }
}

const TICKET_DISPLAY_ORDER = [
  "Standart Bilet",
  "VIP Bilet",
  "Kategori 1",
  "Kategori 2",
  "Kategori 3",
  "Kategori 4",
  "Kategori 5",
  "Kategori 6",
  "Kategori 7",
  "Kategori 8",
  "Kategori 9",
  "Kategori 10",
] as const;

function getTicketSortRank(name?: string): number {
  const idx = TICKET_DISPLAY_ORDER.findIndex((item) => item === (name || "").trim());
  return idx === -1 ? 999 : idx;
}

async function getEventBySlug(slugOrId: string): Promise<Event | null> {
  try {
    const supabase = await createServerSupabase();

    // Önce slug ile dene
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .eq("slug", slugOrId)
      .single();

    // Eğer slug ile bulunamazsa, ID ile dene (fallback)
    if (error && !data) {
      const { data: idData, error: idError } = await supabase
        .from("events")
        .select("*")
        .eq("id", slugOrId)
        .single();

      if (idError) {
        console.error("Both slug and ID failed:", { slugError: error, idError });
        return null;
      }

      return idData as Event;
    }

    if (error) {
      console.error("Event fetch error:", error);
      return null;
    }

    return data as Event;
  } catch (error) {
    console.error("Fetch event error:", error);
    return null;
  }
}

async function getEventTickets(eventId: string): Promise<Ticket[]> {
  try {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from("tickets")
      .select("*")
      .eq("event_id", eventId)
      .gt("available", 0);

    if (error) return [];
    return ((data || []) as Ticket[]).sort((a, b) => {
      const rankDiff = getTicketSortRank(a.name) - getTicketSortRank(b.name);
      if (rankDiff !== 0) return rankDiff;
      return (a.name || "").localeCompare(b.name || "", "tr");
    });
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const event = await getEventBySlug(params.id);
  if (!event) return { title: "Etkinlik Bulunamadı" };

  const title = `${event.title} | Bilet Ekosistemi`;
  const description =
    event.description?.replace(/<[^>]*>/g, "").slice(0, 160) ||
    `${event.title} - ${event.date} ${event.time || ""} ${event.venue || ""}. Bilet alın.`;
  const imageUrl = event.image_url || undefined;
  const url = `${getSiteUrl()}/etkinlik/${event.slug || event.id}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      siteName: "Bilet Ekosistemi",
      locale: "tr_TR",
      type: "website",
      images: imageUrl ? [{ url: imageUrl, width: 1200, height: 630, alt: event.title }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: imageUrl ? [imageUrl] : undefined,
    },
    alternates: { canonical: url },
  };
}

function buildEventStructuredData(event: Event, venue: Venue | null) {
  const eventDate = new Date(`${event.date} ${event.time || "20:00"}`);
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    description: event.description?.replace(/<[^>]*>/g, "").slice(0, 500) || event.title,
    startDate: eventDate.toISOString(),
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: event.venue || venue?.name || "Mekan",
      address: venue?.address
        ? {
            "@type": "PostalAddress",
            streetAddress: venue.address,
            addressLocality: venue.city || undefined,
          }
        : undefined,
    },
    image: event.image_url,
    offers: {
      "@type": "Offer",
      url: `${getSiteUrl()}/etkinlik/${event.slug || event.id}`,
      price: event.price_from || 0,
      priceCurrency: "EUR",
      availability: "https://schema.org/InStock",
    },
  };
}

export default async function EventDetailPage({ params }: PageProps) {
  const event = await getEventBySlug(params.id);
  const tickets = event ? await getEventTickets(event.id) : [];
  const venue = event?.venue_id ? await getVenue(event.venue_id) : null;

  if (!event) {
    notFound();
  }

  const structuredData = buildEventStructuredData(event, venue);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <EventDetailClient event={event} tickets={tickets} venue={venue} />
    </>
  );
}
