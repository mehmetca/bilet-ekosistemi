"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import NextLink from "next/link";
import { Calendar, ChevronRight, Music2, Building2 } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import Header from "@/components/Header";
import type { Event } from "@/types/database";
import { formatPrice } from "@/lib/formatPrice";
import { getLocalizedEvent, getLocalizedText, type Locale } from "@/lib/i18n-content";
import { parseEventDescription } from "@/lib/eventMeta";
import { formatEventVenueAddressCityLine } from "@/lib/event-venue-display";
import { formatEventLongDateTime } from "@/lib/date-utils";

interface ShowDetailClientProps {
  events: Event[];
  showSlug: string;
  organizerDisplayName?: string | null;
  locale?: Locale;
}

function buildEventAddressLine(event: Event, venueDisplay: string): string {
  const line = formatEventVenueAddressCityLine(event, venueDisplay);
  if (line) return line;
  return (event.location ?? "").trim();
}

function getEventCityLabel(event: Event): string {
  const city = (event.city ?? "").trim();
  if (city) return city;
  const loc = (event.location ?? "").trim();
  if (!loc) return "";
  return loc.split(",")[0]?.trim() || loc;
}

function formatCityTicketsTitle(showTitle: string, city: string, locale: Locale): string {
  const cleanTitle = (showTitle || "").split(",")[0]?.trim() || showTitle;
  if (locale !== "tr") return `${cleanTitle} ${city}`.trim();

  // Turkish: "Miraz Konseri" + "Stuttgart" => "Miraz Stuttgart Konseri"
  if (/konseri/i.test(cleanTitle)) {
    const cityEscaped = city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const withoutCity = cleanTitle.replace(new RegExp(`\\b${cityEscaped}\\b`, "i"), "").replace(/\s+/g, " ").trim();
    return withoutCity.replace(/konseri/i, `${city} Konseri`).replace(/\s+/g, " ").trim();
  }
  return `${cleanTitle} ${city}`.trim();
}

function isPastEventDate(event: Event): boolean {
  const dt = new Date(`${event.date} ${event.time || "00:00"}`);
  return dt < new Date();
}

function pickBestLocalizedShowText(events: Event[], field: "title" | "description" | "venue", locale: Locale): string {
  for (const event of events) {
    const value = getLocalizedText(event as unknown as Record<string, unknown>, field, locale);
    if (value && value.trim()) return value;
  }
  return "";
}

