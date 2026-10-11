"use client";

import { useMemo, useState } from "react";
import { Link } from "@/i18n/navigation";
import Header from "@/components/Header";
import { useTranslations, useLocale } from "next-intl";
import { getLocalizedVenue, type Locale } from "@/lib/i18n-content";
import { ChevronDown, MapPin, Search as SearchIcon, Users } from "lucide-react";
import CoverImage from "@/components/CoverImage";

interface VenueFaqItem {
  soru: string;
  cevap: string;
}

interface Venue {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  capacity: number | null;
  seating_layout_description: string | null;
  seating_layout_image_url: string | null;
  image_url_1: string | null;
  image_url_2: string | null;
  image_url_3: string | null;
  image_url_4: string | null;
  image_url_5: string | null;
  entrance_info: string | null;
  transport_info: string | null;
  map_embed_url: string | null;
  rules: string | null;
  faq: VenueFaqItem[];
  name_tr?: string | null;
  name_de?: string | null;
  name_en?: string | null;
  address_tr?: string | null;
  address_de?: string | null;
  address_en?: string | null;
  city_tr?: string | null;
  city_de?: string | null;
  city_en?: string | null;
  seating_layout_description_tr?: string | null;
  seating_layout_description_de?: string | null;
  seating_layout_description_en?: string | null;
  entrance_info_tr?: string | null;
  entrance_info_de?: string | null;
  entrance_info_en?: string | null;
  transport_info_tr?: string | null;
  transport_info_de?: string | null;
  transport_info_en?: string | null;
  rules_tr?: string | null;
  rules_de?: string | null;
  rules_en?: string | null;
}

const ALL = "__all__";
const OTHER = "__other__";

const CARD_FRAME =
  "group overflow-hidden rounded-tl-xl rounded-br-xl rounded-tr-none rounded-bl-none border-[2px] border-ink-300 bg-white shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-ink-400 hover:shadow-lift";

function localized(venue: Venue, locale: Locale) {
  return getLocalizedVenue(venue as unknown as Record<string, unknown>, locale);
}

function cityOf(venue: Venue, locale: Locale): string {
  return localized(venue, locale).city || venue.city || OTHER;
}

function nameOf(venue: Venue, locale: Locale): string {
  return localized(venue, locale).name || venue.name || "";
}

function venuePhoto(venue: Venue): string | null {
  return (
    venue.image_url_1 ||
    venue.image_url_2 ||
    venue.image_url_3 ||
    venue.image_url_4 ||
    venue.image_url_5 ||
    venue.seating_layout_image_url
  );
}

function detailOf(venue: Venue, locale: Locale): string {
  const loc = localized(venue, locale);
  return [loc.city || venue.city, loc.address || venue.address].filter(Boolean).join(" • ");
}

type CardProps = {
  venue: Venue;
  locale: Locale;
  index: number;
  capacityLabel: string;
  personsLabel: string;
};

function VenueTile({ venue, locale, index, capacityLabel, personsLabel }: CardProps) {
  return (
    <Link href={`/mekanlar/${venue.id}`} className={CARD_FRAME}>
      <div className="relative aspect-[4/3] overflow-hidden bg-ink-100">
        <CoverImage
          src={venuePhoto(venue)}
          alt={nameOf(venue, locale)}
          sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, (max-width: 1279px) 33vw, 25vw"
          priority={index < 4}
          zoomOnHover
          fallback={
            <div className="absolute inset-0 flex items-center justify-center">
              <MapPin className="h-8 w-8 text-ink-400" />
            </div>
          }
        />
      </div>
      <div className="px-3 pb-3 pt-3 text-center">
        <h3 className="card-title line-clamp-1 text-sm group-hover:text-gold-700 md:text-base">
          {nameOf(venue, locale)}
        </h3>
        {detailOf(venue, locale) && (
          <p className="mt-1 line-clamp-1 text-xs text-ink-600 md:text-sm">{detailOf(venue, locale)}</p>
        )}
        {venue.capacity != null && (
          <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-ink-500 md:text-sm">
            <Users className="h-4 w-4 shrink-0" aria-hidden />
            {capacityLabel}: {venue.capacity} {personsLabel}
          </p>
        )}
      </div>
    </Link>
  );
}

