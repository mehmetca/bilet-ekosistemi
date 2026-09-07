"use client";

import { useState, useEffect } from "react";
import { Calendar, Filter, MapPin, Music2 } from "lucide-react";
import type { Event } from "@/types/database";
import { DISPLAY_CATEGORIES } from "@/types/database";
import { formatPrice } from "@/lib/formatPrice";
import { Link } from "@/i18n/navigation";
import { getLocalizedEvent } from "@/lib/i18n-content";
import { useTranslations, useLocale } from "next-intl";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext"; // useSimpleAuth'ı import et
import { parseDateInput, toISODateString, formatEventDateWithMonth, formatEventDateDMYFromDate } from "@/lib/date-utils";
import { eventDetailPath, isAmedSporEvent } from "@/lib/amed-spor-utils";
import CoverImage from "@/components/CoverImage";

interface EventCalendarProps {
  events: Event[];
}

// EventCalendar bileşeni
export default function EventCalendar({ events }: EventCalendarProps) {
  const t = useTranslations();
  const locale = useLocale();
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [filteredEvents, setFilteredEvents] = useState<Event[]>(events);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [pastPage, setPastPage] = useState<number>(1);

  const { isAdmin } = useSimpleAuth(); // isAdmin durumunu al
  // Tarihe göre filtrele
  useEffect(() => {
    // Sadece onaylı (is_approved: true) olanları göster, admin ise tümünü göster
    let filtered = events.filter((event) => {
      if ((event as Event & { is_draft?: boolean }).is_draft) return false;
      return isAdmin || String((event as any).is_approved) === "true";
    });

    // Kategori filtresi
    if (selectedCategory !== "all") {
      filtered = filtered.filter(event => event.category === selectedCategory);
    }

    // Tarih filtresi - selectedDate type="date" ile zaten YYYY-MM-DD veya parse ile
    if (selectedDate) {
      const targetISO = selectedDate.includes("-") && selectedDate.length >= 10
        ? selectedDate.slice(0, 10)
        : (() => { const p = parseDateInput(selectedDate); return p ? toISODateString(p) : null; })();
      if (targetISO) {
        filtered = filtered.filter(event => {
          const d = String(event.date || "");
          const eventDate = d.includes("T") ? d.split("T")[0] : d.slice(0, 10);
          return eventDate === targetISO;
        });
      }
    }

    setFilteredEvents(filtered); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, selectedCategory, events, isAdmin]);

  useEffect(() => {
    setPastPage(1);
  }, [selectedDate, selectedCategory, events, isAdmin]);

  const now = new Date();
  const getEventDateTime = (event: Event) => new Date(`${event.date}T${event.time || "00:00"}`);

  const upcomingEvents = filteredEvents.filter((event) => {
    const eventDate = getEventDateTime(event);
    return eventDate >= now;
  });
  const pastEvents = filteredEvents
    .filter((event) => {
      const eventDate = getEventDateTime(event);
      return eventDate < now;
    })
    .sort((a, b) => getEventDateTime(b).getTime() - getEventDateTime(a).getTime());

  const PAST_EVENTS_PER_PAGE = 8; // 2 satır (xl: 4 kolon)
  const pastTotalPages = Math.max(1, Math.ceil(pastEvents.length / PAST_EVENTS_PER_PAGE));
  const safePastPage = Math.min(pastPage, pastTotalPages);
  const pastPageStart = (safePastPage - 1) * PAST_EVENTS_PER_PAGE;
  const visiblePastEvents = pastEvents.slice(pastPageStart, pastPageStart + PAST_EVENTS_PER_PAGE);

  return (
    <div className="space-y-6">
      {/* Başlık ve Filtreler */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6 text-center">{t("calendar.title")}</h1>
        
        {/* Filtreler */}
        <div className="flex flex-col md:flex-row gap-4">
          {/* Kategori Filtresi */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-500" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-primary-500"
            >
              <option value="all">{t("calendar.allCategories")}</option>
              {DISPLAY_CATEGORIES.map((key) => (
                <option key={key} value={key}>
                  {t(`categories.${key}`)}
                </option>
              ))}
            </select>
          </div>

          {/* Tarih Seçimi (tarayıcı takvimi; değer her zaman görünür) */}
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-slate-500 flex-shrink-0" />
            <input
              type="date"
              value={selectedDate || new Date().toISOString().split('T')[0]}
              onChange={(e) => setSelectedDate(e.target.value || "")}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 bg-white focus:border-primary-500 focus:ring-primary-500 min-w-[140px]"
            />
            {selectedDate && (
              <button
                onClick={() => setSelectedDate("")}
                className="text-sm text-primary-600 hover:text-primary-700"
              >
                {t("calendar.clear")}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Etkinlik Listesi */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="card-title mb-4">
          {(() => {
            const parsed = selectedDate.trim() ? parseDateInput(selectedDate) : null;
            return parsed
              ? `${formatEventDateDMYFromDate(parsed)} ${t("calendar.eventsOnDate")}`
              : selectedCategory !== "all" 
                ? `${t(`categories.${selectedCategory}`)} ${t("calendar.eventsOfCategory")}`
                : t("home.upcomingEvents");
          })()}
          <span className="ml-2 text-sm font-normal text-slate-500">
            ({upcomingEvents.length} {t("calendar.eventsCount")})
          </span>
        </h2>

        {upcomingEvents.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="h-16 w-16 mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500">
              {events.length === 0
                ? t("calendar.noEventsYet")
                : selectedDate
                  ? t("calendar.noEventsForDate")
                  : t("calendar.noEventsForFilter")
              }
            </p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {upcomingEvents.map((event) => (
              <Link
                key={event.id}
                href={eventDetailPath((event as Event & { show_slug?: string | null }).show_slug, event.id, event.slug)}
                className="flex h-full flex-col overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-lg transition-shadow"
              >
                <div className="relative aspect-[3/4] bg-gradient-to-br from-primary-100 to-primary-50 flex items-center justify-center overflow-hidden">
                  <CoverImage
                    src={event.image_url}
                    alt={event.title}
                    sizes="(max-width: 767px) 100vw, (max-width: 1279px) 50vw, 25vw"
                    fallback={
                      <div className="flex h-full w-full flex-col items-center justify-center text-primary-500">
                        <Music2 className="h-12 w-12" />
                        <span className="mt-2 text-xs font-medium">{t("calendar.noImage")}</span>
                      </div>
                    }
                  />
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <span className="text-xs font-medium text-primary-600">
                    {event.category ? t(`categories.${event.category}`) : t("categories.event")}
                  </span>
                  <h3 className="mt-2 font-semibold text-slate-900 line-clamp-2">{(getLocalizedEvent(event as unknown as Record<string, unknown>, locale as "tr" | "de" | "en").title || event.title) ?? ""}</h3>
                    <div className="mt-3 space-y-2 text-sm text-slate-500">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 flex-shrink-0" />
                      {event.date ? formatEventDateWithMonth(event.date, locale as "tr" | "de" | "en" | "ku" | "ckb") : ""} • {event.time ?? ""}
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 flex-shrink-0" />
                      {(getLocalizedEvent(event as unknown as Record<string, unknown>, locale as "tr" | "de" | "en").venue || event.venue) ?? ""}, {event.location ?? ""}
                    </div>
                  </div>
                  <div className="mt-auto pt-4 flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
                    <span className="font-bold text-lg text-primary-600">
                      {(event as Event & { show_slug?: string | null }).show_slug &&
                      isAmedSporEvent((event as Event & { show_slug?: string | null }).show_slug)
                        ? null
                        : Number(event.price_from) > 0
                          ? `${t("home.from")} ${formatPrice(Number(event.price_from), event.currency)}`
                          : t("home.free")}
                    </span>
                    <span className="w-full sm:w-auto inline-flex items-center justify-center gap-1 px-3 py-2.5 rounded-lg text-sm font-medium text-primary-600 hover:text-primary-700 bg-primary-50 hover:bg-primary-100">
                      {t("calendar.buyTicket")}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {pastEvents.length > 0 && (
          <div className="mt-12">
            <h3 className="card-title mb-4">
              {t("home.pastEvents")}
              <span className="ml-2 text-sm font-normal text-slate-500">
                ({pastEvents.length} {t("calendar.eventsCount")})
              </span>
            </h3>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {visiblePastEvents.map((event) => (
                <Link
                  key={`past-${event.id}`}
                  href={eventDetailPath((event as Event & { show_slug?: string | null }).show_slug, event.id, event.slug)}
                  className="flex h-full flex-col overflow-hidden rounded-2xl bg-slate-50 border border-slate-300 opacity-80 hover:opacity-100 hover:shadow-lg transition-all"
                >
                  <div className="relative aspect-[3/4] bg-gradient-to-br from-primary-100 to-primary-50 flex items-center justify-center overflow-hidden">
                    <CoverImage
                      src={event.image_url}
                      alt={event.title}
                      sizes="(max-width: 767px) 100vw, (max-width: 1279px) 50vw, 25vw"
                      fallback={
                        <div className="flex h-full w-full flex-col items-center justify-center text-primary-500">
                          <Music2 className="h-12 w-12" />
                          <span className="mt-2 text-xs font-medium">{t("calendar.noImage")}</span>
                        </div>
                      }
                    />
                    <div className="absolute left-2 top-2">
                      <span className="px-2 py-1 text-xs font-bold text-white bg-red-600 rounded">
                        {t("home.eventEnded")}
                      </span>
                    </div>
                  </div>
                  <div className="p-5">
                    <span className="text-xs font-medium text-slate-600">
                      {event.category ? t(`categories.${event.category}`) : t("categories.event")}
                    </span>
                    <h3 className="mt-2 font-semibold text-slate-700 line-clamp-2">
                      {(getLocalizedEvent(event as unknown as Record<string, unknown>, locale as "tr" | "de" | "en").title || event.title) ?? ""}
                    </h3>
                    <div className="mt-3 space-y-2 text-sm text-slate-500">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 flex-shrink-0" />
                        {event.date ? formatEventDateWithMonth(event.date, locale as "tr" | "de" | "en" | "ku" | "ckb") : ""} • {event.time ?? ""}
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 flex-shrink-0" />
                        {(getLocalizedEvent(event as unknown as Record<string, unknown>, locale as "tr" | "de" | "en").venue || event.venue) ?? ""}, {event.location ?? ""}
                      </div>
                    </div>
                    <p className="mt-3 text-xs font-medium text-red-600">
                      {t("home.eventEndedBanner")}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
            {pastTotalPages > 1 && (
              <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setPastPage((p) => Math.max(1, p - 1))}
                  disabled={safePastPage <= 1}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  ←
                </button>
                {Array.from({ length: pastTotalPages }, (_, i) => i + 1).map((pageNum) => (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => setPastPage(pageNum)}
                    className={`rounded-md px-3 py-1.5 text-sm ${
                      pageNum === safePastPage
                        ? "bg-primary-600 text-white"
                        : "border border-slate-300 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {pageNum}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setPastPage((p) => Math.min(pastTotalPages, p + 1))}
                  disabled={safePastPage >= pastTotalPages}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  →
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
