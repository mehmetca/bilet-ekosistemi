import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getVenueById } from "@/lib/venues-server";
import { getLocalizedVenue, type Locale } from "@/lib/i18n-content";
import { getSiteUrl } from "@/lib/site-url";
import { routing } from "@/i18n/routing";
import { buildLocalePathMetadata } from "@/lib/seo/locale-path-metadata";
import MekanDetailClient from "./MekanDetailClient";

export const revalidate = 60;

type PageProps = {
  params: Promise<{ locale?: string; id: string }>;
};

function resolveLocale(locParam?: string): Locale {
  return locParam && routing.locales.includes(locParam as Locale)
    ? (locParam as Locale)
    : (routing.defaultLocale as Locale);
}

function absoluteImageUrl(url: string | null | undefined): string | undefined {
  const u = (url || "").trim();
  if (!u) return undefined;
  if (/^https?:\/\//i.test(u)) return u;
  const base = getSiteUrl().replace(/\/$/, "");
  return `${base}${u.startsWith("/") ? "" : "/"}${u}`;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id, locale: locParam } = await params;
  const locale = resolveLocale(locParam);
  const pathSuffix = `/mekanlar/${id}`;
  const venue = await getVenueById(id);

  if (!venue) {
    const t = await getTranslations({ locale, namespace: "venues" });
    return buildLocalePathMetadata(locale, pathSuffix, {
      title: t("notFound"),
      description: t("subtitle"),
    });
  }

  const t = await getTranslations({ locale, namespace: "venues" });
  const v = getLocalizedVenue(venue, locale);
  const name = v.name || String(venue.name ?? "");
  const title = v.city ? `${name} – ${v.city}` : name;
  const description =
    [v.address, v.city, v.transport_info].map((x) => x?.replace(/\s+/g, " ").trim()).filter(Boolean).join(", ").slice(0, 160) ||
    `${name} — ${t("subtitle")}`;

  return buildLocalePathMetadata(locale, pathSuffix, { title, description });
}

export default async function MekanDetailPage({ params }: PageProps) {
  const { id, locale: locParam } = await params;
  const locale = resolveLocale(locParam);
  const venue = await getVenueById(id);
  if (!venue) notFound();

  const v = getLocalizedVenue(venue, locale);
  const name = v.name || String(venue.name ?? "");
  const imageAbs = absoluteImageUrl(
    (venue.image_url_1 as string | null) || (venue.seating_layout_image_url as string | null)
  );
  const capacity = Number(venue.capacity);

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "EventVenue",
    name,
    url: `${getSiteUrl().replace(/\/$/, "")}/${locale}/mekanlar/${id}`,
    ...(imageAbs ? { image: [imageAbs] } : {}),
    ...(Number.isFinite(capacity) && capacity > 0 ? { maximumAttendeeCapacity: capacity } : {}),
    address: {
      "@type": "PostalAddress",
      streetAddress: v.address || undefined,
      addressLocality: v.city || undefined,
      addressCountry: "DE",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <MekanDetailClient initialVenue={venue} venueId={id} />
    </>
  );
}