export default function MekanlarClient({ initialVenues }: { initialVenues: Venue[] }) {
  const t = useTranslations("venues");
  const locale = useLocale() as Locale;
  const [venues] = useState<Venue[]>(initialVenues);
  const [search, setSearch] = useState("");
  const [selectedCity, setSelectedCity] = useState<string>(ALL);

  const searched = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("tr");
    if (!q) return venues;
    return venues.filter((venue) =>
      [nameOf(venue, locale), localized(venue, locale).address || venue.address, cityOf(venue, locale)]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("tr")
        .includes(q),
    );
  }, [search, venues, locale]);

  const cityCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const venue of searched) {
      const city = cityOf(venue, locale);
      counts.set(city, (counts.get(city) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => {
      if (a[0] === b[0]) return 0;
      if (a[0] === OTHER) return 1;
      if (b[0] === OTHER) return -1;
      return a[0].localeCompare(b[0], locale);
    });
  }, [searched, locale]);

  const groups = useMemo(() => {
    const visible =
      selectedCity === ALL ? searched : searched.filter((venue) => cityOf(venue, locale) === selectedCity);
    let order = 0;
    return cityCounts
      .map(([city]) => ({
        city,
        venues: visible
          .filter((venue) => cityOf(venue, locale) === city)
          .sort((a, b) => nameOf(a, locale).localeCompare(nameOf(b, locale), locale))
          .map((venue) => ({ venue, index: order++ })),
      }))
      .filter((group) => group.venues.length > 0);
  }, [cityCounts, searched, selectedCity, locale]);

  return (
    <div className="min-h-screen bg-paper">
      <Header />

      <main className="site-container py-6 sm:py-10">
        <div className="mb-4 text-center sm:mb-6">
          <h1 className="page-title text-3xl sm:text-4xl md:text-5xl">{t("title")}</h1>
          <p className="body-muted mt-2 text-base sm:mt-3 sm:text-lg">{t("subtitle")}</p>
        </div>

        <div className="mb-6 rounded-lg border border-ink-200 bg-white p-3 sm:p-4">
          <div className="flex flex-col gap-2.5 sm:flex-row">
            <div className="relative w-full sm:flex-1">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400 sm:left-4 sm:h-5 sm:w-5" />
              <label className="sr-only" htmlFor="venue-search">
                {t("searchPlaceholder")}
              </label>
              <input
                id="venue-search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("searchPlaceholder")}
                className="w-full min-h-[44px] rounded-lg border border-transparent bg-ink-100 py-3 pl-10 pr-3 text-sm text-ink-900 shadow-card focus:border-transparent focus:bg-white focus:outline-none focus:ring-0 sm:py-3.5 sm:pl-12 sm:pr-4 sm:text-base"
              />
            </div>

            <div className="relative w-full sm:w-56 lg:w-64">
              <label className="sr-only" htmlFor="venue-city">
                {t("filterCity")}
              </label>
              <select
                id="venue-city"
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="w-full min-h-[44px] appearance-none rounded-lg border border-transparent bg-ink-100 py-3 pl-4 pr-10 text-sm font-semibold text-ink-900 shadow-card focus:border-transparent focus:bg-white focus:outline-none focus:ring-0 sm:text-base"
              >
                <option value={ALL}>{t("allCities")}</option>
                {cityCounts.map(([city]) => (
                  <option key={city} value={city}>
                    {city === OTHER ? t("other") : city}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
            </div>
          </div>
        </div>

        {venues.length === 0 ? (
          <div className="rounded-lg border border-ink-200 bg-white p-10 text-center text-ink-500">
            <MapPin className="mx-auto h-12 w-12 text-ink-300" />
            <p className="mt-3 text-base font-medium">{t("noVenues")}</p>
          </div>
        ) : groups.length === 0 ? (
          <div className="rounded-lg border border-ink-200 bg-white p-10 text-center text-ink-500">
            <SearchIcon className="mx-auto h-12 w-12 text-ink-300" />
            <p className="mt-3 text-base font-medium">{t("noMatchingVenues")}</p>
          </div>
        ) : (
          <div className="space-y-8">
            {groups.map((group) => (
              <section key={group.city}>
                <div className="mb-3 flex items-baseline gap-2 border-b border-ink-200 pb-2">
                  <h2 className="section-title text-xl sm:text-2xl">
                    {group.city === OTHER ? t("other") : group.city}
                  </h2>
                  <span className="text-xs text-ink-400 sm:text-sm">{group.venues.length}</span>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {group.venues.map(({ venue, index }) => (
                    <VenueTile
                      key={venue.id}
                      venue={venue}
                      locale={locale}
                      index={index}
                      capacityLabel={t("capacity")}
                      personsLabel={t("persons")}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
