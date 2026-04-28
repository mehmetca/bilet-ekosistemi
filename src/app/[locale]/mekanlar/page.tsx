"use client";

import { useEffect, useMemo, useState } from "react";
import { Link } from "@/i18n/navigation";
import Header from "@/components/Header";
import { useTranslations, useLocale } from "next-intl";
import { getLocalizedVenue } from "@/lib/i18n-content";
import { MapPin, Search as SearchIcon, Users } from "lucide-react";
import { supabase } from "@/lib/supabase-client";

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

export default function MekanlarPage() {
  const t = useTranslations("venues");
  const locale = useLocale() as "tr" | "de" | "en";
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCity, setSelectedCity] = useState("__all__");

  useEffect(() => {
    fetchVenues();
  }, []);

  async function fetchVenues() {
    try {
      const { data, error } = await supabase
        .from("venues")
        .select("*")
        .order("city", { ascending: true })
        .order("name", { ascending: true });

      if (error) throw error;

      setVenues(
        (data || []).map((row) => ({
          ...row,
          id: row.id,
          name: row.name,
          address: row.address || null,
          city: row.city || null,
          capacity: row.capacity != null ? Number(row.capacity) : null,
          seating_layout_description: row.seating_layout_description || null,
          seating_layout_image_url: row.seating_layout_image_url || null,
          image_url_1: row.image_url_1 || null,
          image_url_2: row.image_url_2 || null,
          image_url_3: row.image_url_3 || null,
          image_url_4: row.image_url_4 || null,
          image_url_5: row.image_url_5 || null,
          entrance_info: row.entrance_info || null,
          transport_info: row.transport_info || null,
          rules: row.rules || null,
          map_embed_url: row.map_embed_url || null,
          faq: Array.isArray(row.faq)
            ? (row.faq as VenueFaqItem[]).filter((x) => x?.soru && x?.cevap)
            : [],
        }))
      );
    } catch (error) {
      console.error("Mekanlar yüklenemedi:", error);
    } finally {
      setLoading(false);
    }
  }

  const allCities = useMemo(() => {
    const set = new Set<string>();
    for (const v of venues) {
      const localized = getLocalizedVenue(v as unknown as Record<string, unknown>, locale);
      set.add(localized.city || v.city || "__other__");
    }

    const others = set.has("__other__") ? ["__other__"] : [];
    const primary = Array.from(set).filter((c) => c !== "__other__").sort((a, b) => a.localeCompare(b, locale));
    return [...primary, ...others];
  }, [venues, locale]);

  const filteredVenues = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = venues;

    if (selectedCity !== "__all__") {
      list = list.filter((v) => {
        const localized = getLocalizedVenue(v as unknown as Record<string, unknown>, locale);
        return (localized.city || v.city || "__other__") === selectedCity;
      });
    }

    if (q) {
      list = list.filter((v) => {
        const localized = getLocalizedVenue(v as unknown as Record<string, unknown>, locale) as {
          name?: string;
          address?: string | null;
          city?: string | null;
        };

        const haystack = [
          localized?.name ?? v.name,
          localized?.address ?? v.address,
          localized?.city ?? v.city,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      });
    }

    return list;
  }, [venues, search, selectedCity, locale]);

  const venuesByCity = useMemo(() => {
    return filteredVenues.reduce<Record<string, Venue[]>>((acc, v) => {
      const localized = getLocalizedVenue(v as unknown as Record<string, unknown>, locale);
      const city = localized.city || v.city || "__other__";
      if (!acc[city]) acc[city] = [];
      acc[city].push(v);
      return acc;
    }, {});
  }, [filteredVenues, locale]);

  return (
    <div className="min-h-screen bg-[#f5f6f8]">
      <Header />

      <div className="site-container py-12">
        <div className="mb-10 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900">{t("title")}</h1>
          <p className="mt-4 text-lg text-slate-600">
            {t("subtitle")}
          </p>
        </div>

        <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="grid gap-3 md:grid-cols-[1fr_240px] items-end">
            <div>
              <label className="sr-only" htmlFor="venue-search">
                {t("searchPlaceholder")}
              </label>
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  id="venue-search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("searchPlaceholder")}
                  className="w-full rounded-xl border border-slate-300 bg-white px-10 py-2.5 text-sm focus:border-primary-500 focus:ring-primary-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t("filterCity")}</label>
              <select
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-primary-500 focus:ring-primary-500"
              >
                <option value="__all__">{t("allCities")}</option>
                {allCities.map((city) => (
                  <option key={city} value={city}>
                    {city === "__other__" ? t("other") : city}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
          </div>
        ) : venues.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500">
            <MapPin className="mx-auto h-16 w-16 text-slate-300" />
            <p className="mt-4 text-lg font-medium">{t("noVenues")}</p>
          </div>
        ) : filteredVenues.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500">
            <SearchIcon className="mx-auto h-16 w-16 text-slate-300" />
            <p className="mt-4 text-lg font-medium">{t("noMatchingVenues")}</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(venuesByCity).map(([city, cityVenues]) => (
              <section key={city}>
                <h2 className="mb-3 text-lg font-semibold text-slate-800">{city === "__other__" ? t("other") : city}</h2>
                <div className="space-y-1 rounded-xl border border-slate-200 bg-white overflow-hidden">
                  {cityVenues.map((venue) => {
                    const localized = getLocalizedVenue(venue as unknown as Record<string, unknown>, locale);
                    const addr = localized.address || venue.address;
                    const cityName = localized.city || venue.city;
                    const href = `/mekanlar/${venue.id}`;
                    return (
                      <div key={venue.id} className="border-b border-slate-100 last:border-b-0">
                        <Link
                          href={href}
                          className="w-full flex items-center gap-4 px-4 py-4 sm:px-5 sm:py-4 hover:bg-slate-50 transition-colors hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 rounded-xl"
                        >
                          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-lg bg-slate-100 flex-shrink-0 overflow-hidden flex items-center justify-center">
                            {venue.image_url_1 ||
                            venue.image_url_2 ||
                            venue.image_url_3 ||
                            venue.image_url_4 ||
                            venue.image_url_5 ||
                            venue.seating_layout_image_url ? (
                              <img
                                src={
                                  venue.image_url_1 ||
                                  venue.image_url_2 ||
                                  venue.image_url_3 ||
                                  venue.image_url_4 ||
                                  venue.image_url_5 ||
                                  venue.seating_layout_image_url ||
                                  ""
                                }
                                alt={localized.name || venue.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <MapPin className="h-8 w-8 text-slate-400" />
                            )}
                          </div>
                          <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-[15px] sm:text-lg font-semibold text-slate-900 leading-snug truncate">
                                {localized.name || venue.name}
                              </p>
                              {(addr || cityName) && (
                                <p className="mt-1 text-[13px] sm:text-sm text-slate-600 truncate">
                                  {[cityName, addr].filter(Boolean).join(" • ")}
                                </p>
                              )}
                            </div>
                            {venue.capacity != null && (
                              <div className="flex items-center gap-2 text-sm text-slate-600 sm:justify-center sm:min-w-[160px]">
                                <Users className="h-4 w-4 flex-shrink-0" />
                                <span>
                                  {t("capacity")}: {venue.capacity} {t("persons")}
                                </span>
                              </div>
                            )}
                          </div>
                        </Link>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
