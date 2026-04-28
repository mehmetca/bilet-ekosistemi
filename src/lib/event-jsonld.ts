import { DateTime } from "luxon";
import type { Event, Venue } from "@/types/database";
import { getSiteUrl } from "@/lib/site-url";

function stripHtml(html: string | null | undefined): string {
  return (html || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function absolutizeUrl(url: string | null | undefined, origin: string): string | undefined {
  const u = (url || "").trim();
  if (!u) return undefined;
  if (/^https?:\/\//i.test(u)) return u;
  const base = origin.replace(/\/$/, "");
  return `${base}${u.startsWith("/") ? "" : "/"}${u}`;
}

function parseStartEndBerlin(
  dateStr: string,
  timeStr: string | null | undefined,
  durationHours: number
): { startDate: string; endDate: string } {
  const d = (dateStr || "").trim();
  const tRaw = (timeStr || "20:00").trim();
  const m = /^(\d{1,2}):(\d{2})$/.exec(tRaw);
  const hour = m ? parseInt(m[1]!, 10) : 20;
  const minute = m ? parseInt(m[2]!, 10) : 0;
  const parts = d.split("-").map((x) => parseInt(x, 10));
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) {
    const fallback = d || "1970-01-01";
    return {
      startDate: `${fallback}T12:00:00+01:00`,
      endDate: `${fallback}T14:00:00+01:00`,
    };
  }
  const [y, mo, day] = parts as [number, number, number];
  const start = DateTime.fromObject(
    { year: y, month: mo, day, hour, minute, second: 0 },
    { zone: "Europe/Berlin" }
  );
  if (!start.isValid) {
    return {
      startDate: `${d}T12:00:00+01:00`,
      endDate: `${d}T14:00:00+01:00`,
    };
  }
  const end = start.plus({ hours: durationHours });
  return {
    startDate: start.toISO({ suppressMilliseconds: true })!,
    endDate: end.toISO({ suppressMilliseconds: true })!,
  };
}

function offerValidFromIso(createdAt: string | null | undefined, fallbackIso: string): string {
  if (!createdAt?.trim()) return fallbackIso;
  const dt = DateTime.fromISO(createdAt.trim(), { zone: "utc" });
  if (!dt.isValid) return fallbackIso;
  return dt.setZone("Europe/Berlin").toISO({ suppressMilliseconds: true })!;
}

function offerPrice(event: Event): number {
  const n = Number(event.price_from);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100) / 100;
}

function offerCurrency(event: Event): string {
  const c = (event.currency as string | null | undefined)?.trim().toUpperCase();
  if (c && /^[A-Z]{3}$/.test(c)) return c;
  return "EUR";
}

/**
 * Google Etkinlik yapılandırılmış verisi — Europe/Berlin saat dilimi, tam URL'ler, eksiksiz Place/Organization.
 */
export function buildEventJsonLd(
  event: Event,
  venue: Venue | null,
  locale: string,
  eventPath: string,
  organizerDisplayName?: string | null
): Record<string, unknown> {
  let origin = getSiteUrl().replace(/\/$/, "");
  if (!/^https?:\/\//i.test(origin)) {
    origin = "https://kurdevents.com";
  }
  const path = eventPath.startsWith("/") ? eventPath : `/${eventPath}`;
  const canonicalUrl = `${origin}/${locale}${path}`;

  const organizerName =
    organizerDisplayName?.trim() ||
    (event as { organizer_display_name?: string | null }).organizer_display_name?.trim() ||
    "KurdEvents";

  const { startDate, endDate } = parseStartEndBerlin(event.date, event.time, 2);
  const startLuxon = DateTime.fromISO(startDate, { setZone: true });
  const isPast = startLuxon.isValid && startLuxon < DateTime.now().setZone("Europe/Berlin");

  const placeName = (
    event.venue?.trim() ||
    venue?.name?.trim() ||
    event.location?.trim() ||
    "Veranstaltungsort"
  ).trim();

  const street = venue?.address?.trim() || event.address?.trim() || "";
  const locality = venue?.city?.trim() || event.city?.trim() || "";
  const fallbackLine = (event.location || "").trim();

  const postalAddress: Record<string, string> = {
    "@type": "PostalAddress",
    addressCountry: "DE",
  };
  if (street) postalAddress.streetAddress = street;
  if (locality) postalAddress.addressLocality = locality;
  if (!street && !locality) {
    postalAddress.streetAddress = fallbackLine || placeName;
  }

  const performerName = (event.title || "Live").trim();

  const imageAbs = absolutizeUrl(event.image_url, origin);

  const availability = isPast ? "https://schema.org/SoldOut" : "https://schema.org/InStock";

  const desc = stripHtml(event.description);
  const safeDesc = (desc || event.title).slice(0, 5000);

  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    description: safeDesc,
    startDate,
    endDate,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    organizer: {
      "@type": "Organization",
      name: organizerName,
      url: `${origin}/`,
    },
    performer: {
      "@type": "MusicGroup",
      name: performerName,
    },
    location: {
      "@type": "Place",
      name: placeName,
      address: postalAddress,
    },
    ...(imageAbs ? { image: [imageAbs] } : {}),
    offers: {
      "@type": "Offer",
      url: canonicalUrl,
      price: offerPrice(event),
      priceCurrency: offerCurrency(event),
      availability,
      validFrom: offerValidFromIso(event.created_at, startDate),
    },
  };
}
