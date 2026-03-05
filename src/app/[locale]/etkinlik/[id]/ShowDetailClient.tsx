"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import { Calendar, MapPin, ChevronRight, Music2 } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import Header from "@/components/Header";
import { Link } from "@/i18n/navigation";
import type { Event } from "@/types/database";
import { CATEGORY_LABELS } from "@/types/database";
import { formatPrice } from "@/lib/formatPrice";
import { getLocalizedEvent } from "@/lib/i18n-content";
import { parseEventDescription } from "@/lib/eventMeta";

interface ShowDetailClientProps {
  events: Event[];
  showSlug: string;
  locale?: "tr" | "de" | "en";
}

const dateLocaleMap = { tr: "tr-TR", de: "de-DE", en: "en-US" } as const;

export default function ShowDetailClient({ events, showSlug, locale: localeProp = "tr" }: ShowDetailClientProps) {
  const t = useTranslations("eventDetail");
  const tShow = useTranslations("showDetail");
  const tCat = useTranslations("categories");
  const locale = (useLocale() as "tr" | "de" | "en") || localeProp;
  const dateLocale = dateLocaleMap[locale] || "tr-TR";

  const firstEvent = events[0];
  const localized = getLocalizedEvent(firstEvent as unknown as Record<string, unknown>, locale);
  const parsedDescription = parseEventDescription(localized.description || firstEvent.description);

  const [selectedCity, setSelectedCity] = useState<string>("all");

  const cities = useMemo(() => {
    const citySet = new Set(events.map((e) => (e.location || "").trim()).filter(Boolean));
    return Array.from(citySet).sort((a, b) => a.localeCompare(b, "tr"));
  }, [events]);

  const filteredEvents = useMemo(() => {
    if (selectedCity === "all") return events;
    return events.filter((e) => (e.location || "").trim() === selectedCity);
  }, [events, selectedCity]);

  const upcomingEvents = useMemo(() => {
    const now = new Date();
    return filteredEvents
      .filter((e) => new Date(`${e.date} ${e.time || "23:59"}`) >= now)
      .sort((a, b) => new Date(`${a.date} ${a.time || "00:00"}`).getTime() - new Date(`${b.date} ${b.time || "00:00"}`).getTime());
  }, [filteredEvents]);

  const minPrice = useMemo(() => {
    const prices = events.map((e) => Number(e.price_from || 0)).filter((p) => p > 0);
    return prices.length > 0 ? Math.min(...prices) : 0;
  }, [events]);

  return (
    <div className="min-h-screen bg-[#f5f6f8]">
      <Header />

      {/* Hero - Biletinial tarzı */}
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto w-full max-w-7xl px-4 py-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">
            {tCat((firstEvent.category || "diger").toLowerCase())}
          </p>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
            <div>
              <h1 className="text-3xl lg:text-4xl font-extrabold text-slate-900">{localized.title}</h1>
              {parsedDescription.content && (
                <p className="mt-4 text-slate-600 leading-relaxed line-clamp-3">{parsedDescription.content}</p>
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

      {/* Şehir seçimi ve seanslar - Biletinial tarzı */}
      <div className="mx-auto w-full max-w-7xl px-4 py-10">
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
          {selectedCity === "all" ? tShow("ticketsAndPrices") : `${tShow("ticketsIn")} ${selectedCity}`}
        </h2>

        {upcomingEvents.length === 0 ? (
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
                  const cityEvents = upcomingEvents.filter((e) => (e.location || "").trim() === city);
                  if (cityEvents.length === 0) return null;
                  return (
                    <CityEventsSection
                      key={city}
                      city={city}
                      events={cityEvents}
                      locale={locale}
                      dateLocale={dateLocale}
                      t={t}
                      tShow={tShow}
                    />
                  );
                })
              : (
                <CityEventsSection
                  city={selectedCity}
                  events={upcomingEvents}
                  locale={locale}
                  dateLocale={dateLocale}
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
  events,
  locale,
  dateLocale,
  t,
  tShow,
}: {
  city: string;
  events: Event[];
  locale: string;
  dateLocale: string;
  t: (key: string) => string;
  tShow: (key: string, values?: Record<string, string>) => string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <h3 className="px-6 py-4 bg-slate-50 border-b border-slate-200 font-semibold text-slate-900">
        {city} {tShow("tickets")}
      </h3>
      <div className="divide-y divide-slate-100">
        {events.map((event) => {
          const eventLocalized = getLocalizedEvent(event as unknown as Record<string, unknown>, locale as "tr" | "de" | "en");
          const eventDate = new Date(`${event.date} ${event.time || "00:00"}`);
          const isPast = eventDate < new Date();
          const price = Number(event.price_from || 0);

          return (
            <div
              key={event.id}
              className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-4 transition-colors ${
                isPast ? "opacity-60" : "hover:bg-slate-50/50"
              }`}
            >
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0 w-16 h-16 rounded-lg bg-primary-50 flex flex-col items-center justify-center">
                  <span className="text-xs font-medium text-primary-600 uppercase">
                    {new Date(event.date).toLocaleDateString(dateLocale, { month: "short" })}
                  </span>
                  <span className="text-xl font-bold text-primary-700">{new Date(event.date).getDate()}</span>
                </div>
                <div>
                  <p className="font-semibold text-slate-900">
                    {new Date(event.date).toLocaleDateString(dateLocale, {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                    , {event.time || "20:00"}
                  </p>
                  <p className="text-sm text-slate-600 flex items-center gap-1 mt-1">
                    <MapPin className="h-4 w-4 flex-shrink-0" />
                    {eventLocalized.venue || event.venue}
                  </p>
                  {isPast && (
                    <span className="inline-block mt-2 text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded">
                      {t("eventEnded")}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-lg font-bold text-primary-700">
                    {price > 0 ? `${t("from")} ${formatPrice(price, event.currency)}` : t("comingSoon")}
                  </p>
                </div>
                {isPast ? (
                  <span className="inline-flex items-center gap-2 rounded-lg bg-slate-200 px-6 py-3 font-semibold text-slate-500 cursor-not-allowed">
                    {t("eventEnded")}
                  </span>
                ) : (
                  <Link
                    href={`/${locale}/etkinlik/${event.slug || event.id}`}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-6 py-3 font-semibold text-white hover:bg-primary-700 transition-colors"
                  >
                    {t("buyTicket")}
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
