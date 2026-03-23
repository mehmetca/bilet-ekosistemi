"use client";

import { Calendar, ArrowLeft, Share2, MapPin, Music2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import Image from "next/image";
import type { News, Event } from "@/types/database";
import { CATEGORY_LABELS } from "@/types/database";
import { getLocalizedNews, getLocalizedEvent, type Locale } from "@/lib/i18n-content";
import { formatPrice } from "@/lib/formatPrice";
import { formatEventDateDMY } from "@/lib/date-utils";
import Header from "@/components/Header";
import { useTranslations } from "next-intl";

const fallbackImage =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 450'%3E%3Crect width='800' height='450' fill='%23e2e8f0'/%3E%3Cg fill='%2364748b'%3E%3Ccircle cx='330' cy='190' r='36'/%3E%3Cpath d='M220 330l95-95 70 70 55-55 140 140H220z'/%3E%3C/g%3E%3C/svg%3E";

type OtherNewsItem = Pick<News, "id" | "title" | "title_tr" | "title_de" | "title_en" | "published_at">;

interface HaberDetayClientProps {
  haber: News;
  events: Event[];
  otherNews: OtherNewsItem[];
  locale?: Locale;
}

export default function HaberDetayClient({ haber, events, otherNews, locale = "tr" }: HaberDetayClientProps) {
  const t = useTranslations("home");
  const tCommon = useTranslations("common");
  const localized = getLocalizedNews(haber as unknown as Record<string, unknown>, locale);
  const excerpt = localized.excerpt || haber.summary || (localized.content ? localized.content.substring(0, 150) + "..." : "");

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: localized.title || haber.title,
        text: excerpt,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert(tCommon("linkCopied"));
    }
  };

  const getEventStatus = (event: Event) => {
    const eventDateTime = new Date(event.date + " " + (event.time || "00:00"));
    const now = new Date();
    const isPast = eventDateTime < now;
    return { isPast, statusText: isPast ? t("eventStatusEnded") : t("eventStatusActive") };
  };

  const dateLocale = locale === "tr" ? "tr-TR" : locale === "de" ? "de-DE" : "en-US";

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />

      <div className="mx-auto w-full max-w-7xl px-4 py-6 lg:py-8">
        {/* Üst satır: başlık (sol) | Yaklaşan Etkinlikler (sağ) */}
        <div className="grid gap-6 lg:grid-cols-[1fr_360px] lg:items-end mb-6">
          <div>
            <Link
              href="/"
              className="mb-4 inline-flex items-center gap-2 text-slate-600 hover:text-primary-600 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              {tCommon("backToHome")}
            </Link>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 text-left">
              {localized.title || haber.title}
            </h1>
            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600 mt-2">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {new Date(haber.published_at || haber.created_at).toLocaleDateString(dateLocale, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </div>
              <button
                onClick={handleShare}
                className="flex items-center gap-2 hover:text-primary-600 transition-colors"
              >
                <Share2 className="h-4 w-4" />
                {tCommon("share")}
              </button>
            </div>
          </div>
          <h2 className="text-lg font-bold text-slate-900 hidden lg:block">{t("upcomingEvents")}</h2>
        </div>

        {/* Fotoğraflar aynı hizada: haber görseli (sol) | etkinlik kartları (sağ) */}
        <div className="grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
          {/* Sol: Haber görseli, özet, içerik */}
          <div className="min-w-0 space-y-6">
            {haber.image_url ? (
              <div className="relative aspect-video rounded-xl overflow-hidden">
                <Image
                  src={haber.image_url}
                  alt={localized.title || haber.title}
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 66vw"
                />
              </div>
            ) : (
              <div className="aspect-video rounded-xl bg-slate-200" />
            )}

            {/* Özet, içerik, butonlar - fotoğrafın altında */}
            {excerpt && (
              <div className="bg-primary-50 border-l-4 border-primary-600 p-4 rounded-r-lg">
                <p className="text-lg text-primary-900 font-medium">{excerpt}</p>
              </div>
            )}

            <div className="prose prose-lg max-w-none">
              <div
                dangerouslySetInnerHTML={{ __html: localized.content || haber.content }}
                className="text-slate-700 leading-relaxed"
              />
            </div>

            <div className="flex flex-wrap gap-4 pt-4">
              <button
                onClick={handleShare}
                className="flex items-center gap-2 bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 transition-colors"
              >
                <Share2 className="h-4 w-4" />
                {tCommon("shareNews")}
              </button>
              <Link
                href="/"
                className="flex items-center gap-2 bg-slate-200 text-slate-700 px-6 py-3 rounded-lg hover:bg-slate-300 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                {tCommon("home")}
              </Link>
            </div>

            {otherNews.length > 0 && (
              <div className="pt-8 mt-8 border-t border-slate-200">
                <h2 className="text-xl font-bold text-slate-900 mb-4">{t("otherNews")}</h2>
                <ul className="space-y-3">
                  {otherNews.map((n) => {
                    const locTitle = (locale === "tr" && n.title_tr) || (locale === "de" && n.title_de) || (locale === "en" && n.title_en) || n.title;
                    return (
                      <li key={n.id}>
                        <Link
                          href={`/haber/${n.id}`}
                          className="block text-slate-700 hover:text-primary-600 font-medium transition-colors"
                        >
                          {locTitle}
                        </Link>
                        <span className="text-sm text-slate-500 ml-2">
                          {new Date(n.published_at).toLocaleDateString(dateLocale)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>

          {/* Sağ: Etkinlikler - ilk kartın fotoğrafı haber fotoğrafı ile aynı hizada */}
          <aside className="lg:sticky lg:top-24 -mt-2 space-y-4">
            <h2 className="text-lg font-bold text-slate-900 lg:hidden mb-2">{t("upcomingEvents")}</h2>
            <div className="space-y-4">
              {events.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-slate-500">
                  <Music2 className="h-12 w-12 mx-auto text-slate-300 mb-2" />
                  <p className="text-sm">{t("noEventsSlider")}</p>
                </div>
              ) : (
                events.map((event) => {
                  const eventStatus = getEventStatus(event);
                  const localizedEvent = getLocalizedEvent(event as unknown as Record<string, unknown>, locale as "tr" | "de" | "en");
                  return (
                    <Link key={event.id} href={`/etkinlik/${(event as Event & { show_slug?: string | null }).show_slug || event.slug || event.id}`}>
                      <div
                        className={`overflow-hidden rounded-xl border shadow-sm hover:shadow-md transition-shadow ${
                          eventStatus.isPast
                            ? "bg-slate-50 border-slate-300 opacity-75"
                            : "bg-white border-slate-200"
                        }`}
                      >
                        <div className="aspect-video bg-gradient-to-br from-primary-100 to-primary-50 flex items-center justify-center overflow-hidden relative">
                          {event.image_url ? (
                            <img
                              src={event.image_url}
                              alt={localizedEvent.title}
                              className="h-full w-full object-cover object-top"
                              onError={(e) => {
                                if (e.currentTarget.dataset.fallbackApplied === "1") return;
                                e.currentTarget.dataset.fallbackApplied = "1";
                                e.currentTarget.src = fallbackImage;
                              }}
                            />
                          ) : (
                            <Music2 className="h-12 w-12 text-primary-400" />
                          )}
                          {eventStatus.isPast && (
                            <div className="absolute left-2 top-2">
                              <span className="px-2 py-1 text-xs font-bold text-white bg-red-600 rounded">
                                {t("eventEnded")}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="p-4">
                          <span className="text-xs font-medium text-primary-600">
                            {CATEGORY_LABELS[event.category as keyof typeof CATEGORY_LABELS] ?? event.category ?? "Etkinlik"}
                          </span>
                          <h3
                            className={`font-semibold line-clamp-2 mt-1 mb-2 ${
                              eventStatus.isPast ? "text-slate-600" : "text-slate-900"
                            }`}
                          >
                            {localizedEvent.title}
                          </h3>
                          <div className="space-y-1 text-sm text-slate-600">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
                              <span>{formatEventDateDMY(event.date)} • {event.time}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                              <span className="line-clamp-1">{localizedEvent.venue || event.venue}, {event.location}</span>
                            </div>
                          </div>
                          <div className="mt-3 pt-3 border-t border-slate-100">
                            <span
                              className={`font-bold ${
                                eventStatus.isPast ? "text-slate-500" : "text-primary-600"
                              }`}
                            >
                              {Number(event.price_from) > 0
                                ? `${t("from")} ${formatPrice(Number(event.price_from), event.currency)}`
                                : t("free")}
                            </span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
