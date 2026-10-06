"use client";

import { Link } from "@/i18n/navigation";
import type { Event } from "@/types/database";
import { isEventPubliclyVisible } from "@/lib/event-visibility";
import { getLocalizedEvent } from "@/lib/i18n-content";
import { eventDetailPath } from "@/lib/amed-spor-utils";
import type { Locale } from "@/lib/i18n-content";
import { Music2 } from "lucide-react";
import CoverImage from "@/components/CoverImage";
import SectionTitle from "@/components/ui/SectionTitle";
import { cardClass } from "@/components/ui/Card";
import { cn } from "@/components/ui/cn";

interface FeaturedEventsProps {
  events: Event[];
  locale: Locale;
  title?: string;
}

// FeaturedEvents bileşeni
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
      if (!isEventPubliclyVisible(e as Event & { is_active?: boolean })) return false;
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
    <section className="site-container py-12">
      <SectionTitle title={title} />
      <div className="grid gap-6 md:grid-cols-2">
        {featured.map((event) => {
          const localized = getLocalizedEvent(event as unknown as Record<string, unknown>, locale);
          const href = eventDetailPath((event as Event & { show_slug?: string }).show_slug, event.id);
          const dateParts = getStackedDateParts(event.date);

          return (
            <Link
              key={event.id}
              href={href}
              className={cn(cardClass({ hover: true }), "group block overflow-hidden")}
            >
              <div className="relative aspect-[16/9] overflow-hidden bg-ink-100">
                <CoverImage
                  src={event.image_url}
                  alt={localized.title}
                  sizes="(max-width: 768px) 100vw, 50vw"
                  imageClassName="object-cover object-top transition-transform duration-500 group-hover:scale-[1.03]"
                  fallback={
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Music2 className="h-24 w-24 text-ink-300" />
                    </div>
                  }
                />
                <div className="poster-scrim pointer-events-none absolute inset-0" aria-hidden />
                {/* Alt satır: sol tarafta başlık + mekan, sağ tarafta tarih (afiş damgası) */}
                <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3 p-4 sm:flex-row sm:items-end sm:justify-between sm:p-5 md:p-6">
                  <div className="order-2 min-w-0 flex-1 sm:order-1">
                    <h3 className="mb-1 line-clamp-2 font-display text-base font-semibold tracking-tight text-white drop-shadow-lg sm:text-lg md:text-xl">
                      {localized.title}
                    </h3>
                    <p className="line-clamp-1 text-sm text-white/75">
                      {[
                        (event as Event & { city?: string | null }).city || event.location,
                        localized.venue || event.venue,
                      ]
                        .filter(Boolean)
                        .join(" / ")}
                    </p>
                  </div>
                  {/* Tarih: afiş damgası — altın çizgi, serif gün, altın ay */}
                  <div className="order-1 flex flex-shrink-0 flex-col border-l-2 border-gold-500 pl-3 text-left sm:order-2 sm:self-auto">
                    <span className="font-display text-3xl font-semibold leading-none text-white drop-shadow-md md:text-4xl">
                      {dateParts.day}
                    </span>
                    <span className="mt-1 text-[10px] font-semibold uppercase leading-tight tracking-widest2 text-gold-300 md:text-xs">
                      {dateParts.month}
                    </span>
                    <span className="text-xs font-medium leading-tight text-white/70">
                      {dateParts.year}
                    </span>
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
