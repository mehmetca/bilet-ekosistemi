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
import { DISPLAY_CATEGORIES } from "@/types/database";
import dynamic from "next/dynamic";
import FeaturedEvents from "@/components/FeaturedEvents";

const AnaHeroSlider = dynamic(() => import("@/components/AnaHeroSlider"), {
  ssr: false,
  loading: () => (
    <div className="aspect-[16/7] w-full animate-pulse bg-ink-100 sm:max-h-[480px] lg:aspect-[16/6] lg:max-h-[560px] xl:max-h-[640px]" />
  ),
});
import { formatPrice } from "@/lib/formatPrice";
import { getLocalizedEvent } from "@/lib/i18n-content";
import { formatEventLongDateTime, isEventPastByLocalDateTime } from "@/lib/date-utils";
import { resolvePublicImageUrl } from "@/lib/external-image";
import { isEventPubliclyVisible } from "@/lib/event-visibility";
import { isAmedSporEvent, eventDetailPath } from "@/lib/amed-spor-utils";
import CoverImage from "@/components/CoverImage";
import SectionTitle from "@/components/ui/SectionTitle";
import { badgeClass } from "@/components/ui/Badge";
import { cardClass } from "@/components/ui/Card";
import { buttonClass } from "@/components/ui/Button";
import { inputClass } from "@/components/ui/Field";
import { cn } from "@/components/ui/cn";

type UiLocale = "tr" | "de" | "en" | "ku" | "ckb";

function eventDateISO(event: Event): string {
  const d = String(event.date ?? "");
  if (!d) return "";
  return d.includes("T") ? d.split("T")[0]! : d.slice(0, 10);
}