export default function ShowDetailClient({ events, showSlug, organizerDisplayName = null, locale: localeProp = "tr" }: ShowDetailClientProps) {
  const t = useTranslations("eventDetail");
  const tShow = useTranslations("showDetail");
  const tCat = useTranslations("categories");
  const locale = ((useLocale() as Locale) || localeProp) as Locale;

  const firstEvent = events[0];
  const localized = {
    ...getLocalizedEvent(firstEvent as unknown as Record<string, unknown>, locale),
    title: pickBestLocalizedShowText(events, "title", locale) || getLocalizedEvent(firstEvent as unknown as Record<string, unknown>, locale).title,
    description:
      pickBestLocalizedShowText(events, "description", locale) ||
      getLocalizedEvent(firstEvent as unknown as Record<string, unknown>, locale).description,
  };
  const parsedDescription = parseEventDescription(localized.description || firstEvent.description);

  const hasExternalTickets = useMemo(() => {
    return events.some((e) => {
      const parsed = parseEventDescription(
        getLocalizedEvent(e as unknown as Record<string, unknown>, locale).description || e.description
      );
      return Boolean(parsed.externalTicketUrl || (e as Event & { ticket_url?: string }).ticket_url);
    });
  }, [events, locale]);

  const [selectedCity, setSelectedCity] = useState<string>("all");
  const upcomingEvents = useMemo(() => events.filter((e) => !isPastEventDate(e)), [events]);

  const cities = useMemo(() => {
    const citySet = new Set(upcomingEvents.map((e) => getEventCityLabel(e)).filter(Boolean));
    const list = Array.from(citySet);
    const earliestMs = (city: string) => {
      const times = upcomingEvents
        .filter((e) => getEventCityLabel(e) === city)
        .map((e) => new Date(`${e.date} ${e.time || "00:00"}`).getTime())
        .filter((ms) => Number.isFinite(ms));
      return times.length > 0 ? Math.min(...times) : Number.POSITIVE_INFINITY;
    };
    return list.sort((a, b) => {
      const da = earliestMs(a);
      const db = earliestMs(b);
      if (da !== db) return da - db;
      return a.localeCompare(b, "tr");
    });
  }, [upcomingEvents]);

  const filteredEvents = useMemo(() => {
    if (selectedCity === "all") return upcomingEvents;
    return upcomingEvents.filter((e) => getEventCityLabel(e) === selectedCity);
  }, [upcomingEvents, selectedCity]);

  // En yakın tarih/saat en üstte (kronolojik artan)
  const displayEvents = useMemo(() => {
    return [...filteredEvents].sort(
      (a, b) => new Date(`${a.date} ${a.time || "00:00"}`).getTime() - new Date(`${b.date} ${b.time || "00:00"}`).getTime()
    );
  }, [filteredEvents]);

  const minPrice = useMemo(() => {
    const prices = events.map((e) => Number(e.price_from || 0)).filter((p) => p > 0);
    return prices.length > 0 ? Math.min(...prices) : 0;
  }, [events]);

  return (
    <div className="min-h-screen bg-[#f5f6f8]">
      <Header />

      {/* Hero – etkinlik özeti */}
      <div className="border-b border-slate-200 bg-white">
        <div className="site-container py-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">
            {tCat((firstEvent.category || "diger").toLowerCase())}
          </p>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
            <div>
              <h1 className="text-3xl lg:text-4xl font-extrabold text-slate-900">{localized.title}</h1>
              {organizerDisplayName && (
                <p className="mt-3 inline-flex items-center gap-2 rounded-md bg-primary-50 px-3 py-1.5 text-sm font-medium text-primary-700">
                  <Building2 className="h-4 w-4" />
                  {t("organizer")}: {organizerDisplayName}
                </p>
              )}
              <div className="mt-5 flex items-center gap-4">
                <p className="text-2xl font-bold text-primary-700">
                  {minPrice > 0 ? `${t("from")} ${formatPrice(minPrice, firstEvent.currency)}` : t("comingSoon")}
                </p>
                <span className="text-sm text-slate-500">
                  {events.length} {tShow("performances")}
                </span>
              </div>
            </div>
            <div>
              <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                {firstEvent.image_url ? (
                  <Image
                    src={firstEvent.image_url}
                    alt={localized.title}
                    fill
                    priority
                    className="object-cover"
                    sizes="(max-width: 1024px) 100vw, 360px"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Music2 className="h-16 w-16 text-slate-400" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Şehir seçimi ve seanslar */}
      <div className="site-container py-10">
        {hasExternalTickets && (
          <div className="mb-8 rounded-xl border border-blue-200 bg-blue-50 p-5">
            <h2 className="text-lg font-semibold text-blue-900 mb-2">{t("ticketInfo")}</h2>
            <p className="text-sm text-blue-900 mb-2">
              {t("externalTicketInfo")}{" "}
              {t("priceFrom")}: <strong>{formatPrice(minPrice, firstEvent.currency)}</strong>
            </p>
            <p className="text-sm text-blue-800 mb-2">{t("externalTicketDisclaimer")}</p>
            <p className="text-sm text-blue-800 mb-2">{t("externalTicketDisclaimer2")} {t("externalTicketSupport")}</p>
          </div>
        )}
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-8">
          <h2 className="text-xl font-bold text-slate-900 mb-4">{tShow("selectCity")}</h2>
          <select
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
            className="w-full max-w-xs rounded-lg border border-slate-300 px-4 py-3 text-slate-900 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
          >
            <option value="all">{tShow("allCities")}</option>
            {cities.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
        </div>

        <h2 className="text-2xl font-bold text-slate-900 mb-6">
          {t("ticketsAndPricesTitle", { title: localized.title || firstEvent.title })}
        </h2>

        {displayEvents.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500">
            <Calendar className="h-16 w-16 mx-auto text-slate-300 mb-4" />
            <p className="text-lg font-medium">
              {selectedCity === "all" ? tShow("noUpcomingPerformances") : tShow("noPerformancesInCity", { city: selectedCity })}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {selectedCity === "all"
              ? cities.map((city) => {
                  const cityEvents = displayEvents.filter((e) => getEventCityLabel(e) === city);
                  if (cityEvents.length === 0) return null;
                  return (
                    <CityEventsSection
                      key={city}
                      city={city}
                      showTitle={localized.title || firstEvent.title}
                      events={cityEvents}
                      organizerDisplayName={organizerDisplayName}
                      locale={locale}
                      t={t}
                      tShow={tShow}
                    />
                  );
                })
              : (
                <CityEventsSection
                  city={selectedCity}
                  showTitle={localized.title || firstEvent.title}
                  events={displayEvents}
                  organizerDisplayName={organizerDisplayName}
                  locale={locale}
                  t={t}
                  tShow={tShow}
                />
              )}
          </div>
        )}

        {/* Etkinlik Hakkında */}
        {parsedDescription.content && (
          <div className="bg-white rounded-xl border border-slate-200 p-8 mt-10">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">{t("aboutEvent")}</h2>
            <div className="prose prose-slate max-w-none">
              <p className="text-slate-700 leading-relaxed">{parsedDescription.content}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CityEventsSection({
  city,
  showTitle,
  events,
  organizerDisplayName,
  locale,
  t,
  tShow,
}: {
  city: string;
  showTitle: string;
  events: Event[];
  organizerDisplayName?: string | null;
  locale: Locale;
  t: (key: string, values?: Record<string, string | number>) => string;
  tShow: (key: string, values?: Record<string, string>) => string;
}) {
  const cityHeadlineTitle = formatCityTicketsTitle(showTitle, city, locale);
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="border-b border-slate-200 bg-white px-5 py-4 sm:px-6 sm:py-5">
        <h3 className="text-lg font-bold text-slate-900 sm:text-xl">{city}</h3>
        <p className="mt-1 text-sm font-semibold text-slate-800 sm:text-base">
          {locale === "tr" ? `${cityHeadlineTitle} Biletleri` : tShow("cityTicketsHeadline", { title: cityHeadlineTitle, city })}
        </p>
      </div>
      <div className="divide-y divide-slate-100">
        {events.map((event) => {
          const eventLocalized = getLocalizedEvent(event as unknown as Record<string, unknown>, locale);
          const eventDate = new Date(`${event.date} ${event.time || "00:00"}`);
          const isPast = eventDate < new Date();
          const price = Number(event.price_from || 0);
          const dateParts = formatEventLongDateTime(event.date, event.time, locale);
          const venueName = (eventLocalized.venue || event.venue || "").trim();
          const addressLine = buildEventAddressLine(event, venueName);

          return (
            <div
              key={event.id}
              className={`flex flex-col gap-4 px-4 py-5 transition-colors sm:flex-row sm:items-stretch sm:gap-6 sm:px-6 sm:py-6 ${
                isPast ? "opacity-60" : "hover:bg-slate-50/60"
              }`}
            >
              <div className="flex min-w-0 flex-1 gap-4 sm:gap-6">
                <div className="flex shrink-0 flex-row items-center gap-3 sm:flex-col sm:justify-center sm:gap-1 sm:border-r sm:border-slate-100 sm:pr-6">
                  <div className="min-w-[4.25rem] text-center sm:min-w-[3.5rem]">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{dateParts.monthShort}</p>
                    <p className="text-[2.1rem] font-extrabold leading-none text-slate-900 sm:text-[2.5rem]">
                      {dateParts.dayNum}
                    </p>
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold text-slate-900 sm:text-lg">{dateParts.lineLong}</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    <span className="font-semibold text-slate-800">{t("addressLabel")}</span>
                    {addressLine ? ` ${addressLine}` : " —"}
                  </p>
                  {organizerDisplayName ? (
                    <p className="mt-2 text-sm text-slate-600">
                      <span className="font-semibold text-slate-800">{t("organizer")}</span> {organizerDisplayName}
                    </p>
                  ) : null}
                  {isPast ? (
                    <span className="mt-3 inline-block text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded">
                      {t("eventEnded")}
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="flex shrink-0 flex-col justify-center gap-3 border-t border-slate-100 pt-4 sm:min-w-[200px] sm:border-t-0 sm:pt-0 sm:pl-2">
                <div className="text-left sm:text-right">
                  <p className="text-lg font-bold text-primary-700">
                    {price > 0 ? `${t("from")} ${formatPrice(price, event.currency)}` : t("comingSoon")}
                  </p>
                </div>
                {isPast ? (
                  <span className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-200 px-6 py-3 font-semibold text-slate-500 cursor-not-allowed sm:ml-auto">
                    {t("eventEnded")}
                  </span>
                ) : (
                  <NextLink
                    href={`/${locale}/etkinlik/${event.id}`}
                    className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-md bg-[#c62828] px-5 text-sm font-bold uppercase tracking-wide text-white shadow hover:bg-[#b71c1c] sm:ml-auto"
                  >
                    {t("buyTicket")}
                    <ChevronRight className="h-4 w-4" />
                  </NextLink>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
