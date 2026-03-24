"use client";

import { useState, useEffect } from "react";
import { Calendar, Filter, MapPin, Music2 } from "lucide-react";
import type { Event } from "@/types/database";
import { DISPLAY_CATEGORIES } from "@/types/database";
import { formatPrice } from "@/lib/formatPrice";
import { Link } from "@/i18n/navigation";
import { parseEventDescription } from "@/lib/eventMeta";
import { getLocalizedEvent } from "@/lib/i18n-content";
import { useTranslations, useLocale } from "next-intl";
import { parseDateInput, toISODateString, formatEventDateDMY, formatEventDateDMYFromDate } from "@/lib/date-utils";

interface EventCalendarProps {
  events: Event[];
}

export default function EventCalendar({ events }: EventCalendarProps) {
  const t = useTranslations();
  const locale = useLocale();
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [filteredEvents, setFilteredEvents] = useState<Event[]>(events);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const fallbackImage =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 450'%3E%3Crect width='800' height='450' fill='%23e2e8f0'/%3E%3Cg fill='%2364748b'%3E%3Ccircle cx='330' cy='190' r='36'/%3E%3Cpath d='M220 330l95-95 70 70 55-55 140 140H220z'/%3E%3C/g%3E%3C/svg%3E";

  // Tarihe göre filtrele
  useEffect(() => {
    let filtered = events;

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

    setFilteredEvents(filtered);
  }, [selectedDate, selectedCategory, events]);

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

  return (
    <div className="space-y-6">
      {/* Başlık ve Filtreler */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h1 className="section-title mb-6">{t("calendar.title")}</h1>
        
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
              value={selectedDate}
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
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {upcomingEvents.map((event) => (
              <Link
                key={event.id}
                href={`/etkinlik/${(event as Event & { show_slug?: string | null }).show_slug || event.slug || event.id}`}
                className="block overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-lg transition-shadow"
              >
                <div className="aspect-video bg-gradient-to-br from-primary-100 to-primary-50 flex items-center justify-center overflow-hidden">
                  {event.image_url ? (
                    <img
                      src={event.image_url}
                      alt={event.title}
                      className="h-full w-full object-cover object-top"
                      onError={(e) => {
                        const img = e.currentTarget;
                        if (!img) return;
                        if (img.dataset.fallbackApplied === "1") return;
                        img.dataset.fallbackApplied = "1";
                        img.src = fallbackImage;
                      }}
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center text-primary-500">
                      <Music2 className="h-12 w-12" />
                      <span className="mt-2 text-xs font-medium">{t("calendar.noImage")}</span>
                    </div>
                  )}
                </div>
                <div className="p-5">
                  <span className="text-xs font-medium text-primary-600">
                    {event.category ? t(`categories.${event.category}`) : t("categories.event")}
                  </span>
                  <h3 className="mt-2 font-semibold text-slate-900 line-clamp-2">{(getLocalizedEvent(event as unknown as Record<string, unknown>, locale as "tr" | "de" | "en").title || event.title) ?? ""}</h3>
                  <p className="mt-2 text-sm text-slate-600 line-clamp-2">
                    {parseEventDescription(getLocalizedEvent(event as unknown as Record<string, unknown>, locale as "tr" | "de" | "en").description || event.description).content}
                  </p>
                    <div className="mt-3 space-y-2 text-sm text-slate-500">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 flex-shrink-0" />
                      {event.date ? formatEventDateDMY(event.date) : ""} • {event.time ?? ""}
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 flex-shrink-0" />
                      {(getLocalizedEvent(event as unknown as Record<string, unknown>, locale as "tr" | "de" | "en").venue || event.venue) ?? ""}, {event.location ?? ""}
                    </div>
                  </div>
                  <div className="mt-4 flex justify-between items-center">
                    <span className="font-bold text-primary-600">
                      {Number(event.price_from) > 0
                        ? formatPrice(Number(event.price_from), event.currency)
                        : t("home.free")}
                    </span>
                    <span className="text-sm font-medium text-primary-600">{t("calendar.buyTicket")} →</span>
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
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {pastEvents.map((event) => (
                <div
                  key={`past-${event.id}`}
                  className="block overflow-hidden rounded-2xl bg-slate-50 border border-slate-300 opacity-80"
                >
                  <div className="aspect-video bg-gradient-to-br from-primary-100 to-primary-50 flex items-center justify-center overflow-hidden relative">
                    {event.image_url ? (
                      <img
                        src={event.image_url}
                        alt={event.title}
                        className="h-full w-full object-cover object-top"
                        onError={(e) => {
                          const img = e.currentTarget;
                          if (img.dataset.fallbackApplied === "1") return;
                          img.dataset.fallbackApplied = "1";
                          img.src = fallbackImage;
                        }}
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center text-primary-500">
                        <Music2 className="h-12 w-12" />
                        <span className="mt-2 text-xs font-medium">{t("calendar.noImage")}</span>
                      </div>
                    )}
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
                    <h3 className="mt-2 font-semibold text-slate-700 line-clamp-2">{event.title}</h3>
                    <div className="mt-3 space-y-2 text-sm text-slate-500">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 flex-shrink-0" />
                        {event.date ? formatEventDateDMY(event.date) : ""} • {event.time ?? ""}
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
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
