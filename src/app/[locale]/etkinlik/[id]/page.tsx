import { notFound } from "next/navigation";
import type { Event, Venue } from "@/types/database";
import EventDetailClient from "./client";
import ShowDetailClient from "./ShowDetailClient";
import type { Metadata } from "next";
import {
  getEventBySlug,
  getEventsByShowSlug,
  getVenue,
  getEventTickets,
  getOrganizerDisplayName,
} from "@/lib/events-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface PageProps {
  params: Promise<{ locale?: string; id: string }>;
}

function getSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const showEvents = await getEventsByShowSlug(id);
  const slugResult = await getEventBySlug(id);
  const event = showEvents[0] || slugResult?.event;
  if (!event) return { title: "Etkinlik Bulunamadı" };

  const title = `${event.title} | Bilet Ekosistemi`;
  const description =
    event.description?.replace(/<[^>]*>/g, "").slice(0, 160) ||
    `${event.title} - ${event.date} ${event.time || ""} ${event.venue || ""}. Bilet alın.`;
  const imageUrl = event.image_url || undefined;
  const url = `${getSiteUrl()}/etkinlik/${showEvents.length >= 2 ? id : (event.slug || event.id)}`;

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
  const { locale = "tr", id } = await params;

  // Biletinial tarzı: show_slug ile gruplanmış tur/gösteri sayfası (1+ etkinlik; tek etkinlikte de sayfa görünsün)
  const showEvents = await getEventsByShowSlug(id);
  if (showEvents.length >= 1) {
    const firstEvent = showEvents[0] as { created_by_user_id?: string; organizer_display_name?: string | null };
    const lookedUp = await getOrganizerDisplayName(firstEvent.created_by_user_id);
    const organizerDisplayName =
      firstEvent.organizer_display_name?.trim() || lookedUp || null;
    return (
      <ShowDetailClient
        events={showEvents}
        showSlug={id}
        organizerDisplayName={organizerDisplayName}
        locale={locale as "tr" | "de" | "en"}
      />
    );
  }

  const slugResult = await getEventBySlug(id);
  if (!slugResult) notFound();
  const { event, isUnapproved } = slugResult;

  const [tickets, venue, lookedUpOrganizer] = await Promise.all([
    getEventTickets(event.id),
    event.venue_id ? getVenue(event.venue_id) : Promise.resolve(null),
    getOrganizerDisplayName((event as { created_by_user_id?: string }).created_by_user_id),
  ]);
  const organizerDisplayName =
    (event as { organizer_display_name?: string | null }).organizer_display_name?.trim() ||
    lookedUpOrganizer ||
    null;

  const structuredData = buildEventStructuredData(event, venue);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <EventDetailClient
        event={event}
        tickets={tickets}
        venue={venue}
        organizerDisplayName={organizerDisplayName}
        locale={locale as "tr" | "de" | "en"}
        isUnapproved={isUnapproved}
      />
    </>
  );
}
