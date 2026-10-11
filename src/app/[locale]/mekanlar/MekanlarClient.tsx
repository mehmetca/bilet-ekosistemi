"use client";

import { useMemo, useState } from "react";
import { Link } from "@/i18n/navigation";
import Header from "@/components/Header";
import { useTranslations, useLocale } from "next-intl";
import { getLocalizedVenue } from "@/lib/i18n-content";
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

function venueImage(venue: Venue): string | null {
  return (
    venue.image_url_1 ||
    venue.image_url_2 ||
    venue.image_url_3 ||
    venue.image_url_4 ||
    venue.image_url_5 ||
    venue.seating_layout_image_url
  );
}

export default function MekanlarClient({ initialVenues }: { initialVenues: Venue[] }) {
  const t = useTranslations("venues");
  const locale = useLocale() as "tr" | "de" | "en";
  const [search, setSearch] = useState("");
  const [selectedCity, setSelectedCity] = useState("__all__");

  const localized = useMemo(
    () =>
      initialVenues.map((venue) => {
        const l = getLocalizedVenue(venue as unknown as Record<string, unknown>, locale);
        return {
          venue,
          name: l.name || venue.name,
          address: l.address || venue.address,
          city: l.city || venue.city || "__other__",
        };
      }),
    [initialVenues, locale]
  );

  const citiesWithCount = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of localized) counts.set(item.city, (counts.get(item.city) ?? 0) + 1);
    const named = Array.from(counts.keys())
      .filter((city) => city !== "__other__")
      .sort((a, b) => a.localeCompare(b, locale));
    return counts.has("__other__") ? [...named, "__other__"] : named;
  }, [localized, locale]);

  const grouped = useMemo(() => {
    const term = search.trim().toLowerCase();
    const matched = localized.filter((item) => {
      if (selectedCity !== "__all__" && item.city !== selectedCity) return false;
      if (!term) return true;
      return [item.name, item.address, item.city].filter(Boolean).join(" ").toLowerCase().includes(term);
    });

    const order = selectedCity === "__all__" ? citiesWithCount : [selectedCity];
    const buckets = new Map<string, typeof matched>();
    for (const city of order) buckets.set(city, []);
    for (const item of matched) {
      if (!buckets.has(item.city)) buckets.set(item.city, []);
      buckets.get(item.city)!.push(item);
    }
    return Array.from(buckets.entries())
      .filter(([, list]) => list.length > 0)
      .map(([city, list]) => ({
        city,
        label: city === "__other__" ? t("other") : city,
        venues: list.sort((a, b) => a.name.localeCompare(b.name, locale)),
      }));
  }, [localized, search, selectedCity, citiesWithCount, locale, t]);

  const totalShown = grouped.reduce((sum, section) => sum + section.venues.length, 0);

  return (
    <div className="min-h-screen bg-ink-50">
      <Header />

      <main className="site-container py-6 sm:py-10">
        <div className="mb-4 sm:mb-6 text-center">
          <h1 className="page-title text-3xl sm:text-4xl md:text-5xl">{t("title")}</h1>
          <p className="body-muted mt-2 sm:mt-3 text-base sm:text-lg">{t("subtitle")}</p>
        </div>

        <div className="mb-6 rounded-lg border border-ink-200 bg-white p-3 sm:p-4">
          <div className="flex flex-col gap-2.5 sm:flex-row">
            <div className="relative w-full sm:flex-1">
              <SearchIcon className="pointer-events-none absolute left-3 sm:left-4 top-1/2 h-4 w-4 sm:h-5 sm:w-5 -translate-y-1/2 text-ink-400" />
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
                <option value="__all__">{t("allCities")}</option>
                {citiesWithCount.map((city) => (
                  <option key={city} value={city}>
                    {city === "__other__" ? t("other") : city}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
            </div>
          </div>
        </div>

        {initialVenues.length === 0 ? (
          <div className="rounded-lg border border-ink-200 bg-white p-12 text-center text-ink-500">
            <MapPin className="mx-auto h-16 w-16 text-ink-300" />
            <p className="mt-4 text-lg font-medium">{t("noVenues")}</p>
          </div>
        ) : totalShown === 0 ? (
          <div className="rounded-lg border border-ink-200 bg-white p-12 text-center text-ink-500">
            <SearchIcon className="mx-auto h-16 w-16 text-ink-300" />
            <p className="mt-4 text-lg font-medium">{t("noMatchingVenues")}</p>
          </div>
        ) : (
          <div className="space-y-8">
            {grouped.map((section) => (
              <section key={section.city}>
                <div className="mb-3 flex items-baseline gap-2 border-b border-ink-200 pb-2">
                  <h2 className="section-title text-xl sm:text-2xl">{section.label}</h2>
                  <span className="text-xs text-ink-400 sm:text-sm">{section.venues.length}</span>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {section.venues.map((item, index) => {
                    const { venue } = item;
                    return (
                      <Link
                        key={venue.id}
                        href={`/mekanlar/${venue.id}`}
                        className="group block overflow-hidden rounded-tl-xl rounded-br-xl border-[2px] border-ink-300 bg-white shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-ink-400 hover:shadow-lift"
                      >
                        <div className="relative aspect-[4/3] overflow-hidden bg-ink-100">
                          <CoverImage
                            src={venueImage(venue)}
                            alt={item.name}
                            sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, (max-width: 1279px) 33vw, 25vw"
                            priority={index < 2}
                            zoomOnHover
                            fallback={
                              <div className="absolute inset-0 flex items-center justify-center text-ink-400">
                                <MapPin className="h-8 w-8" />
                              </div>
                            }
                          />
                        </div>
                        <div className="px-3 pb-3 pt-3 text-center sm:px-4 sm:pb-4 sm:pt-4">
                          <h3 className="card-title text-sm line-clamp-1 group-hover:text-gold-700 md:text-base">{item.name}</h3>
                          {item.address && (
                            <p className="mt-1.5 line-clamp-1 text-xs text-ink-500 sm:text-[13px]">{item.address}</p>
                          )}
                          {venue.capacity != null && (
                            <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-ink-600 sm:text-sm">
                              <Users className="h-4 w-4 flex-shrink-0" />
                              {venue.capacity} {t("persons")}
                            </p>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
