"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "@/i18n/navigation";
import { Calendar, MapPin, Music2, Search, ExternalLink, CheckCircle, Shield, Clock, Database, ChevronRight, ChevronLeft } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import Header from "@/components/Header";
import HeroBackgroundSlider from "@/components/HeroBackgroundSlider";
import type { Event, News } from "@/types/database";
import { CATEGORY_LABELS, DISPLAY_CATEGORIES } from "@/types/database";
import EventSlider from "@/components/EventSlider";
import NewsSlider from "@/components/NewsSlider";
import { parseEventDescription } from "@/lib/eventMeta";
import { formatPrice } from "@/lib/formatPrice";
import { getLocalizedEvent } from "@/lib/i18n-content";
import { parseDateInput } from "@/lib/date-utils";

interface HeroBg {
  id: string;
  title: string;
  image_url: string;
  is_active: boolean;
  sort_order: number;
  transition_duration: number;
}

interface City {
  id: string;
  slug: string;
  name_tr?: string | null;
  name_de?: string | null;
  name_en?: string | null;
  image_url?: string | null;
}

interface ClientHomePageProps {
  initialEvents?: Event[];
  initialNews?: News[];
  initialHeroBackgrounds?: HeroBg[];
  initialCities?: City[];
}

export default function ClientHomePage({
  initialEvents = [],
  initialNews = [],
  initialHeroBackgrounds = [],
  initialCities = [],
}: ClientHomePageProps) {
  const t = useTranslations("home");
  const locale = useLocale();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCity, setSelectedCity] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sortBy, setSortBy] = useState<"yaklasan" | "en-ucuz" | "populer">("yaklasan");
  const [events, setEvents] = useState<Event[]>(initialEvents);
  const [news, setNews] = useState<News[]>(initialNews);
  const [cities, setCities] = useState<City[]>(initialCities);
  const cityScrollRef = useRef<HTMLDivElement>(null);
  const [heroVariant, setHeroVariant] = useState<{
    variant: string;
    hero_title: string;
    hero_subtitle: string;
    cta_text: string;
  } | null>(null);
  const isMountedRef = useRef(true);
  const fallbackImage =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 450'%3E%3Crect width='800' height='450' fill='%23e2e8f0'/%3E%3Cg fill='%2364748b'%3E%3Ccircle cx='330' cy='190' r='36'/%3E%3Cpath d='M220 330l95-95 70 70 55-55 140 140H220z'/%3E%3C/g%3E%3C/svg%3E";

  // Sayfa geri dönüşünde (pageshow) hafif yenileme - ilk yükleme server'dan gelir
  const fetchData = useCallback(async () => {
    const { supabase } = await import("@/lib/supabase-client");
    try {
      const [eventsRes, newsRes, citiesRes] = await Promise.all([
        supabase.from("events").select("*").eq("is_active", true).order("created_at", { ascending: false }),
        supabase.from("news").select("*").eq("is_published", true).order("published_at", { ascending: false }).limit(5),
        supabase.from("cities").select("id, slug, name_tr, name_de, name_en, image_url").eq("is_active", true).order("sort_order", { ascending: true }),
      ]);
      if (isMountedRef.current) {
        if (!eventsRes.error) setEvents(eventsRes.data || []);
        if (!newsRes.error) setNews(newsRes.data || []);
        if (!citiesRes.error) setCities(citiesRes.data || []);
      }
    } catch {
      /* ignore */
    }
  }, []);

  // A/B test: Hero varyantı (session bazlı cache)
  useEffect(() => {
    const key = "hero_ab_variant";
    try {
      const cached = sessionStorage.getItem(key);
      if (cached) {
        const parsed = JSON.parse(cached) as { variant: string; hero_title: string; hero_subtitle: string; cta_text: string };
        setHeroVariant(parsed);
        return;
      }
    } catch {
      /* ignore */
    }
    fetch("/api/ab/variant")
      .then(async (r) => {
        if (!r.ok) throw new Error("Variant fetch failed");
        return r.json();
      })
      .then((data) => {
        if (!data || typeof data !== "object") return;
        const v = {
          variant: data.variant || "A",
          hero_title: data.hero_title || "Hayalinizdaki Etkinliğe Bilet Bulun",
          hero_subtitle: data.hero_subtitle || "Konser, tiyatro, stand-up ve daha fazlası. Güvenli ödeme ile kolayca bilet alın.",
          cta_text: data.cta_text || "Ara",
        };
        setHeroVariant(v);
        try {
          sessionStorage.setItem(key, JSON.stringify(v));
        } catch {
          /* ignore */
        }
      })
      .catch(() => {
        setHeroVariant({
          variant: "A",
          hero_title: "Hayalinizdaki Etkinliğe Bilet Bulun",
          hero_subtitle: "Konser, tiyatro, stand-up ve daha fazlası. Güvenli ödeme ile kolayca bilet alın.",
          cta_text: "Ara",
        });
      });
  }, []);

  // Şehir bölümü: sayfa yüklendiğinde rastgele bir şehre scroll
  useEffect(() => {
    if (cities.length <= 1 || !cityScrollRef.current) return;
    const el = cityScrollRef.current;
    const randomIndex = Math.floor(Math.random() * cities.length);
    const scrollToRandom = () => {
      const first = el.querySelector("a");
      if (first) {
        const card = first as HTMLElement;
        const gap = 12;
        const cardWidth = card.offsetWidth + gap;
        const targetLeft = Math.min(randomIndex * cardWidth, el.scrollWidth - el.clientWidth);
        el.scrollTo({ left: targetLeft, behavior: "auto" });
      }
    };
    scrollToRandom();
    const t = window.setTimeout(scrollToRandom, 100);
    return () => clearTimeout(t);
  }, [cities]);

  // Sadece sayfa geri dönüşünde yenile (ilk yükleme server'dan gelir)
  useEffect(() => {
    isMountedRef.current = true;
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) fetchData(); // bfcache'den dönüş
    };
    const handleFocus = () => {
      fetchData();
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchData();
      }
    };

    window.addEventListener("pageshow", handlePageShow);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      isMountedRef.current = false;
      window.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [fetchData]);

  const isEventPast = (event: Event) => {
    const eventDateTime = new Date(`${event.date} ${event.time || "00:00"}`);
    return eventDateTime < new Date();
  };

  const sortedEvents = [...(events || [])].sort((a, b) => {
    const aCreated = new Date(a.created_at).getTime();
    const bCreated = new Date(b.created_at).getTime();
    if (bCreated !== aCreated) return bCreated - aCreated;

    const aDate = new Date(`${a.date} ${a.time || "00:00"}`).getTime();
    const bDate = new Date(`${b.date} ${b.time || "00:00"}`).getTime();
    return bDate - aDate;
  });

  const upcomingEvents = sortedEvents.filter((event) => !isEventPast(event));
  const pastEvents = sortedEvents.filter((event) => isEventPast(event));
  const cityOptions = Array.from(
    new Set(upcomingEvents.map((event) => (event.location || "").trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, "tr"));

  // Tüm çok dilli alanlarda ara (title, title_tr, title_de, title_en, venue, venue_tr, venue_de, venue_en)
  const getSearchableText = (event: Event) => {
    const parts = [
      event.title,
      (event as Event & { title_tr?: string }).title_tr,
      (event as Event & { title_de?: string }).title_de,
      (event as Event & { title_en?: string }).title_en,
      event.venue,
      (event as Event & { venue_tr?: string }).venue_tr,
      (event as Event & { venue_de?: string }).venue_de,
      (event as Event & { venue_en?: string }).venue_en,
      event.location,
    ].filter(Boolean) as string[];
    return parts.join(" ").toLowerCase();
  };

  const filteredEventsRaw = upcomingEvents.filter((event) => {
    const term = searchTerm.trim().toLowerCase();
    const searchableText = getSearchableText(event);
    const matchesSearch = !term || searchableText.includes(term);

    const matchesCity = selectedCity === "all" || event.location === selectedCity;
    const matchesCategory = selectedCategory === "all" || event.category === selectedCategory;

    const eventDate = new Date(event.date);
    const start = startDate ? parseDateInput(startDate) : null;
    const end = endDate ? parseDateInput(endDate) : null;
    const matchesStart = !start || eventDate >= start;
    const matchesEnd = !end || eventDate <= end;

    const price = Number(event.price_from || 0);
    const min = minPrice ? Number(minPrice) : null;
    const max = maxPrice ? Number(maxPrice) : null;
    const matchesMin = min === null || Number.isNaN(min) || price >= min;
    const matchesMax = max === null || Number.isNaN(max) || price <= max;

    return (
      matchesSearch &&
      matchesCity &&
      matchesCategory &&
      matchesStart &&
      matchesEnd &&
      matchesMin &&
      matchesMax
    );
  });

  const filteredEvents = [...filteredEventsRaw].sort((a, b) => {
    if (sortBy === "yaklasan") {
      const aDate = new Date(`${a.date} ${a.time || "00:00"}`).getTime();
      const bDate = new Date(`${b.date} ${b.time || "00:00"}`).getTime();
      return aDate - bDate;
    }
    if (sortBy === "en-ucuz") {
      const aPrice = Number(a.price_from || 0);
      const bPrice = Number(b.price_from || 0);
      return aPrice - bPrice;
    }
    if (sortBy === "populer") {
      const aCreated = new Date(a.created_at).getTime();
      const bCreated = new Date(b.created_at).getTime();
      return bCreated - aCreated;
    }
    return 0;
  });

  // Aynı gösteri/turden en fazla 2 etkinlik (show_slug, image_url veya başlık ile grupla)
  const MAX_PER_SHOW = 2;
  const getShowKey = (event: Event) => {
    const e = event as Event & { show_slug?: string };
    if (e.show_slug) return e.show_slug;
    if (event.image_url) return event.image_url;
    const title = event.title ?? "";
    return title.includes(" - ") ? title.split(" - ")[0].trim() : title.split(/\s+/).slice(0, 2).join(" ") || event.id;
  };
  const displayEvents = (() => {
    const countByKey = new Map<string, number>();
    return filteredEvents.filter((event) => {
      const key = getShowKey(event);
      const count = countByKey.get(key) || 0;
      if (count >= MAX_PER_SHOW) return false;
      countByKey.set(key, count + 1);
      return true;
    });
  })();

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
    <div className="min-h-screen bg-slate-50">
      <Header />

      {/* Hero */}
      <section className="relative min-h-screen bg-gradient-to-br from-primary-600 to-primary-800 text-white py-20">
        {/* Dynamic Background Slider */}
        <HeroBackgroundSlider initialBackgrounds={initialHeroBackgrounds} />
        
        {/* Content */}
        <div className="relative z-10 container mx-auto px-4 text-center">
          <h1 className="text-4xl font-bold md:text-6xl mb-6 text-white">
            {locale === "tr" && heroVariant?.hero_title ? heroVariant.hero_title : t("heroTitle")}
          </h1>
          <p className="text-lg md:text-xl text-white mb-12 max-w-3xl mx-auto">
            {locale === "tr" && heroVariant?.hero_subtitle ? heroVariant.hero_subtitle : t("heroSubtitle")}
          </p>
          
          {/* Orijinal Büyüklükte Arama Kutusu */}
          <div className="max-w-2xl mx-auto mb-16">
            <div className="flex gap-3 bg-white rounded-2xl p-2 shadow-2xl">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  placeholder={t("searchPlaceholder")}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-xl border-0 py-4 pl-12 pr-4 text-slate-900 text-lg focus:outline-none"
                />
              </div>
              <Link 
                href="#events"
                className="rounded-xl bg-primary-600 px-8 py-4 font-semibold text-white hover:bg-primary-700 transition-colors"
              >
                {locale === "tr" && heroVariant?.cta_text ? heroVariant.cta_text : t("search")}
              </Link>
            </div>
          </div>

          {/* Güven Özellikleri */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-6 mb-4">
                <CheckCircle className="h-10 w-10 mx-auto mb-3 text-white" />
              </div>
              <h3 className="font-semibold text-base mb-2 text-white">{t("trustBadges.verified")}</h3>
              <p className="text-sm text-white/90">{t("trustBadges.verifiedDesc")}</p>
            </div>
            <div className="text-center">
              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-6 mb-4">
                <Clock className="h-10 w-10 mx-auto mb-3 text-white" />
              </div>
              <h3 className="font-semibold text-base mb-2 text-white">{t("trustBadges.delivery")}</h3>
              <p className="text-sm text-white/90">{t("trustBadges.deliveryDesc")}</p>
            </div>
            <div className="text-center">
              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-6 mb-4">
                <Shield className="h-10 w-10 mx-auto mb-3 text-white" />
              </div>
              <h3 className="font-semibold text-base mb-2 text-white">{t("trustBadges.payment")}</h3>
              <p className="text-sm text-white/90">{t("trustBadges.paymentDesc")}</p>
            </div>
            <div className="text-center">
              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-6 mb-4">
                <Database className="h-10 w-10 mx-auto mb-3 text-white" />
              </div>
              <h3 className="font-semibold text-base mb-2 text-white">{t("trustBadges.inventory")}</h3>
              <p className="text-sm text-white/90">{t("trustBadges.inventoryDesc")}</p>
            </div>
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-2 text-xs">
            {["VISA", "Mastercard", "AMEX", "Apple Pay", "Google Pay", "3D Secure"].map((badge) => (
              <span
                key={badge}
                className="rounded-full border border-white/40 bg-white/10 px-3 py-1 text-white/95"
              >
                {badge}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Slider'lar */}
      <section className="container mx-auto px-4 py-12">
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Yaklaşan Etkinlikler Slider */}
          <EventSlider 
            events={displayEvents} 
            title={t("upcomingEvents")} 
            locale={locale as "tr" | "de" | "en"}
            noEventsText={t("noEventsSlider")}
            buyTicketText={t("buyTicket")}
            freeText={t("free")}
          />
          
          {/* Haberler Slider */}
          <NewsSlider 
            news={news} 
            title={t("news")} 
            locale={locale as "tr" | "de" | "en"}
          />
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
                  const first = el.querySelector("a") as HTMLElement | null;
                  const step = first ? first.offsetWidth + 12 : 220;
                  el.scrollBy({ left: -step, behavior: "smooth" });
                }}
                className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/20 p-2.5 text-white backdrop-blur-sm transition-all hover:bg-black/35 md:left-4"
                aria-label="Önceki"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                type="button"
                onClick={() => {
                  const el = cityScrollRef.current;
                  if (!el) return;
                  const first = el.querySelector("a") as HTMLElement | null;
                  const step = first ? first.offsetWidth + 12 : 220;
                  el.scrollBy({ left: step, behavior: "smooth" });
                }}
                className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/20 p-2.5 text-white backdrop-blur-sm transition-all hover:bg-black/35 md:right-4"
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
                  return (
                    <Link
                      key={city.id}
                      href={`/city/${city.slug}`}
                      className="group flex flex-shrink-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all hover:shadow-lg hover:border-primary-200 snap-center min-w-[100vw] max-w-[100vw] sm:min-w-[200px] sm:max-w-[200px] md:min-w-[220px] md:max-w-[220px] xl:min-w-[240px] xl:max-w-[240px]"
                    >
                      <div className="aspect-[16/9] overflow-hidden bg-slate-100">
                        {city.image_url ? (
                          <img
                            src={city.image_url}
                            alt={name}
                            className="h-full w-full object-cover transition-transform group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary-100 to-primary-50">
                            <MapPin className="h-12 w-12 text-primary-400" />
                          </div>
                        )}
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

      {/* Events */}
      <section id="events" className="container mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold text-slate-900 mb-8">{t("upcomingEvents")}</h2>
        <div className="mb-6 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-2 lg:grid-cols-4">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "yaklasan" | "en-ucuz" | "populer")}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="yaklasan">{t("sortBy.upcoming")}</option>
            <option value="en-ucuz">{t("sortBy.cheapest")}</option>
            <option value="populer">{t("sortBy.popular")}</option>
          </select>
          <select
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
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
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
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
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder={t("filters.startDate")}
          />
          <input
            type="text"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder={t("filters.endDate")}
          />
          <input
            type="number"
            min="0"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder={t("filters.minPrice")}
          />
          <input
            type="number"
            min="0"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder={t("filters.maxPrice")}
          />
          <button
            type="button"
            onClick={() => {
              setSortBy("yaklasan");
              setSelectedCity("all");
              setSelectedCategory("all");
              setStartDate("");
              setEndDate("");
              setMinPrice("");
              setMaxPrice("");
            }}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
          >
            {t("filters.clear")}
          </button>
        </div>
        
        {displayEvents.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500">
            {events.length === 0 ? (
              <>
                <Music2 className="h-16 w-16 mx-auto text-slate-300 mb-4" />
                <p className="text-lg font-medium">{t("noEvents")}</p>
                <p className="mt-2 text-sm">{t("supabaseHint")}</p>
                <div className="mt-4 p-4 bg-slate-100 rounded-lg text-left">
                  <p className="font-medium mb-2">{t("solutionSteps")}</p>
                  <ol className="text-sm space-y-1">
                    <li>1. {t("solution1")}</li>
                    <li>2. {t("solution2")}</li>
                    <li>3. <code className="bg-slate-200 px-1 rounded">quick-fix.sql</code> {t("solution3")}</li>
                    <li>4. {t("solution4")}</li>
                  </ol>
                </div>
              </>
            ) : (
              <p className="text-lg font-medium">{t("noEventsForFilter")}</p>
            )}
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {displayEvents.map((event) => {
              const eventStatus = getEventStatus(event);
              const localized = getLocalizedEvent(event as unknown as Record<string, unknown>, locale as "tr" | "de" | "en");
              const parsedMeta = parseEventDescription(localized.description || event.description);
              
              return (
                <div
                  key={event.id}
                  className={`overflow-hidden rounded-2xl border shadow-sm hover:shadow-lg transition-shadow ${
                    eventStatus.isPast 
                      ? 'bg-slate-50 border-slate-300 opacity-75' 
                      : 'bg-white border-slate-200'
                  }`}
                >
                  <Link href={`/etkinlik/${(event as Event & { show_slug?: string }).show_slug || event.id}`}>
                    <div className="aspect-video bg-gradient-to-br from-primary-100 to-primary-50 flex items-center justify-center overflow-hidden cursor-pointer relative">
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
                        <Music2 className="h-16 w-16 text-primary-400" />
                      )}
                      
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
                            {localized.venue || event.venue}, {event.location}
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
                    <div className="flex justify-between items-center pt-3">
                      <span className={`font-bold text-lg ${
                        eventStatus.isPast ? 'text-slate-500' : 'text-primary-600'
                      }`}>
                        {Number(event.price_from) > 0
                          ? `${t("from")} ${formatPrice(Number(event.price_from), event.currency)}`
                          : t("free")}
                      </span>
                      <button
                        onClick={() => {
                          const externalTicketUrl = parsedMeta.externalTicketUrl;
                          if (eventStatus.isPast) {
                            alert(t("eventEndedAlert"));
                            return;
                          }
                          if (externalTicketUrl || event.ticket_url) {
                            window.open(externalTicketUrl || event.ticket_url, "_blank");
                          } else {
                            window.location.href = `/${locale}/etkinlik/${event.id}`;
                          }
                        }}
                        className={`text-sm font-medium flex items-center gap-1 px-3 py-2 rounded-lg transition-colors ${
                          eventStatus.isPast
                            ? 'text-slate-500 bg-slate-100 cursor-not-allowed'
                            : 'text-primary-600 hover:text-primary-700 bg-primary-50 hover:bg-primary-100'
                        }`}
                      >
                        {eventStatus.isPast ? t("buyTicketDisabled") : t("buyTicket")}
                        {(parsedMeta.externalTicketUrl || event.ticket_url) && !eventStatus.isPast && (
                          <ExternalLink className="h-3 w-3" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </section>

      {pastEvents.length > 0 && (
        <section className="container mx-auto px-4 pb-16">
          <h2 className="text-2xl font-bold text-slate-900 mb-8">{t("pastEvents")}</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {pastEvents.map((event) => {
              const pastLocalized = getLocalizedEvent(event as unknown as Record<string, unknown>, locale as "tr" | "de" | "en");
              return (
              <div
                key={`past-${event.id}`}
                className="overflow-hidden rounded-2xl border bg-slate-50 border-slate-300 opacity-80"
              >
                <div className="aspect-video bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center overflow-hidden relative">
                  {event.image_url ? (
                    <img
                      src={event.image_url}
                      alt={pastLocalized.title}
                      className="h-full w-full object-cover object-top"
                      onError={(e) => {
                        if (e.currentTarget.dataset.fallbackApplied === "1") return;
                        e.currentTarget.dataset.fallbackApplied = "1";
                        e.currentTarget.src = fallbackImage;
                      }}
                    />
                  ) : (
                    <Music2 className="h-16 w-16 text-slate-400" />
                  )}
                  <div className="absolute left-2 top-2">
                    <span className="px-2 py-1 text-xs font-bold text-white bg-red-600 rounded">
                      {t("eventEnded")}
                    </span>
                  </div>
                </div>
                <div className="p-5">
                  <h3 className="font-semibold line-clamp-1 mb-2 text-slate-700">{pastLocalized.title}</h3>
                  <div className="space-y-2 text-sm text-slate-500">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 flex-shrink-0" />
                      <span>
                        {new Date(event.date).toLocaleDateString("tr-TR")} • {event.time}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 flex-shrink-0" />
                      <span>{pastLocalized.venue || event.venue}, {event.location}</span>
                    </div>
                  </div>
                  <p className="mt-3 text-xs font-medium text-red-600">
                    {t("eventEndedBanner")}
                  </p>
                </div>
              </div>
            );})}
          </div>
        </section>
      )}

    </div>
  );
}
