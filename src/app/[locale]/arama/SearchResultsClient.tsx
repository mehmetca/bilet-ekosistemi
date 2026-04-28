"use client";

import { useMemo, useState } from "react";
import { Search, Calendar, MapPin } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { formatEventDateWithMonth, isEventPastByLocalDateTime } from "@/lib/date-utils";
import { formatPrice } from "@/lib/formatPrice";
import { getLocalizedEvent } from "@/lib/i18n-content";
import type { Event } from "@/types/database";

type Props = {
  initialQuery: string;
  events: Event[];
};

function normalizeForSearch(value: string): string {
  const lower = (value || "").toLocaleLowerCase("tr");
  const mapped = lower
    .replace(/ı/g, "i")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g");

  return mapped
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function eventDateISO(event: Event): string {
  const d = String(event.date ?? "");
  if (!d) return "";
  return d.includes("T") ? d.split("T")[0]! : d.slice(0, 10);
}

function isNearMatch(token: string, candidate: string): boolean {
  if (!token || !candidate) return false;
  if (candidate.includes(token)) return true;
  if (Math.abs(candidate.length - token.length) > 1) return false;
  if (token.length < 4 || candidate.length < 4) return false;

  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < token.length && j < candidate.length) {
    if (token[i] === candidate[j]) {
      i++;
      j++;
      continue;
    }
    edits++;
    if (edits > 1) return false;
    if (token.length > candidate.length) i++;
    else if (token.length < candidate.length) j++;
    else {
      i++;
      j++;
    }
  }
  if (i < token.length || j < candidate.length) edits++;
  return edits <= 1;
}

export default function SearchResultsClient({ initialQuery, events }: Props) {
  const t = useTranslations("home");
  const locale = useLocale();
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery || "");
  const pageTitle =
    locale === "de"
      ? "Veranstaltungssuche"
      : locale === "en"
        ? "Event Search"
        : locale === "ku"
          ? "Lêgerîna Bûyeran"
          : locale === "ckb"
            ? "گەڕان بەدوای بۆنەکان"
            : "Etkinlik Arama";
  const fallbackImage =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 450'%3E%3Crect width='800' height='450' fill='%23e2e8f0'/%3E%3Cg fill='%2364748b'%3E%3Ccircle cx='330' cy='190' r='36'/%3E%3Cpath d='M220 330l95-95 70 70 55-55 140 140H220z'/%3E%3C/g%3E%3C/svg%3E";

  const todayIso = (() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  })();

  const upcomingEvents = useMemo(() => {
    return (events || []).filter((event) => eventDateISO(event) >= todayIso);
  }, [events, todayIso]);

  const searchable = useMemo(() => {
    return upcomingEvents.map((event) => {
      const localized = getLocalizedEvent(event as unknown as Record<string, unknown>, locale as "tr" | "de" | "en");
      const parts = [
        localized.title || event.title,
        localized.description || event.description,
        localized.venue || event.venue,
        event.location,
        (event as Event & { city?: string | null }).city,
      ].filter(Boolean) as string[];

      return {
        event,
        normalizedText: normalizeForSearch(parts.join(" ")),
      };
    });
  }, [upcomingEvents, locale]);

  const normalizedQuery = normalizeForSearch(query);
  const queryTokens = normalizedQuery ? normalizedQuery.split(" ").filter(Boolean) : [];

  const results = useMemo(() => {
    if (queryTokens.length === 0) return upcomingEvents.slice(0, 24);

    return searchable
      .filter(({ normalizedText }) => {
        const words = normalizedText.split(" ").filter(Boolean);
        return queryTokens.every(
          (token) => normalizedText.includes(token) || words.some((w) => isNearMatch(token, w))
        );
      })
      .map((x) => x.event)
      .slice(0, 48);
  }, [queryTokens, searchable, upcomingEvents]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/arama?q=${encodeURIComponent(q)}` : "/arama");
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="site-container py-8">
        <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
          <h1 className="mb-4 text-2xl font-bold text-slate-900">{pageTitle}</h1>
          <form onSubmit={handleSearch} className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("searchPlaceholder")}
                className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <button
              type="submit"
              className="h-11 rounded-lg bg-primary-600 px-5 font-semibold text-white hover:bg-primary-700"
            >
              {t("search")}
            </button>
          </form>
        </div>

        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
          <h2 className="mb-4 text-xl font-bold text-slate-900">
            {t("upcomingEvents")}
            <span className="ml-2 text-sm font-normal text-slate-500">({results.length})</span>
          </h2>

          {results.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="font-medium text-slate-800">{t("noEventsForFilter")}</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {results.map((event) => {
                const localized = getLocalizedEvent(event as unknown as Record<string, unknown>, locale as "tr" | "de" | "en");
                const href = `/etkinlik/${(event as Event & { show_slug?: string | null }).show_slug || event.slug || event.id}`;
                return (
                  <Link key={event.id} href={href} className="overflow-hidden rounded-xl border border-slate-200 bg-white hover:shadow-md">
                    <div className="aspect-video bg-slate-100">
                      <img
                        src={event.image_url || fallbackImage}
                        alt={localized.title || event.title || "Event"}
                        className="h-full w-full object-cover object-top"
                        onError={(e) => {
                          const img = e.currentTarget;
                          if (img.dataset.fallbackApplied === "1") return;
                          img.dataset.fallbackApplied = "1";
                          img.src = fallbackImage;
                        }}
                      />
                    </div>
                    <div className="p-4">
                      <h3 className="line-clamp-2 font-semibold text-slate-900">{localized.title || event.title}</h3>
                      <div className="mt-3 space-y-2 text-sm text-slate-600">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 flex-shrink-0" />
                        {event.date ? formatEventDateWithMonth(event.date, locale as "tr" | "de" | "en" | "ku" | "ckb") : ""} • {event.time ?? ""}
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 flex-shrink-0" />
                        {(localized.venue || event.venue) ?? ""}, {event.location ?? ""}
                      </div>
                    </div>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="font-bold text-primary-600">
                          {Number(event.price_from) > 0 ? formatPrice(Number(event.price_from), event.currency) : t("free")}
                        </span>
                        <span className="text-sm font-medium text-primary-600">{t("buyTicket")} →</span>
                      </div>
                      {isEventPastByLocalDateTime(event.date, event.time) && (
                        <p className="mt-2 text-xs font-medium text-red-600">{t("eventEndedBanner")}</p>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

