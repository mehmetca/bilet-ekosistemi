"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import type { News } from "@/types/database";
import Link from "next/link";
import { isImageReachable } from "@/lib/image-utils";

interface NewsSliderProps {
  news?: News[];
  title: string;
}

interface Advertisement {
  id: string;
  title: string;
  image_url: string;
  link_url: string;
  placement: string;
  is_active: boolean;
}

export default function NewsSlider({ news, title }: NewsSliderProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlay, setIsAutoPlay] = useState(true);
  const [safeNews, setSafeNews] = useState<News[]>(news || []);
  const [advertisement, setAdvertisement] = useState<Advertisement | null>(null);

  useEffect(() => {
    async function validateNewsImages() {
      const inputNews = news || [];
      const validatedNews = await Promise.all(
        inputNews.map(async (item) => {
          if (!item.image_url) return item;
          const imageIsReachable = await isImageReachable(item.image_url);
          return imageIsReachable ? item : { ...item, image_url: undefined };
        })
      );
      setSafeNews(validatedNews);
    }

    validateNewsImages();
  }, [news]);

  useEffect(() => {
    async function fetchNewsSliderAd() {
      try {
        const response = await fetch("/api/advertisements");
        if (!response.ok) return;
        const ads = (await response.json()) as Advertisement[];
        const targetAd = ads.find(
          (ad) => ad.is_active && ad.placement === "news_slider" && !!ad.image_url
        );
        if (!targetAd) return;

        const imageOk = await isImageReachable(targetAd.image_url);
        setAdvertisement(imageOk ? targetAd : null);
      } catch {
        setAdvertisement(null);
      }
    }

    fetchNewsSliderAd();
  }, []);

  // Otomatik oynatma
  useEffect(() => {
    if (!isAutoPlay || safeNews.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % safeNews.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [isAutoPlay, safeNews.length]);

  const goToPrevious = () => {
    setIsAutoPlay(false);
    setCurrentIndex((prev) => 
      prev === 0 ? safeNews.length - 1 : prev - 1
    );
  };

  const goToNext = () => {
    setIsAutoPlay(false);
    setCurrentIndex((prev) => (prev + 1) % safeNews.length);
  };

  const goToSlide = (index: number) => {
    setIsAutoPlay(false);
    setCurrentIndex(index);
  };

  if (safeNews.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8">
        <h2 className="text-xl font-bold text-slate-900 mb-4">{title}</h2>
        <div className="text-center py-8">
          <div className="h-16 w-16 mx-auto bg-slate-100 rounded-full flex items-center justify-center mb-4">
            <span className="text-2xl">📰</span>
          </div>
          <p className="text-slate-500">Haber bulunmamaktadır.</p>
        </div>
      </div>
    );
  }

  const currentNews = safeNews[currentIndex];

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Başlık */}
      <div className="p-6 pb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900">{title}</h2>
      </div>

      {/* Slider */}
      <div className="relative">
        {/* Ana Haber Kartı */}
        <div className="relative h-96 bg-gradient-to-br from-slate-100 to-slate-50">
          {currentNews.image_url ? (
            <img
              src={currentNews.image_url}
              alt={currentNews.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center">
                <div className="h-20 w-20 mx-auto bg-slate-200 rounded-full flex items-center justify-center mb-4">
                  <span className="text-3xl">📰</span>
                </div>
                <p className="text-slate-500">Görsel yüklenmemiş</p>
              </div>
            </div>
          )}

          {/* Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          
          {/* İçerik */}
          <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs bg-white/20 px-2 py-1 rounded backdrop-blur-sm">
                Haber
              </span>
              <span className="text-xs opacity-90 flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {new Date(currentNews.published_at || currentNews.created_at).toLocaleDateString("tr-TR")}
              </span>
            </div>
            
            <h3 className="text-2xl font-bold mb-3 line-clamp-2">
              {currentNews.title}
            </h3>
            
            <p className="text-sm opacity-90 line-clamp-3 mb-4">
              {currentNews.summary || (currentNews.content ? currentNews.content.substring(0, 150) + "..." : "")}
            </p>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs opacity-75">
                <span>Yazar</span>
              </div>
              
              <Link
                href={`/haber/${currentNews.id}`}
                className="bg-white/90 hover:bg-white text-slate-900 px-4 py-2 rounded-lg font-semibold text-sm transition-colors"
              >
                Devamını Oku
              </Link>
            </div>
          </div>
        </div>

        {/* Navigasyon Butonları */}
        {safeNews.length > 1 && (
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
      {safeNews.length > 1 && (
        <div className="flex justify-center gap-2 p-4">
          {safeNews.map((_, index) => (
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

      {advertisement && (
        <div className="border-t border-slate-200 p-4">
          <button
            type="button"
            onClick={() => {
              if (advertisement.link_url) {
                window.open(advertisement.link_url, "_blank", "noopener,noreferrer");
              }
            }}
            className="block w-full"
          >
            <div className="mx-auto w-full max-w-[800px] h-32 rounded-lg overflow-hidden bg-slate-100">
              <img
                src={advertisement.image_url}
                alt={advertisement.title || "Reklam"}
                className="w-full h-full object-cover"
              />
            </div>
          </button>
        </div>
      )}

    </div>
  );
}