/** Şehir carousel okları — kart genişlikleri CSS ile sabit; DOM ölçümü (forced reflow) gerekmez. */
function getCityCardScrollStep(viewportWidth: number): number {
  const gap = 12;
  if (viewportWidth >= 1280) return 260 + gap;
  if (viewportWidth >= 768) return 230 + gap;
  if (viewportWidth >= 640) return 210 + gap;
  return Math.min(viewportWidth * 0.84, 320) + gap;
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
  const tCat = useTranslations("categories");
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
        <div className="min-h-screen bg-paper">
          <Header />
        </div>
      ) : null}

      {/* Ana Slider: Slider'lar alanına taşındı */}

      {/* Slider'lar */}
      <section className="site-container py-8 sm:py-10">
        <div className="overflow-hidden rounded-lg border border-ink-200 bg-white shadow-card">
          <div className="px-5 pb-3 pt-5 sm:px-6 sm:pb-4 sm:pt-6">
            <h2 className="font-display text-xl font-semibold tracking-tight text-ink-900">
              {t("upcomingEvents")}
            </h2>
          </div>
          <span className="hairline" aria-hidden />
          <AnaHeroSlider placement="main_slider" initialAds={initialSliderAds} />
        </div>

        {/* Şehirler - Yaklaşan etkinlikler ve Haberler slider'larının altında */}
        {cities.length > 0 && (
          <div className="mt-10 md:mt-12">
            <SectionTitle
              title={t("inYourCity")}
              action={
                <Link
                  href="/sehirler"
                  className="text-sm font-semibold text-gold-700 transition-colors hover:text-gold-900 hover:underline"
                >
                  {t("viewAllCities")} →
                </Link>
              }
            />
            <div className="relative -mx-4 md:-mx-4">
              <button
                type="button"
                onClick={() => {
                  const el = cityScrollRef.current;
                  if (!el) return;
                  const step = getCityCardScrollStep(window.innerWidth);
                  el.scrollBy({ left: -step, behavior: "smooth" });
                }}
                className="absolute left-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md bg-gold-500 text-ink-950 transition-colors hover:bg-gold-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500/70 md:left-4"
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
                className="absolute right-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md bg-gold-500 text-ink-950 transition-colors hover:bg-gold-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500/70 md:right-4"
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
                  const isSelectedCity =
                    selectedCity !== "all" &&
                    getNormalizedCityKey(name) === getNormalizedCityKey(selectedCity);
                  return (
                    <Link
                      key={city.id}
                      href={`/city/${city.slug}`}
                      className={cn(
                        cardClass({ hover: true }),
                        "group flex w-[min(84vw,20rem)] max-w-[min(84vw,20rem)] flex-shrink-0 snap-center flex-col overflow-hidden sm:w-[210px] sm:max-w-[210px] md:w-[230px] md:max-w-[230px] xl:w-[260px] xl:max-w-[260px]",
                        isSelectedCity && "border-gold-500 ring-1 ring-gold-500/40"
                      )}
                    >
                      <div className="relative aspect-[16/9] overflow-hidden bg-ink-100">
                        <CoverImage
                          src={cityImageSrc}
                          alt={name}
                          sizes="(max-width: 640px) 84vw, 260px"
                          zoomOnHover
                          fallback={
                            <div className="flex h-full w-full items-center justify-center bg-ink-100">
                              <MapPin className="h-12 w-12 text-ink-300" />
                            </div>
                          }
                        />
                      </div>
                      <div className="flex items-center justify-center gap-2 border-t border-ink-200 px-3 py-3 text-center">
                        <h3 className="font-display text-base font-semibold text-ink-900 transition-colors group-hover:text-gold-700">
                          {name}
                        </h3>
                        {isSelectedCity && (
                          <span className="rule-gold w-6 shrink-0" aria-hidden />
                        )}
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
      <section id="events" className="site-container py-10 sm:py-12">
        <SectionTitle title={t("upcomingEvents")} />
        <div className="mb-6 rounded-lg border border-ink-200 bg-white p-3 shadow-card">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6 [&>*]:min-w-0">
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t("searchPlaceholder")}
                aria-label={t("searchPlaceholder")}
                className={inputClass("pl-9")}
              />
            </div>
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              aria-label={t("filters.allCities")}
              className={inputClass()}
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
              className={inputClass()}
            >
              <option value="all">{t("filters.allCategories")}</option>
              {DISPLAY_CATEGORIES.map((key) => (
                <option key={key} value={key}>
                  {tCat(key)}
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
              className={inputClass()}
            />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "yaklasan" | "populer")}
              aria-label={t("filters.sort")}
              className={inputClass()}
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
              className={buttonClass({ variant: "outline", size: "sm", className: "h-11 w-full" })}
            >
              {t("filters.clear")}
            </button>
          </div>
        </div>
        
        {displayEvents.length === 0 ? (
          <div className="rounded-lg border border-ink-200 bg-white p-12 text-center shadow-card">
            {events.length === 0 ? (
              <>
                <Music2 className="mx-auto mb-4 h-16 w-16 text-gold-500" />
                <p className="font-display text-xl font-semibold text-ink-900">{t("noEvents")}</p>
                <p className="mt-2 text-sm text-ink-500">{t("noEventsSlider")}</p>
              </>
            ) : hasActiveFilters ? (
              <p className="font-display text-xl font-semibold text-ink-900">{t("noEventsForFilter")}</p>
            ) : (
              <p className="font-display text-xl font-semibold text-ink-900">{t("noEventsSlider")}</p>
            )}
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {displayEvents.map((event) => {
              const eventStatus = getEventStatus(event);
              const localized = getLocalizedEvent(event as unknown as Record<string, unknown>, locale as "tr" | "de" | "en");
              const when = formatEventLongDateTime(event.date, event.time, locale as UiLocale);

              return (
                <div
                  key={event.id}
                  className={cn(
                    cardClass({ hover: !eventStatus.isPast }),
                    "group flex flex-col overflow-hidden",
                    eventStatus.isPast && "bg-ink-50"
                  )}
                >
                  <Link
                    href={`/${locale}${eventDetailPath((event as Event & { show_slug?: string }).show_slug, event.id)}`}
                    className="relative block"
                  >
                    <div className="relative aspect-[3/4] overflow-hidden bg-ink-100">
                      <CoverImage
                        src={event.image_url}
                        alt={localized.title}
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                        imageClassName={
                          eventStatus.isPast
                            ? "object-cover object-top opacity-60 grayscale"
                            : "object-cover object-top transition-transform duration-500 group-hover:scale-[1.03]"
                        }
                        fallback={
                          <div className="flex h-full w-full items-center justify-center bg-ink-100">
                            <Music2 className="h-16 w-16 text-ink-300" />
                          </div>
                        }
                      />
                      <span className="poster-scrim pointer-events-none absolute inset-0" aria-hidden />

                      <span className={badgeClass(eventStatus.isPast ? "muted" : "goldOnDark", "absolute left-3 top-3")}>
                        {event.category ? tCat(event.category) : "Etkinlik"}
                      </span>

                      {eventStatus.isPast && (
                        <span className={badgeClass("danger", "absolute right-3 top-3")}>
                          {eventStatus.statusText}
                        </span>
                      )}

                      {eventStatus.isPast && (
                        <span className={badgeClass("muted", "absolute left-3 top-11")}>
                          {t("eventEnded")}
                        </span>
                      )}

                      {/* Afiş tarih damgası: serif gün + altın ay */}
                      <span className="absolute bottom-3 left-3 flex flex-col" aria-hidden>
                        <span className="font-display text-2xl leading-none text-white">
                          {when.dayNum}
                        </span>
                        <span className="mt-1 text-[10px] uppercase tracking-widest2 text-gold-300">
                          {when.monthShort}
                        </span>
                      </span>
                    </div>
                  </Link>

                  <div className="flex flex-1 flex-col p-4">
                    <h3
                      className={cn(
                        "line-clamp-2 font-display text-lg leading-snug transition-colors group-hover:text-gold-700",
                        eventStatus.isPast ? "text-ink-500" : "text-ink-900"
                      )}
                    >
                      {localized.title}
                    </h3>
                    <div className="mt-2 space-y-1.5 text-sm">
                      <div className="flex items-start gap-2">
                        <Calendar className="mt-0.5 h-4 w-4 flex-shrink-0 text-ink-400" aria-hidden />
                        <span className={eventStatus.isPast ? "text-ink-500" : "text-ink-600"}>
                          {when.lineLong}
                        </span>
                      </div>
                      <div className="flex items-start gap-2">
                        <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-ink-400" aria-hidden />
                        <span className={eventStatus.isPast ? "text-ink-500" : "text-ink-600"}>
                          {localized.venue || event.venue}, {(event as Event & { city?: string | null }).city || event.location}
                        </span>
                      </div>
                    </div>
                    {eventStatus.isPast && (
                      <p className="mt-3 text-xs font-medium text-red-700">
                        {t("eventEndedBanner")}
                      </p>
                    )}

                    <div className="mt-auto pt-4">
                      <span className="hairline mb-3" aria-hidden />
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <span
                          className={cn(
                            "text-lg font-semibold",
                            eventStatus.isPast ? "text-ink-500" : "text-ink-900"
                          )}
                        >
                          {Number(event.price_from) > 0 ? (
                            <>
                              <span className="mr-1 text-sm font-normal text-ink-500">{t("from")}</span>
                              {formatPrice(Number(event.price_from), event.currency)}
                            </>
                          ) : (
                            t("free")
                          )}
                        </span>
                        <button
                          onClick={() => {
                            if (eventStatus.isPast) {
                              alert(t("eventEndedAlert"));
                              return;
                            }
                            window.location.href = `/${locale}${eventDetailPath((event as Event & { show_slug?: string }).show_slug, event.id)}`;
                          }}
                          className={buttonClass({
                            variant: eventStatus.isPast ? "outline" : "primary",
                            size: "md",
                            className: cn(
                              "w-full sm:w-auto",
                              eventStatus.isPast && "cursor-not-allowed"
                            ),
                          })}
                        >
                          {eventStatus.isPast ? t("buyTicketDisabled") : t("buyTicket")}
                        </button>
                      </div>
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
