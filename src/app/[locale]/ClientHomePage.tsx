"use client";

import { useState, useEffect, useRef } from "react";
import { Link } from "@/i18n/navigation";
import {
  Calendar,
  MapPin,
  Music2,
  Search as SearchIcon,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import Header from "@/components/Header";
import { useHomeSearch } from "@/contexts/HomeSearchContext";
import type { Event } from "@/types/database";
import type { HomeSliderAd } from "@/lib/home-slider-ads";
import { CATEGORY_LABELS, DISPLAY_CATEGORIES } from "@/types/database";
import dynamic from "next/dynamic";
import FeaturedEvents from "@/components/FeaturedEvents";

const AnaHeroSlider = dynamic(() => import("@/components/AnaHeroSlider"), {
  ssr: false,
  loading: () => (
    <div className="h-[58vw] min-h-[240px] max-h-[28rem] animate-pulse bg-slate-100 sm:max-h-[420px]" />
  ),
});
import { formatPrice } from "@/lib/formatPrice";
import { getLocalizedEvent } from "@/lib/i18n-content";
import { formatEventDateDMY, isEventPastByLocalDateTime } from "@/lib/date-utils";
import { resolvePublicImageUrl } from "@/lib/external-image";
import { isEventPubliclyVisible } from "@/lib/event-visibility";
import { isAmedSporEvent, eventDetailPath } from "@/lib/amed-spor-utils";
import CoverImage from "@/components/CoverImage";

function eventDateISO(event: Event): string {
  const d = String(event.date ?? "");
  if (!d) return "";
  return d.includes("T") ? d.split("T")[0]! : d.slice(0, 10);
}

/** Şehir carousel okları — kart genişlikleri CSS ile sabit; DOM ölçümü (forced reflow) gerekmez. */
function getCityCardScrollStep(viewportWidth: number): number {
  const gap = 12;
  if (viewportWidth >= 1280) return 280 + gap;
  if (viewportWidth >= 768) return 250 + gap;
  if (viewportWidth >= 640) return 230 + gap;
  return Math.min(viewportWidth * 0.88, 352) + gap;
}

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

function getNormalizedCityKey(value: string): string {
  return normalizeForSearch(value);
}

function isNearMatch(token: string, candidate: string): boolean {
  if (!token || !candidate) return false;
  if (candidate.includes(token)) return true;
  if (Math.abs(candidate.length - token.length) > 1) return false;

  // Kısa kelimelerde çok gevşek eşleşme yanlış sonuç üretmesin.
  if (token.length < 4 || candidate.length < 4) return false;

  // En fazla 1 karakter hata (ekleme/silme/değiştirme) toleransı.
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

function getLocalISODateString(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function getEventCityLabels(event: Event): string[] {
  const e = event as Event & {
    city?: string | null;
    venues?: Array<{ city?: string }> | { city?: string } | null;
  };

  const candidates: string[] = [];
  const pushCandidate = (value?: string | null) => {
    const candidate = (value || "").trim();
    if (!candidate) return;
    const normalized = candidate.replace(/\s+/g, " ").trim();
    if (!normalized) return;

    const lowered = normalized.toLocaleLowerCase("tr-TR");
    if (!candidates.some((item) => item.toLocaleLowerCase("tr-TR") === lowered)) {
      candidates.push(normalized);
    }
  };

  pushCandidate(e.city);
  
  // Venue.city de kontrol et
  if (e.venues) {
    if (Array.isArray(e.venues)) {
      e.venues.forEach((venue) => {
        if (venue?.city) pushCandidate(venue.city);
      });
    } else if (typeof e.venues === "object" && e.venues !== null && "city" in e.venues) {
      pushCandidate((e.venues as { city?: string }).city);
    }
  }
  
  return candidates;
}

function formatLocalDateDMY(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

function parseDMYToISODateString(input: string): string | null {
  const s = input.trim();
  const match = /^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/.exec(s);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (!year || !month || !day) return null;

  const dt = new Date(year, month - 1, day);
  // Geçersiz gün/ay kontrolü (ör. 31.02)
  if (dt.getFullYear() !== year || dt.getMonth() !== month - 1 || dt.getDate() !== day) return null;
  return getLocalISODateString(dt);
}

interface City {
  id: string;
  slug: string;
  name_tr?: string | null;
  name_de?: string | null;
  name_en?: string | null;
  image_url?: string | null;
  sort_order?: number | null;
}

interface ClientHomePageProps {
  initialEvents?: Event[];
  initialCities?: City[];
  initialSliderAds?: HomeSliderAd[];
  /** Header page.tsx içinde */
  hideHeader?: boolean;
}

export default function ClientHomePage({
  initialEvents = [],
  initialCities = [],
  initialSliderAds,
  hideHeader = false,
}: ClientHomePageProps) {
  const t = useTranslations("home");
  const tCalendar = useTranslations("calendar");
  const locale = useLocale();
  const { searchTerm, setSearchTerm } = useHomeSearch();
  const [selectedCity, setSelectedCity] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  /** YYYY-MM-DD; boş = tarih filtresi yok (tarih bazlı daraltma kapalı) */
  const [eventDate, setEventDate] = useState("");
  /** true olduğunda tarih filtresi aktif olur (eventDate'a göre eşleştirir) */
  const [isDateFilterActive, setIsDateFilterActive] = useState(false);
  const [eventDateInput, setEventDateInput] = useState(() => formatLocalDateDMY(new Date()));
  const [sortBy, setSortBy] = useState<"yaklasan" | "populer">("yaklasan");
  const [events, setEvents] = useState<Event[]>(() =>
    initialEvents.filter((e) => isEventPubliclyVisible(e))
  );
  const [cities, setCities] = useState<City[]>(initialCities);
  const cityScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Taslak / onaysız etkinlikler ana sayfada asla listelenmez.
    setEvents(initialEvents.filter((e) => isEventPubliclyVisible(e)));
    setCities(initialCities);
  }, [initialEvents, initialCities]);

  const isEventPast = (event: Event) => isEventPastByLocalDateTime(event.date, event.time);

  const sortedEvents = [...(events || [])].sort((a, b) => {
    const aCreated = new Date(a.created_at).getTime();
    const bCreated = new Date(b.created_at).getTime();
    if (bCreated !== aCreated) return bCreated - aCreated;

    const aDate = new Date(`${a.date} ${a.time || "00:00"}`).getTime();
    const bDate = new Date(`${b.date} ${b.time || "00:00"}`).getTime();
    return bDate - aDate;
  });

  // "Yaklaşan" listede gerçekten bitmemiş etkinlikleri göster.
  // Böylece etkinlik biter bitmez ana sayfada "biten" tarafına düşer.
  const upcomingEvents = sortedEvents.filter(
    (event) => !isEventPast(event) && isEventPubliclyVisible(event as Event & { is_active?: boolean })
  );
  // Şehir listesi: tekrarsız, virgülden önceki kısım + büyük/küçük harf farkı birleştirilir (örn. 3x Berlin → 1)
  const cityOptions = (() => {
    const byKey = new Map<string, string>();

    upcomingEvents.forEach((event) => {
      const cityNames = getEventCityLabels(event);
      cityNames.forEach((cityName) => {
        const normalized = cityName.trim();
        const key = getNormalizedCityKey(normalized);
        if (!key) return;
        if (!byKey.has(key)) byKey.set(key, normalized);
      });
    });

    return Array.from(byKey.values()).sort((a, b) => a.localeCompare(b, "tr"));
  })();

  // Tüm çok dilli alanlarda ara (title, title_tr, title_de, title_en, venue, venue_tr, venue_de, venue_en)
  const getSearchableText = (event: Event) => {
    const e = event as Event & { city?: string | null; address?: string | null };
    const parts = [
      event.title,
      event.slug,
      (event as Event & { show_slug?: string | null }).show_slug,
      (event as Event & { title_tr?: string }).title_tr,
      (event as Event & { title_de?: string }).title_de,
      (event as Event & { title_en?: string }).title_en,
      (event as Event & { title_ku?: string }).title_ku,
      (event as Event & { title_ckb?: string }).title_ckb,
      event.venue,
      (event as Event & { venue_tr?: string }).venue_tr,
      (event as Event & { venue_de?: string }).venue_de,
      (event as Event & { venue_en?: string }).venue_en,
      event.location,
      e.city,
      e.address,
    ].filter(Boolean) as string[];
    return normalizeForSearch(parts.join(" "));
  };

  const filteredEventsRaw = upcomingEvents.filter((event) => {
    const term = normalizeForSearch(searchTerm.trim());
    const termTokens = term ? term.split(" ").filter(Boolean) : [];
    const searchableText = getSearchableText(event);
    const searchableWords = searchableText.split(" ").filter(Boolean);
    const matchesSearch =
      termTokens.length === 0 ||
      termTokens.every(
        (token) =>
          searchableText.includes(token) ||
          searchableWords.some((w) => isNearMatch(token, w))
      );

    const eventCityNames = getEventCityLabels(event);
    const matchesCity =
      selectedCity === "all" ||
      eventCityNames.some((cityName) => {
        const normalizedEventCity = getNormalizedCityKey(cityName);
        const normalizedSelectedCity = getNormalizedCityKey(selectedCity);
        
        // Tam eşleşme
        if (normalizedEventCity === normalizedSelectedCity) return true;
        
        // Kısmi eşleşme: seçilen şehir adı, etkinlik şehir adını içeriyor veya tam tersi
        // Örn: "Diyarbakır - Amed" seçiliyken, etkinlikte "Diyarbakır" veya "Amed" yazıyorsa eşleş
        if (normalizedEventCity.includes(normalizedSelectedCity) || normalizedSelectedCity.includes(normalizedEventCity)) {
          return true;
        }
        
        // Tire ile ayrılmış parçaları kontrol et
        const selectedParts = selectedCity.toLowerCase().split(/[-–/]/).map(p => p.trim()).filter(Boolean);
        const eventParts = cityName.toLowerCase().split(/[-–/]/).map(p => p.trim()).filter(Boolean);
        
        // Seçilen şehirin herhangi bir parçası, etkinlik şehrinin herhangi bir parçasıyla eşleşiyorsa
        return selectedParts.some(sp => 
          eventParts.some(ep => ep.includes(sp) || sp.includes(ep))
        );
      });
    const matchesCategory = selectedCategory === "all" || event.category === selectedCategory;

    const matchesEventDate = !isDateFilterActive || eventDateISO(event) === eventDate;

    return matchesSearch && matchesCity && matchesCategory && matchesEventDate;
  });

  const filteredEvents = [...filteredEventsRaw].sort((a, b) => {
    if (sortBy === "yaklasan") {
      const aDate = new Date(`${a.date} ${a.time || "00:00"}`).getTime();
      const bDate = new Date(`${b.date} ${b.time || "00:00"}`).getTime();
      return aDate - bDate;
    }
    if (sortBy === "populer") {
      const aCreated = new Date(a.created_at).getTime();
      const bCreated = new Date(b.created_at).getTime();
      return bCreated - aCreated;
    }
    return 0;
  });

  // Aynı gösteri/tur: yalnızca ortak show_slug varsa tek kart; slug yoksa her etkinlik ayrı görünür.
  // İstisna: Amed Spor etkinlikleri aynı şehirde farklı tarihlerdir; her biri ayrı kart olarak listelensin.
  const MAX_PER_SHOW = 1;
  const displayEvents = (() => {
    const countBySlug = new Map<string, number>();
    return filteredEvents.filter((event) => {
      const slug = String((event as Event & { show_slug?: string }).show_slug || "").trim();
      if (!slug) return true;
      if (isAmedSporEvent(slug)) return true;
      const count = countBySlug.get(slug) || 0;
      if (count >= MAX_PER_SHOW) return false;
      countBySlug.set(slug, count + 1);
      return true;
    });
  })();
  const hasActiveFilters =
    searchTerm.trim().length > 0 ||
    selectedCity !== "all" ||
    selectedCategory !== "all" ||
    isDateFilterActive;

  // Etkinlik durumunu kontrol et
  const getEventStatus = (event: Event) => {
    const eventDateTime = new Date(event.date + ' ' + (event.time || '00:00'));
    const now = new Date();
    const isPast = eventDateTime < now;
    
    return {
      isPast,
      statusText: isPast ? t("eventStatusEnded") : t("eventStatusActive"),
      statusColor: isPast ? 'text-red-600 bg-red-50' : 'text-green-600 bg-green-50'
    };
  };

  return (
    <>
      {!hideHeader ? (
        <div className="min-h-screen bg-slate-50">
          <Header />
        </div>
      ) : null}

      {/* Ana Slider: Slider'lar alanına taşındı */}

      {/* Slider'lar */}
      <section className="site-container py-12">
        <div className="min-h-[calc(min(62.5vw,28rem)_+_4.75rem)] overflow-hidden rounded-xl border border-slate-200 bg-white sm:min-h-[calc(min(48vw,420px)_+_4.75rem)] lg:min-h-[calc(min(36vw,520px)_+_4.75rem)] xl:min-h-[calc(min(30vw,560px)_+_4.75rem)]">
          <div className="p-6 pb-4">
            <h2 className="text-xl font-bold text-slate-900">{t("upcomingEvents")}</h2>
          </div>
          <div className="border-t border-slate-200">
            <AnaHeroSlider placement="main_slider" initialAds={initialSliderAds} />
          </div>
        </div>

        {/* Şehirler - Yaklaşan etkinlikler ve Haberler slider'larının altında */}
        {cities.length > 0 && (
          <div className="mt-12">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <h2 className="text-2xl font-bold text-slate-900">{t("inYourCity")}</h2>
              <Link
                href="/sehirler"
                className="text-primary-600 font-semibold hover:text-primary-700 hover:underline"
              >
                {t("viewAllCities")} →
              </Link>
            </div>
            <div className="relative -mx-4 md:-mx-4">
              <button
                type="button"
                onClick={() => {
                  const el = cityScrollRef.current;
                  if (!el) return;
                  const step = getCityCardScrollStep(window.innerWidth);
                  el.scrollBy({ left: -step, behavior: "smooth" });
                }}
                className="absolute left-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/20 text-white backdrop-blur-sm transition-all hover:bg-black/35 md:left-4"
                aria-label="Önceki"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                type="button"
                onClick={() => {
                  const el = cityScrollRef.current;
                  if (!el) return;
                  const step = getCityCardScrollStep(window.innerWidth);
                  el.scrollBy({ left: step, behavior: "smooth" });
                }}
                className="absolute right-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/20 text-white backdrop-blur-sm transition-all hover:bg-black/35 md:right-4"
                aria-label="Sonraki"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
              <div
                ref={cityScrollRef}
                className="flex gap-3 overflow-x-auto scroll-smooth pb-2 scrollbar-hide snap-x snap-mandatory"
              >
                {cities.map((city) => {
                  const name = (locale === "de" ? city.name_de : locale === "en" ? city.name_en : city.name_tr) || city.name_tr || city.name_de || city.name_en || city.slug;
                  const cityImageSrc = resolvePublicImageUrl(city.image_url);
                  return (
                    <Link
                      key={city.id}
                      href={`/city/${city.slug}`}
                      className="group flex flex-shrink-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all hover:shadow-lg hover:border-primary-200 snap-center w-[min(88vw,22rem)] max-w-[min(88vw,22rem)] sm:min-w-[230px] sm:max-w-[230px] sm:w-[230px] md:min-w-[250px] md:max-w-[250px] md:w-[250px] xl:min-w-[280px] xl:max-w-[280px] xl:w-[280px]"
                    >
                      <div className="relative aspect-[16/9] overflow-hidden bg-slate-100">
                        <CoverImage
                          src={cityImageSrc}
                          alt={name}
                          sizes="(max-width: 640px) 88vw, 280px"
                          zoomOnHover
                          fallback={
                            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary-100 to-primary-50">
                              <MapPin className="h-12 w-12 text-primary-400" />
                            </div>
                          }
                        />
                      </div>
                      <div className="py-3 text-center">
                        <h3 className="font-semibold text-slate-900 group-hover:text-primary-600">{name}</h3>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Öne çıkan etkinlikler (EventSeat – 2 etkinlik yan yana) */}
      <FeaturedEvents
        events={events}
        locale={locale as "tr" | "de" | "en"}
        title={t("featuredEvents")}
      />

      {/* Events */}
      <section id="events" className="site-container py-16">
        <h2 className="text-2xl font-bold text-slate-900 mb-4">{t("upcomingEvents")}</h2>
        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6 [&>*]:min-w-0">
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t("searchPlaceholder")}
                aria-label={t("searchPlaceholder")}
                className="h-10 w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-2 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              aria-label={t("filters.allCities")}
              className="h-10 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm text-slate-900"
            >
              <option value="all">{t("filters.allCities")}</option>
              {cityOptions.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              aria-label={t("filters.allCategories")}
              className="h-10 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm text-slate-900"
            >
              <option value="all">{t("filters.allCategories")}</option>
              {DISPLAY_CATEGORIES.map((key) => (
                <option key={key} value={key}>
                  {CATEGORY_LABELS[key]}
                </option>
              ))}
            </select>
            <input
              type="text"
              inputMode="numeric"
              value={eventDateInput}
              onChange={(e) => {
                const v = e.target.value;
                if (!v.trim()) {
                  // Kullanıcı alanı boşaltırsa tekrar bugünü gösterelim.
                  setEventDateInput(formatLocalDateDMY(new Date()));
                  setEventDate("");
                  setIsDateFilterActive(false);
                  return;
                }
                setEventDateInput(v);
                const iso = parseDMYToISODateString(v);
                if (iso) {
                  setEventDate(iso);
                  setIsDateFilterActive(true);
                } else {
                  setEventDate("");
                  setIsDateFilterActive(false);
                }
              }}
              aria-label={t("filters.eventDate")}
              placeholder={tCalendar("datePlaceholder")}
              className="h-10 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm text-slate-900"
            />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "yaklasan" | "populer")}
              aria-label={t("filters.sort")}
              className="h-10 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm text-slate-900"
            >
              <option value="yaklasan">{t("sortBy.upcoming")}</option>
              <option value="populer">{t("sortBy.popular")}</option>
            </select>
            <button
              type="button"
              onClick={() => {
                setSortBy("yaklasan");
                setSelectedCity("all");
                setSelectedCategory("all");
                setEventDate("");
                setIsDateFilterActive(false);
                setEventDateInput(formatLocalDateDMY(new Date()));
              }}
              className="h-10 w-full rounded-lg border border-slate-300 bg-white px-2 text-xs font-medium text-slate-700 hover:bg-slate-50 sm:text-sm leading-tight"
            >
              {t("filters.clear")}
            </button>
          </div>
        </div>
        
        {displayEvents.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500">
            {events.length === 0 ? (
              <>
                <Music2 className="h-16 w-16 mx-auto text-slate-300 mb-4" />
                <p className="text-lg font-medium">{t("noEvents")}</p>
                <p className="mt-2 text-sm">{t("noEventsSlider")}</p>
              </>
            ) : hasActiveFilters ? (
              <p className="text-lg font-medium">{t("noEventsForFilter")}</p>
            ) : (
              <p className="text-lg font-medium">{t("noEventsSlider")}</p>
            )}
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {displayEvents.map((event) => {
              const eventStatus = getEventStatus(event);
              const localized = getLocalizedEvent(event as unknown as Record<string, unknown>, locale as "tr" | "de" | "en");
              
              return (
                <div
                  key={event.id}
                  className={`overflow-hidden rounded-2xl border shadow-sm hover:shadow-lg transition-shadow ${
                    eventStatus.isPast 
                      ? 'bg-slate-50 border-slate-300 opacity-75' 
                      : 'bg-white border-slate-200'
                  }`}
                >
                  <Link href={`/${locale}${eventDetailPath((event as Event & { show_slug?: string }).show_slug, event.id)}`}>
                    <div className="aspect-video bg-gradient-to-br from-primary-100 to-primary-50 flex items-center justify-center overflow-hidden cursor-pointer relative">
                      <CoverImage
                        src={event.image_url}
                        alt={localized.title}
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                        fallback={<Music2 className="h-16 w-16 text-primary-400" />}
                      />
                      
                      {/* Durum Göstergesi */}
                      {eventStatus.isPast && (
                        <div className="absolute top-2 right-2">
                          <span className="px-2 py-1 text-xs font-medium text-red-600 bg-red-500/20 backdrop-blur-sm rounded">
                            {eventStatus.statusText}
                          </span>
                        </div>
                      )}

                      {/* Biten etkinliklerde belirgin etiket */}
                      {eventStatus.isPast && (
                        <div className="absolute left-2 top-2">
                          <span className="px-2 py-1 text-xs font-bold text-white bg-red-600 rounded">
                            {t("eventEnded")}
                          </span>
                        </div>
                      )}

                    </div>
                  </Link>
                  
                  <div className="p-5">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-medium text-primary-600">
                          {CATEGORY_LABELS[event.category as keyof typeof CATEGORY_LABELS] ?? event.category ?? "Etkinlik"}
                        </span>
                        {eventStatus.isPast && (
                          <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded">
                            {t("eventEnded")}
                          </span>
                        )}
                      </div>
                      <h3 className={`font-semibold line-clamp-1 mb-2 ${
                        eventStatus.isPast ? 'text-slate-600' : 'text-slate-900'
                      }`}>
                        {localized.title}
                      </h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 flex-shrink-0" />
                          <span className={
                            eventStatus.isPast ? 'text-slate-500' : 'text-slate-600'
                          }>
                            {new Date(event.date).toLocaleDateString("tr-TR")} • {event.time}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 flex-shrink-0" />
                          <span className={
                            eventStatus.isPast ? 'text-slate-500' : 'text-slate-600'
                          }>
                            {localized.venue || event.venue}, {(event as Event & { city?: string | null }).city || event.location}
                          </span>
                        </div>
                      </div>
                      {eventStatus.isPast && (
                        <p className="mt-3 text-xs font-medium text-red-600">
                          {t("eventEndedBanner")}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="px-5 pb-5 border-t border-slate-100">
                    <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center pt-3">
                      <span className={`font-bold text-lg ${
                        eventStatus.isPast ? 'text-slate-500' : 'text-primary-600'
                      }`}>
                        {event.show_slug && isAmedSporEvent(event.show_slug)
                          ? null
                          : Number(event.price_from) > 0
                            ? `${t("from")} ${formatPrice(Number(event.price_from), event.currency)}`
                            : t("free")}
                      </span>
                      <button
                        onClick={() => {
                          if (eventStatus.isPast) {
                            alert(t("eventEndedAlert"));
                            return;
                          }
                          window.location.href = `/${locale}${eventDetailPath((event as Event & { show_slug?: string }).show_slug, event.id)}`;
                        }}
                        className={`text-sm font-medium flex items-center justify-center gap-1 px-3 py-2.5 rounded-lg transition-colors w-full sm:w-auto ${
                          eventStatus.isPast
                            ? 'text-slate-500 bg-slate-100 cursor-not-allowed'
                            : 'text-primary-600 hover:text-primary-700 bg-primary-50 hover:bg-primary-100'
                        }`}
                      >
                        {eventStatus.isPast ? t("buyTicketDisabled") : t("buyTicket")}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </section>
    </>
  );
}
