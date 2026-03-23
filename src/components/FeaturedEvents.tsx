"use client";

import { Link } from "@/i18n/navigation";
import type { Event } from "@/types/database";
import { getLocalizedEvent } from "@/lib/i18n-content";
import type { Locale } from "@/lib/i18n-content";
import { Music2 } from "lucide-react";

const fallbackImage =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 450'%3E%3Crect width='800' height='450' fill='%23e2e8f0'/%3E%3Cg fill='%2364748b'%3E%3Ccircle cx='330' cy='190' r='36'/%3E%3Cpath d='M220 330l95-95 70 70 55-55 140 140H220z'/%3E%3C/g%3E%3C/svg%3E";

interface FeaturedEventsProps {
  events: Event[];
  locale: Locale;
  title?: string;
}

export default function FeaturedEvents({ events, locale, title = "Events" }: FeaturedEventsProps) {
  const getStackedDateParts = (rawDate: string) => {
    const datePart = String(rawDate || "").includes("T") ? String(rawDate).split("T")[0] : String(rawDate || "").slice(0, 10);
    const m = datePart.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (!m) return { day: "—", month: "", year: "" };
    const year = m[1];
    const monthIndex = Math.max(0, Math.min(11, Number(m[2]) - 1));
    const day = String(Number(m[3]));
    const localeCode = locale === "tr" ? "tr-TR" : locale === "de" ? "de-DE" : "en-US";
    const month = new Intl.DateTimeFormat(localeCode, { month: "long" }).format(new Date(Number(year), monthIndex, 1));
    return { day, month, year };
  };

  const featured = [...events]
    .filter((e) => {
      const ord = (e as Event & { homepage_featured_order?: number | null }).homepage_featured_order;
      return ord === 1 || ord === 2;
    })
    .sort((a, b) => {
      const ao = (a as Event & { homepage_featured_order?: number | null }).homepage_featured_order ?? 99;
      const bo = (b as Event & { homepage_featured_order?: number | null }).homepage_featured_order ?? 99;
      return ao - bo;
    })
    .slice(0, 2);

  if (featured.length === 0) return null;

  return (
    <section className="container mx-auto px-4 py-12">
      <h2 className="text-2xl font-bold text-slate-900 mb-6">{title}</h2>
      <div className="grid gap-6 md:grid-cols-2">
        {featured.map((event) => {
          const localized = getLocalizedEvent(event as unknown as Record<string, unknown>, locale);
          const slug = (event as Event & { show_slug?: string }).show_slug || event.id;
          const dateParts = getStackedDateParts(event.date);

          return (
            <Link
              key={event.id}
              href={`/etkinlik/${slug}`}
              className="group block overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all hover:shadow-lg hover:border-primary-200"
            >
              <div className="relative aspect-[16/9] overflow-hidden bg-gradient-to-br from-slate-200 to-slate-100">
                {event.image_url ? (
                  <img
                    src={event.image_url}
                    alt={localized.title}
                    className="h-full w-full object-cover object-top"
                    onError={(e) => {
                      if (e.currentTarget.dataset.fallbackApplied === "1") return;
                      e.currentTarget.dataset.fallbackApplied = "1";
                      e.currentTarget.src = fallbackImage;
                    }}
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center">
                    <Music2 className="h-24 w-24 text-slate-400" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                {/* Alt satır: sol tarafta başlık + mekan, sağ tarafta tarih (etkinlik başlığı hizasında, şeffaf) */}
                <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between p-4 sm:p-5 md:p-6">
                  <div className="min-w-0 flex-1 order-2 sm:order-1">
                    <h3 className="text-base sm:text-lg md:text-xl font-bold text-white line-clamp-2 mb-1 drop-shadow-lg">
                      {localized.title}
                    </h3>
                    <p className="text-sm text-white/90 line-clamp-1">
                      {[
                        (event as Event & { city?: string | null }).city || event.location,
                        localized.venue || event.venue,
                      ]
                        .filter(Boolean)
                        .join(" / ")}
                    </p>
                  </div>
                  {/* Tarih: eski stil, alt alta (gün daha büyük) */}
                  <div className="flex flex-shrink-0 flex-col items-center justify-center rounded-lg border-2 border-white/90 bg-transparent px-3 py-2.5 md:px-4 md:py-3 min-w-[4.25rem] sm:min-w-[5.5rem] text-white drop-shadow-md order-1 sm:order-2 self-start sm:self-auto">
                    <span className="text-3xl md:text-4xl font-extrabold leading-none">{dateParts.day}</span>
                    <span className="mt-1 text-xs md:text-sm font-semibold uppercase tracking-wide leading-tight">{dateParts.month}</span>
                    <span className="text-xs md:text-sm font-medium leading-tight">{dateParts.year}</span>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
