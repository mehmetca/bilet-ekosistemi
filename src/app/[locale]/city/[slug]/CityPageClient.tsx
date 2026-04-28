"use client";

import { useState, useMemo } from "react";
import { Link } from "@/i18n/navigation";
import { useTranslations, useLocale } from "next-intl";
import Header from "@/components/Header";
import { Calendar, MapPin, Music2, ChevronRight } from "lucide-react";
import { getLocalizedCity, getLocalizedEvent } from "@/lib/i18n-content";
import { formatPrice } from "@/lib/formatPrice";
import { parseEventDescription } from "@/lib/eventMeta";
import type { Event } from "@/types/database";
import { CATEGORY_LABELS } from "@/types/database";
import { formatEventDateDMY } from "@/lib/date-utils";

interface CityPageClientProps {
  city: Record<string, unknown>;
  initialEvents: Event[];
}

export default function CityPageClient({ city, initialEvents }: CityPageClientProps) {
  const t = useTranslations("city");
  const tHome = useTranslations("home");
  const locale = useLocale() as "tr" | "de" | "en";

  const [sortBy, setSortBy] = useState<"upcoming" | "popular">("upcoming");
  const localized = getLocalizedCity(city, locale);
  const cityName = localized.name || (city.slug as string) || "";
  const cityDesc = localized.description || "";
  const imageUrl = (city.image_url as string) || null;

  const citySlug = (city.slug as string)?.toLowerCase() || "";

  const isEventPast = (event: Event) => {
    const eventDateTime = new Date(`${event.date} ${event.time || "00:00"}`);
    return eventDateTime < new Date();
  };

  // Filtreleme: Sadece onaylı (is_approved === true), bu şehre ait olan ve geçmiş olmayan etkinlikler
  const upcomingEvents = initialEvents.filter((e) => {
    // Sadece değeri kesinlikle 'true' olanları göster (boolean veya string fark etmez)
    const isApproved = String((e as any).is_approved) === 'true';
    const isNotPast = !isEventPast(e);
    
    // Şehir eşleşmesi: Adreste "Hannoversche" gibi benzer kelimeleri değil, 
    // tam kelime olarak şehir adını veya slug'ını arar (Regex word boundary).
    const loc = (e.location || "").toLowerCase();
    const targetSlug = citySlug.toLowerCase();
    const targetName = cityName.toLowerCase();
    
    const matchesCity = new RegExp(`\\b${targetSlug}\\b|\\b${targetName}\\b`, 'i').test(loc);

    return isApproved && isNotPast && matchesCity;
  });

  const sortedEvents = useMemo(() => {
    const list = [...upcomingEvents];
    if (sortBy === "upcoming") {
      list.sort((a, b) => {
        const aDate = new Date(`${a.date} ${a.time || "00:00"}`).getTime();
        const bDate = new Date(`${b.date} ${b.time || "00:00"}`).getTime();
        return aDate - bDate;
      });
    } else {
      list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    return list;
  }, [upcomingEvents, sortBy]);

  const fallbackImage =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 300'%3E%3Crect width='800' height='300' fill='%23003f8c'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='white' font-size='48' font-family='sans-serif'%3E" +
    encodeURIComponent(cityName) +
    "%3C/text%3E%3C/svg%3E";

  return (
    <div className="min-h-screen bg-[#f5f6f8]">
      <Header />

      {/* Hero - uzun şehir fotoğrafı */}
      <div className="relative h-64 md:h-80 lg:h-96 w-full overflow-hidden bg-slate-800">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={cityName}
            className="h-full w-full object-cover object-center"
            onError={(e) => {
              if (e.currentTarget.dataset.fallbackApplied === "1") return;
              e.currentTarget.dataset.fallbackApplied = "1";
              e.currentTarget.src = fallbackImage;
            }}
          />
        ) : (
          <img src={fallbackImage} alt={cityName} className="h-full w-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
          <h1 className="text-3xl font-bold md:text-4xl">{cityName}</h1>
          <p className="mt-2 text-lg text-white/90">
            {t("resultsCount", { count: upcomingEvents.length, city: cityName })}
          </p>
        </div>
      </div>

      <div className="site-container py-8">
        {/* Sıralama */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-slate-600">{t("sortBy")}:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "upcoming" | "popular")}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm"
          >
            <option value="upcoming">{tHome("sortBy.upcoming")}</option>
            <option value="popular">{tHome("sortBy.popular")}</option>
          </select>
        </div>

        {/* Etkinlik listesi */}
        {sortedEvents.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
            <Music2 className="mx-auto h-16 w-16 text-slate-300" />
            <p className="mt-4 text-lg font-medium text-slate-600">{t("noEvents")}</p>
            <Link
              href="/"
              className="mt-4 inline-flex items-center gap-2 text-primary-600 hover:text-primary-700"
            >
              {t("viewAllEvents")}
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {sortedEvents.map((event) => {
              const localizedEvent = getLocalizedEvent(event as unknown as Record<string, unknown>, locale);
              const parsedMeta = parseEventDescription(localizedEvent.description || event.description);
              return (
                <div
                  key={event.id}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-lg"
                >
                  <Link href={`/etkinlik/${(event as Event & { show_slug?: string }).show_slug || event.id}`}>
                    <div className="aspect-video bg-gradient-to-br from-primary-100 to-primary-50 flex items-center justify-center overflow-hidden">
                      {event.image_url ? (
                        <img
                          src={event.image_url}
                          alt={localizedEvent.title}
                          className="h-full w-full object-cover object-top"
                        />
                      ) : (
                        <Music2 className="h-16 w-16 text-primary-400" />
                      )}
                    </div>
                  </Link>
                  <div className="p-4">
                    <span className="text-xs font-medium text-primary-600">
                      {CATEGORY_LABELS[event.category as keyof typeof CATEGORY_LABELS] ?? event.category}
                    </span>
                    <h3 className="mt-1 font-semibold text-slate-900 line-clamp-1">{localizedEvent.title}</h3>
                    <div className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                      <Calendar className="h-4 w-4 flex-shrink-0" />
                      <span>
                        {formatEventDateDMY(event.date)} • {event.time}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <MapPin className="h-4 w-4 flex-shrink-0" />
                      <span className="line-clamp-1">{localizedEvent.venue || event.venue}, {event.location}</span>
                    </div>
                  </div>
                  <div className="border-t border-slate-100 px-4 pb-4 pt-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-primary-600">
                        {Number(event.price_from) > 0
                          ? `${tHome("from")} ${formatPrice(Number(event.price_from), event.currency)}`
                          : tHome("free")}
                      </span>
                      <Link
                        href={`/etkinlik/${(event as Event & { show_slug?: string }).show_slug || event.id}`}
                        className="inline-flex items-center gap-1 rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700"
                      >
                        {tHome("buyTicket")}
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Şehir hakkında bilgi */}
        {cityDesc && (
          <section className="mt-16 rounded-2xl border border-slate-200 bg-white p-8">
            <h2 className="mb-4 text-xl font-bold text-slate-900">{t("aboutCity", { city: cityName })}</h2>
            <div
              className="prose prose-slate max-w-none text-slate-600"
              dangerouslySetInnerHTML={{ __html: cityDesc }}
            />
          </section>
        )}
      </div>
    </div>
  );
}
