"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Calendar, MapPin, Music2 } from "lucide-react";
import type { Event } from "@/types/database";
import { CATEGORY_LABELS } from "@/types/database";
import Link from "next/link";

interface EventSliderProps {
  events: Event[];
  title: string;
}

export default function EventSlider({ events, title }: EventSliderProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlay, setIsAutoPlay] = useState(true);
  const fallbackImage =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 450'%3E%3Crect width='800' height='450' fill='%23e2e8f0'/%3E%3Cg fill='%2364748b'%3E%3Ccircle cx='330' cy='190' r='36'/%3E%3Cpath d='M220 330l95-95 70 70 55-55 140 140H220z'/%3E%3C/g%3E%3C/svg%3E";

  // Her sanatçıdan bir etkinlik filtrele
  const sliderEvents = (() => {
    const artistMap = new Map();
    
    events.forEach(event => {
      // Turne etkinliğini sanatçı adını al
      let artistName = '';
      if (event.title.includes(' - ')) {
        [artistName] = event.title.split(' - ');
      } else {
        // Regular event için title'ı kullan
        artistName = event.title;
      }
      
      // Bu sanatçıdan daha önce etkinlik eklenmediyse ekle
      if (!artistMap.has(artistName)) {
        artistMap.set(artistName, event);
      }
    });
    
    // Array'e çevir ve ilk 5 tanesini al
    return Array.from(artistMap.values()).slice(0, 5);
  })();

  // Otomatik oynatma
  useEffect(() => {
    if (!isAutoPlay || sliderEvents.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % sliderEvents.length);
    }, 4000);

    return () => clearInterval(interval);
  }, [isAutoPlay, sliderEvents.length]);

  // Liste daraldığında mevcut index taşarsa ilk elemana dön
  useEffect(() => {
    if (sliderEvents.length === 0) return;
    if (currentIndex >= sliderEvents.length) {
      setCurrentIndex(0);
    }
  }, [currentIndex, sliderEvents.length]);

  const goToPrevious = () => {
    setIsAutoPlay(false);
    setCurrentIndex((prev) => 
      prev === 0 ? sliderEvents.length - 1 : prev - 1
    );
  };

  const goToNext = () => {
    setIsAutoPlay(false);
    setCurrentIndex((prev) => (prev + 1) % sliderEvents.length);
  };

  const goToSlide = (index: number) => {
    setIsAutoPlay(false);
    setCurrentIndex(index);
  };

  if (sliderEvents.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8">
        <h2 className="text-xl font-bold text-slate-900 mb-4">{title}</h2>
        <div className="text-center py-8">
          <Music2 className="h-16 w-16 mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500">Yaklaşan etkinlik bulunmamaktadır.</p>
        </div>
      </div>
    );
  }

  const currentEvent = sliderEvents[currentIndex] ?? sliderEvents[0];
  if (!currentEvent) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Başlık */}
      <div className="p-6 pb-4">
        <h2 className="text-xl font-bold text-slate-900">{title}</h2>
      </div>

      {/* Slider */}
      <div className="relative">
        {/* Ana Etkinlik Kartı */}
        <div className="relative h-96 bg-gradient-to-br from-primary-100 to-primary-50">
          {currentEvent.image_url ? (
            <img
              src={currentEvent.image_url}
              alt={currentEvent.title}
              className="w-full h-full object-cover object-top"
              onError={(e) => {
                if (e.currentTarget.dataset.fallbackApplied === "1") return;
                e.currentTarget.dataset.fallbackApplied = "1";
                e.currentTarget.src = fallbackImage;
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Music2 className="h-24 w-24 text-primary-400" />
            </div>
          )}

          {/* Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          
          {/* İçerik */}
          <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-medium bg-primary-600 px-2 py-1 rounded">
                {CATEGORY_LABELS[currentEvent.category as keyof typeof CATEGORY_LABELS] || currentEvent.category}
              </span>
              <span className="text-xs opacity-90">
                {new Date(currentEvent.date).toLocaleDateString("tr-TR")}
              </span>
            </div>
            
            <h3 className="text-2xl font-bold mb-2 line-clamp-2">
              {currentEvent.title}
            </h3>
            
            <div className="flex items-center gap-4 text-sm opacity-90 mb-4">
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {new Date(currentEvent.date).toLocaleDateString("tr-TR")} • {currentEvent.time}
              </div>
              <div className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {currentEvent.venue}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-xl font-bold">
                {Number(currentEvent.price_from) > 0
                  ? `€${Number(currentEvent.price_from).toLocaleString("de-DE")}`
                  : "Ücretsiz"
                }
              </div>
              
              <Link
                href={`/etkinlik/${currentEvent.id}`}
                className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors"
              >
                Bilet Al
              </Link>
            </div>
          </div>
        </div>

        {/* Navigasyon Butonları */}
        {sliderEvents.length > 1 && (
          <>
            <button
              onClick={goToPrevious}
              className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-slate-900 p-2 rounded-full shadow-lg transition-colors"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            
            <button
              onClick={goToNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-slate-900 p-2 rounded-full shadow-lg transition-colors"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}
      </div>

      {/* Slider Indikatörleri */}
      {sliderEvents.length > 1 && (
        <div className="flex justify-center gap-2 p-4">
          {sliderEvents.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`w-2 h-2 rounded-full transition-colors ${
                index === currentIndex
                  ? "bg-primary-600"
                  : "bg-slate-300 hover:bg-slate-400"
              }`}
            />
          ))}
        </div>
      )}

      {/* Mini Önizleme */}
      {sliderEvents.length > 1 && (
        <div className="p-6 pt-0">
          <div className="flex gap-3 overflow-x-auto pb-2">
            {sliderEvents.map((event, index) => (
              <button
                key={event.id}
                onClick={() => goToSlide(index)}
                className={`flex-shrink-0 w-32 h-20 rounded-lg overflow-hidden border-2 transition-all ${
                  index === currentIndex
                    ? "border-primary-600 shadow-lg"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                {event.image_url ? (
                  <img
                    src={event.image_url}
                    alt={event.title}
                    className="w-full h-full object-cover object-top"
                    onError={(e) => {
                      if (e.currentTarget.dataset.fallbackApplied === "1") return;
                      e.currentTarget.dataset.fallbackApplied = "1";
                      e.currentTarget.src = fallbackImage;
                    }}
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary-100 to-primary-50 flex items-center justify-center">
                    <Music2 className="h-8 w-8 text-primary-400" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
