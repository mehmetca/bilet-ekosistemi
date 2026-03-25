"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "@/i18n/navigation";
import { Calendar, MapPin, Music2, Search, CheckCircle, Shield, Clock, Database, ChevronRight, ChevronLeft } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import Header from "@/components/Header";
import HeroBackgroundSlider from "@/components/HeroBackgroundSlider";
import type { Event, News } from "@/types/database";
import { CATEGORY_LABELS, DISPLAY_CATEGORIES } from "@/types/database";
import FeaturedEvents from "@/components/FeaturedEvents";
import AnaHeroSlider from "@/components/AnaHeroSlider";
import { formatPrice } from "@/lib/formatPrice";
import { getLocalizedEvent } from "@/lib/i18n-content";
import { formatEventDateDMY, isEventPastByLocalDateTime } from "@/lib/date-utils";

function eventDateISO(event: Event): string {
  const d = String(event.date ?? "");
  if (!d) return "";
  return d.includes("T") ? d.split("T")[0]! : d.slice(0, 10);
}

function getLocalISODateString(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
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
  const tCalendar = useTranslations("calendar");
  const locale = useLocale();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCity, setSelectedCity] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  /** YYYY-MM-DD; boş = tarih filtresi yok (tarih bazlı daraltma kapalı) */
  const [eventDate, setEventDate] = useState("");
  /** true olduğunda tarih filtresi aktif olur (eventDate'a göre eşleştirir) */
  const [isDateFilterActive, setIsDateFilterActive] = useState(false);
  const [eventDateInput, setEventDateInput] = useState(() => formatLocalDateDMY(new Date()));
  const [sortBy, setSortBy] = useState<"yaklasan" | "populer">("yaklasan");
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
        if (!eventsRes.error && Array.isArray(eventsRes.data)) setEvents(eventsRes.data);
        if (!newsRes.error && Array.isArray(newsRes.data)) setNews(newsRes.data);
        if (!citiesRes.error && Array.isArray(citiesRes.data)) setCities(citiesRes.data);
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

  // Mount'ta bir kez veri yenile (Alışverişe devam et sonrası güncel liste görünsün); sayfa geri dönüşünde de yenile
  useEffect(() => {
    isMountedRef.current = true;
    fetchData(); // İlk açılışta / sepet sonrası ana sayfada güncel etkinlik listesi
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

  const isEventPast = (event: Event) => isEventPastByLocalDateTime(event.date, event.time);

  const sortedEvents = [...(events || [])].sort((a, b) => {
    const aCreated = new Date(a.created_at).getTime();
    const bCreated = new Date(b.created_at).getTime();
    if (bCreated !== aCreated) return bCreated - aCreated;

    const aDate = new Date(`${a.date} ${a.time || "00:00"}`).getTime();
    const bDate = new Date(`${b.date} ${b.time || "00:00"}`).getTime();
    return bDate - aDate;
  });

  const upcomingEvents = sortedEvents.filter((event) => !isEventPast(event));
  // Şehir listesi: tekrarsız, virgülden önceki kısım + büyük/küçük harf farkı birleştirilir (örn. 3x Berlin → 1)
  const cityOptions = (() => {
    const byKey = new Map<string, string>();
    upcomingEvents.forEach((event) => {
      const e = event as Event & { city?: string | null };
      const raw = (e.city || event.location || "").trim();
      if (!raw) return;
      const cityPart = raw.includes(",") ? raw.split(",")[0].trim() : raw;
      if (!cityPart) return;
      const key = cityPart.toLowerCase();
      if (!byKey.has(key)) byKey.set(key, cityPart);
    });
    return Array.from(byKey.values()).sort((a, b) => a.localeCompare(b, "tr"));
  })();

  // Tüm çok dilli alanlarda ara (title, title_tr, title_de, title_en, venue, venue_tr, venue_de, venue_en)
  const getSearchableText = (event: Event) => {
    const e = event as Event & { city?: string | null; address?: string | null };
    const parts = [
      event.title,
      (event as Event & { title_tr?: string }).title_tr,
      (event as Event & { title_de?: string }).title_de,
      (event as Event & { title_en?: string }).title_en,
      event.venue,
      (event as Event & { venue_tr?: string }).venue_tr,
      (event as Event & { venue_de?: string }).venue_de,
      event.location,
      e.city,
      e.address,
    ].filter(Boolean) as string[];
    return parts.join(" ").toLowerCase();
  };

  const filteredEventsRaw = upcomingEvents.filter((event) => {
    const term = searchTerm.trim().toLowerCase();
    const searchableText = getSearchableText(event);
    const matchesSearch = !term || searchableText.includes(term);

    const eventCityRaw = (event as Event & { city?: string | null }).city || event.location || "";
    const eventCityPart = eventCityRaw.includes(",") ? eventCityRaw.split(",")[0].trim() : eventCityRaw.trim();
    const matchesCity = selectedCity === "all" || eventCityPart.toLowerCase() === selectedCity.toLowerCase();
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

  // Aynı gösteri/turden en fazla 1 etkinlik (show_slug, image_url veya başlık ile grupla)
  const MAX_PER_SHOW = 1;
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
          <h1 className="text-3xl font-bold sm:text-4xl md:text-6xl mb-6 text-white px-1 break-words hyphens-auto">
            {locale === "tr" && heroVariant?.hero_title ? heroVariant.hero_title : t("heroTitle")}
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-white mb-8 sm:mb-12 max-w-3xl mx-auto px-1">
            {locale === "tr" && heroVariant?.hero_subtitle ? heroVariant.hero_subtitle : t("heroSubtitle")}
          </p>
          
          {/* Orijinal Büyüklükte Arama Kutusu */}
          <div className="max-w-2xl mx-auto mb-12 sm:mb-16 px-0">
            <div className="flex flex-col gap-2 sm:flex-row sm:gap-3 bg-white rounded-2xl p-2 shadow-2xl">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 sm:left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="search"
                  placeholder={t("searchPlaceholder")}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-xl border-0 py-3.5 sm:py-4 pl-11 sm:pl-12 pr-3 sm:pr-4 text-slate-900 text-base sm:text-lg focus:outline-none"
                />
              </div>
              <Link 
                href="#events"
                className="rounded-xl bg-primary-600 px-6 sm:px-8 py-3.5 sm:py-4 font-semibold text-white hover:bg-primary-700 transition-colors text-center shrink-0"
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

      {/* Ana Slider: Slider'lar alanına taşındı */}

      {/* Slider'lar */}
      <section className="container mx-auto px-4 py-12">
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-6 pb-4">
            <h2 className="text-xl font-bold text-slate-900">{t("upcomingEvents")}</h2>
          </div>
          <div className="border-t border-slate-200">
            <AnaHeroSlider placement="main_slider" />
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
                      className="group flex flex-shrink-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all hover:shadow-lg hover:border-primary-200 snap-center w-[min(88vw,22rem)] max-w-[min(88vw,22rem)] sm:min-w-[230px] sm:max-w-[230px] sm:w-[230px] md:min-w-[250px] md:max-w-[250px] md:w-[250px] xl:min-w-[280px] xl:max-w-[280px] xl:w-[280px]"
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

      {/* Öne çıkan etkinlikler (pickaseat tarzı - 2 etkinlik yan yana) */}
      <FeaturedEvents
        events={events}
        locale={locale as "tr" | "de" | "en"}
        title={t("featuredEvents")}
      />

      {/* Events */}
      <section id="events" className="container mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold text-slate-900 mb-4">{t("upcomingEvents")}</h2>
        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6 [&>*]:min-w-0">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
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
                        {Number(event.price_from) > 0
                          ? `${t("from")} ${formatPrice(Number(event.price_from), event.currency)}`
                          : t("free")}
                      </span>
                      <button
                        onClick={() => {
                          if (eventStatus.isPast) {
                            alert(t("eventEndedAlert"));
                            return;
                          }
                          const slug = (event as Event & { show_slug?: string }).show_slug || event.id;
                          window.location.href = `/${locale}/etkinlik/${slug}`;
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

    </div>
  );
}
