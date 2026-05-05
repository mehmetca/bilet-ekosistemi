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
import { getSiteUrl } from "@/lib/site-url";
import { routing } from "@/i18n/routing";
import type { Locale } from "@/lib/i18n-content";
import { buildEventJsonLd } from "@/lib/event-jsonld";
import { DateTime } from "luxon";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface PageProps {
  params: Promise<{ locale?: string; id: string }>;
}

function eventPathFromId(
  id: string,
  showEvents: { slug?: string | null; id?: string }[],
  singleEvent: Event | undefined
): string {
  const tail = showEvents.length >= 2 ? id : (singleEvent?.slug || singleEvent?.id || id);
  return `/etkinlik/${tail}`;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id, locale: locParam } = await params;
  const locale = locParam && routing.locales.includes(locParam as Locale) ? locParam : routing.defaultLocale;
  const showEvents = await getEventsByShowSlug(id);
  const slugResult = await getEventBySlug(id);
  const event = showEvents[0] || slugResult?.event;
  if (!event) {
    return {
      title: "Etkinlik Bulunamadı",
      robots: { index: false, follow: true },
    };
  }

  const title = `${event.title} | KurdEvents`;
  const description =
    event.description?.replace(/<[^>]*>/g, "").slice(0, 160) ||
    `${event.title} - ${event.date} ${event.time || ""} ${event.venue || ""}. Bilet alın.`;
  const imageUrl = event.image_url || undefined;
  const base = getSiteUrl();
  const path = eventPathFromId(id, showEvents, event);
  const canonical = `${base}/${locale}${path}`;
  const languages: Record<string, string> = {};
  for (const l of routing.locales) {
    languages[l] = `${base}/${l}${path}`;
  }
  languages["x-default"] = `${base}/${routing.defaultLocale}${path}`;
  const ogLocale = locale === "de" ? "de_DE" : locale === "en" ? "en_US" : "tr_TR";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: "KurdEvents",
      locale: ogLocale,
      type: "website",
      images: imageUrl ? [{ url: imageUrl, width: 1200, height: 630, alt: event.title }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: imageUrl ? [imageUrl] : undefined,
    },
    alternates: { canonical, languages },
  };
}

export default async function EventDetailPage({ params }: PageProps) {
  const { locale = "tr", id } = await params;

  // show_slug ile gruplanmış tur/gösteri sayfası (1+ etkinlik; tek etkinlikte de sayfa görünsün)
  const showEvents = await getEventsByShowSlug(id);
  if (showEvents.length >= 1) {
    const firstEvent = showEvents[0] as { created_by_user_id?: string; organizer_display_name?: string | null };
    const lookedUp = await getOrganizerDisplayName(firstEvent.created_by_user_id);
    const organizerDisplayName =
      firstEvent.organizer_display_name?.trim() || lookedUp || null;

    const now = DateTime.now().setZone("Europe/Berlin");
    const upcoming = showEvents.filter((e) => {
      const parts = (e.date || "").trim().split("-").map((x) => parseInt(x, 10));
      const t = (e.time || "20:00").trim();
      const tm = /^(\d{1,2}):(\d{2})$/.exec(t);
      const h = tm ? parseInt(tm[1]!, 10) : 20;
      const mi = tm ? parseInt(tm[2]!, 10) : 0;
      if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return true;
      const [y, mo, d] = parts as [number, number, number];
      const dt = DateTime.fromObject({ year: y, month: mo, day: d, hour: h, minute: mi, second: 0 }, { zone: "Europe/Berlin" });
      return dt.isValid && dt >= now;
    });
    const ordered = [...(upcoming.length ? upcoming : showEvents)].sort((a, b) => {
      const da = `${a.date} ${a.time || "00:00"}`;
      const db = `${b.date} ${b.time || "00:00"}`;
      return da.localeCompare(db, undefined, { numeric: true });
    });
    const primaryEvent = ordered[0]!;
    const venue =
      primaryEvent.venue_id != null ? await getVenue(primaryEvent.venue_id) : null;
    const eventPath = eventPathFromId(id, showEvents, primaryEvent);
    const structuredData = buildEventJsonLd(primaryEvent, venue, locale, eventPath, organizerDisplayName);

    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <ShowDetailClient
          events={showEvents}
          showSlug={id}
          organizerDisplayName={organizerDisplayName}
          locale={locale as Locale}
        />
      </>
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

  const eventPath = eventPathFromId(id, [], event);
  const structuredData = buildEventJsonLd(event, venue, locale, eventPath, organizerDisplayName);

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
        locale={locale as Locale}
        isUnapproved={isUnapproved}
      />
    </>
  );
}
