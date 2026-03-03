"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Calendar, MapPin, Music2, Search, ExternalLink, CheckCircle, Shield, Clock, Database } from "lucide-react";
import Header from "@/components/Header";
import HeroBackgroundSlider from "@/components/HeroBackgroundSlider";
import type { Event, News } from "@/types/database";
import { CATEGORY_LABELS } from "@/types/database";
import EventSlider from "@/components/EventSlider";
import NewsSlider from "@/components/NewsSlider";
import { supabase } from "@/lib/supabase-client";
import { parseEventDescription } from "@/lib/eventMeta";

export default function ClientHomePage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCity, setSelectedCity] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [events, setEvents] = useState<Event[]>([]);
  const [news, setNews] = useState<News[]>([]);
  const isMountedRef = useRef(true);
  const fallbackImage =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 450'%3E%3Crect width='800' height='450' fill='%23e2e8f0'/%3E%3Cg fill='%2364748b'%3E%3Ccircle cx='330' cy='190' r='36'/%3E%3Cpath d='M220 330l95-95 70 70 55-55 140 140H220z'/%3E%3C/g%3E%3C/svg%3E";

  const fetchData = useCallback(async () => {
    try {
      const { data: eventsData, error: eventsError } = await supabase
        .from("events")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (eventsError) {
        console.error("Events fetch error:", eventsError);
      } else if (isMountedRef.current) {
        setEvents(eventsData || []);
      }

      const { data: newsData, error: newsError } = await supabase
        .from("news")
        .select("*")
        .eq("is_published", true)
        .order("published_at", { ascending: false })
        .limit(5);

      if (newsError) {
        console.error("News fetch error:", newsError);
      } else if (isMountedRef.current) {
        setNews(newsData || []);
      }
    } catch (error) {
      console.error("Data fetch error:", error);
    }
  }, []);

  // İlk yükleme + browser ileri/geri dönüşlerinde yeniden veri çek
  useEffect(() => {
    // StrictMode'da effect cleanup -> re-run döngüsünde mount bayrağını geri aç.
    isMountedRef.current = true;
    fetchData();

    const handlePageShow = () => {
      fetchData();
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

  const filteredEvents = upcomingEvents.filter((event) => {
    const term = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !term ||
      event.title.toLowerCase().includes(term) ||
      (event.venue || "").toLowerCase().includes(term) ||
      (event.location || "").toLowerCase().includes(term);

    const matchesCity = selectedCity === "all" || event.location === selectedCity;
    const matchesCategory = selectedCategory === "all" || event.category === selectedCategory;

    const eventDate = new Date(event.date);
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;
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

  // Etkinlik durumunu kontrol et
  const getEventStatus = (event: Event) => {
    const eventDateTime = new Date(event.date + ' ' + (event.time || '00:00'));
    const now = new Date();
    const isPast = eventDateTime < now;
    
    return {
      isPast,
      statusText: isPast ? 'Sona Erdi' : 'Aktif',
      statusColor: isPast ? 'text-red-600 bg-red-50' : 'text-green-600 bg-green-50'
    };
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />

      {/* Hero */}
      <section className="relative min-h-screen bg-gradient-to-br from-primary-600 to-primary-800 text-white py-20">
        {/* Dynamic Background Slider */}
        <HeroBackgroundSlider />
        
        {/* Content */}
        <div className="relative z-10 container mx-auto px-4 text-center">
          <h1 className="text-4xl font-bold md:text-6xl mb-6 text-white">
            Hayalinizdaki Etkinliğe Bilet Bulun
          </h1>
          <p className="text-lg md:text-xl text-white mb-12 max-w-3xl mx-auto">
            Konser, tiyatro, spor ve daha fazlası. Güvenli ödeme ile kolayca bilet alın.
          </p>
          
          {/* Orijinal Büyüklükte Arama Kutusu */}
          <div className="max-w-2xl mx-auto mb-16">
            <div className="flex gap-3 bg-white rounded-2xl p-2 shadow-2xl">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  placeholder="Etkinlik, sanatçı veya venue ara..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-xl border-0 py-4 pl-12 pr-4 text-slate-900 text-lg focus:outline-none"
                />
              </div>
              <Link 
                href="#events"
                className="rounded-xl bg-primary-600 px-8 py-4 font-semibold text-white hover:bg-primary-700 transition-colors"
              >
                Ara
              </Link>
            </div>
          </div>

          {/* Güven Özellikleri */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-6 mb-4">
                <CheckCircle className="h-10 w-10 mx-auto mb-3 text-white" />
              </div>
              <h3 className="font-semibold text-base mb-2 text-white">Doğrulanmış Biletler</h3>
              <p className="text-sm text-white/90">100% orijinal garanti</p>
            </div>
            <div className="text-center">
              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-6 mb-4">
                <Clock className="h-10 w-10 mx-auto mb-3 text-white" />
              </div>
              <h3 className="font-semibold text-base mb-2 text-white">Anında Teslimat</h3>
              <p className="text-sm text-white/90">Hızlı ve güvenli</p>
            </div>
            <div className="text-center">
              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-6 mb-4">
                <Shield className="h-10 w-10 mx-auto mb-3 text-white" />
              </div>
              <h3 className="font-semibold text-base mb-2 text-white">Güvenli Ödeme</h3>
              <p className="text-sm text-white/90">3D Secure destekli güvenli ödeme altyapısı</p>
            </div>
            <div className="text-center">
              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-6 mb-4">
                <Database className="h-10 w-10 mx-auto mb-3 text-white" />
              </div>
              <h3 className="font-semibold text-base mb-2 text-white">Canlı Envanter</h3>
              <p className="text-sm text-white/90">Gerçek zamanlı müsaitlik</p>
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
            events={filteredEvents} 
            title="Yaklaşan Etkinlikler" 
          />
          
          {/* Haberler Slider */}
          <NewsSlider 
            news={news} 
            title="Haberler" 
          />
        </div>
        
      </section>

      {/* Events */}
      <section id="events" className="container mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold text-slate-900 mb-8">Yaklaşan Etkinlikler</h2>
        <div className="mb-6 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-2 lg:grid-cols-4">
          <select
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="all">Tüm Şehirler</option>
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
            <option value="all">Tüm Kategoriler</option>
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Başlangıç tarihi"
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Bitiş tarihi"
          />
          <input
            type="number"
            min="0"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Min €"
          />
          <input
            type="number"
            min="0"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Max €"
          />
          <button
            type="button"
            onClick={() => {
              setSelectedCity("all");
              setSelectedCategory("all");
              setStartDate("");
              setEndDate("");
              setMinPrice("");
              setMaxPrice("");
            }}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
          >
            Filtreleri Temizle
          </button>
        </div>
        
        {filteredEvents.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500">
            <Music2 className="h-16 w-16 mx-auto text-slate-300 mb-4" />
            <p className="text-lg font-medium">Henüz etkinlik yok</p>
            <p className="mt-2 text-sm">
              Supabase&apos;de tablolar oluşturuluyor veya veri yok.
            </p>
            <div className="mt-4 p-4 bg-slate-100 rounded-lg text-left">
              <p className="font-medium mb-2">Çözüm adımları:</p>
              <ol className="text-sm space-y-1">
                <li>1. Supabase Dashboard aç</li>
                <li>2. SQL Editor gir</li>
                <li>3. <code className="bg-slate-200 px-1 rounded">quick-fix.sql</code> çalıştır</li>
                <li>4. Sayfayı yenile</li>
              </ol>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {filteredEvents.map((event) => {
              const eventStatus = getEventStatus(event);
              const parsedMeta = parseEventDescription(event.description);
              
              return (
                <div
                  key={event.id}
                  className={`overflow-hidden rounded-2xl border shadow-sm hover:shadow-lg transition-shadow ${
                    eventStatus.isPast 
                      ? 'bg-slate-50 border-slate-300 opacity-75' 
                      : 'bg-white border-slate-200'
                  }`}
                >
                  <Link href={`/etkinlik/${event.id}`}>
                    <div className="aspect-video bg-gradient-to-br from-primary-100 to-primary-50 flex items-center justify-center overflow-hidden cursor-pointer relative">
                      {event.image_url ? (
                        <img
                          src={event.image_url}
                          alt={event.title}
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
                            BİTTİ
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
                            SONA ERDİ
                          </span>
                        )}
                      </div>
                      <h3 className={`font-semibold line-clamp-1 mb-2 ${
                        eventStatus.isPast ? 'text-slate-600' : 'text-slate-900'
                      }`}>
                        {event.title}
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
                            {event.venue}, {event.location}
                          </span>
                        </div>
                      </div>
                      {eventStatus.isPast && (
                        <p className="mt-3 text-xs font-medium text-red-600">
                          Bu etkinlik tamamlanmıştır. Bilet satışı kapalıdır.
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
                          ? `ab €${Number(event.price_from).toLocaleString("de-DE")}`
                          : "Ücretsiz"}
                      </span>
                      <button
                        onClick={() => {
                          const externalTicketUrl = parsedMeta.externalTicketUrl;
                          if (eventStatus.isPast) {
                            alert("Bu etkinlik tamamlanmıştır. Bilet satılamaz.");
                            return;
                          }
                          if (externalTicketUrl || event.ticket_url) {
                            window.open(externalTicketUrl || event.ticket_url, "_blank");
                          } else {
                            window.location.href = `/etkinlik/${event.id}`;
                          }
                        }}
                        className={`text-sm font-medium flex items-center gap-1 px-3 py-2 rounded-lg transition-colors ${
                          eventStatus.isPast
                            ? 'text-slate-500 bg-slate-100 cursor-not-allowed'
                            : 'text-primary-600 hover:text-primary-700 bg-primary-50 hover:bg-primary-100'
                        }`}
                      >
                        {eventStatus.isPast ? 'Bilet Alınamaz' : 'Bilet Al'}
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
          <h2 className="text-2xl font-bold text-slate-900 mb-8">Biten Etkinlikler</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {pastEvents.map((event) => (
              <div
                key={`past-${event.id}`}
                className="overflow-hidden rounded-2xl border bg-slate-50 border-slate-300 opacity-80"
              >
                <div className="aspect-video bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center overflow-hidden relative">
                  {event.image_url ? (
                    <img
                      src={event.image_url}
                      alt={event.title}
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
                      BİTTİ
                    </span>
                  </div>
                </div>
                <div className="p-5">
                  <h3 className="font-semibold line-clamp-1 mb-2 text-slate-700">{event.title}</h3>
                  <div className="space-y-2 text-sm text-slate-500">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 flex-shrink-0" />
                      <span>
                        {new Date(event.date).toLocaleDateString("tr-TR")} • {event.time}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 flex-shrink-0" />
                      <span>{event.venue}, {event.location}</span>
                    </div>
                  </div>
                  <p className="mt-3 text-xs font-medium text-red-600">
                    Bu etkinlik tamamlanmıştır. Bilet satışı kapalıdır.
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

    </div>
  );
}
