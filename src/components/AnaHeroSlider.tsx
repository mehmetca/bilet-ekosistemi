"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";

interface Advertisement {
  id: string;
  title: string;
  image_url: string;
  link_url: string | null;
  placement: string;
  is_active: boolean;
  sort_order?: number | null;
  locale?: string | null;
  overlay_title?: string | null;
  overlay_day?: string | null;
  overlay_month_year?: string | null;
}

function isInternalLink(href: string) {
  return href.startsWith("/");
}

export default function AnaHeroSlider({ placement = "main_slider" }: { placement?: string }) {
  const locale = useLocale();
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlay, setIsAutoPlay] = useState(true);
  const shownAds = ads.slice(0, 10);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [wrapWidth, setWrapWidth] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        const fetchAds = async (localeParam?: string) => {
          const url = localeParam
            ? `/api/advertisements?locale=${encodeURIComponent(localeParam)}`
            : "/api/advertisements";

          const res = await fetch(url);
          if (!res.ok) return [];
          const payload = (await res.json()) as Advertisement[];
          return payload || [];
        };

        const payloadLocalized = await fetchAds(locale);
        const localizedFiltered = payloadLocalized
          .filter((a) => a?.is_active && a?.placement === placement && !!a?.image_url)
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

        // Eğer mevcut dilde hiç slider yoksa (özellikle de/en tarafında),
        // TR veya locale'siz reklamları da yedek olarak göstereceğiz.
        if (localizedFiltered.length === 0 && locale !== "tr") {
          const payloadAll = await fetchAds(undefined);
          const allFiltered = payloadAll
            .filter((a) => a?.is_active && a?.placement === placement && !!a?.image_url)
            .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

          if (!cancelled) setAds(allFiltered);
          return;
        }

        if (!cancelled) setAds(localizedFiltered);
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [locale, placement]);

  useEffect(() => {
    function update() {
      const w = wrapRef.current?.clientWidth ?? 0;
      setWrapWidth(w);
    }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    // ads geldikten sonra bir kez daha ölçelim (ilk render'da 0 gelmesin).
    if (!wrapRef.current) return;
    requestAnimationFrame(() => {
      const w = wrapRef.current?.clientWidth ?? 0;
      setWrapWidth(w);
    });
  }, [shownAds.length]);

  useEffect(() => {
    if (shownAds.length === 0) return;
    setCurrentIndex((prev) => (prev >= shownAds.length ? 0 : prev));
  }, [shownAds.length]);

  useEffect(() => {
    if (!isAutoPlay) return;
    if (shownAds.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % shownAds.length);
    }, 4500);

    return () => clearInterval(interval);
  }, [isAutoPlay, shownAds.length]);

  function goPrev() {
    if (shownAds.length === 0) return;
    setIsAutoPlay(false);
    setCurrentIndex((prev) => (prev - 1 + shownAds.length) % shownAds.length);
  }

  function goNext() {
    if (shownAds.length === 0) return;
    setIsAutoPlay(false);
    setCurrentIndex((prev) => (prev + 1) % shownAds.length);
  }

  function goToIndex(index: number) {
    if (index < 0 || index >= shownAds.length) return;
    setIsAutoPlay(false);
    setCurrentIndex(index);
  }

  if (loading || shownAds.length === 0) return null;

  return (
    <div className="w-full">
      <div
        className="relative w-full"
        onMouseEnter={() => setIsAutoPlay(false)}
        onMouseLeave={() => setIsAutoPlay(true)}
      >
        {shownAds.length > 1 && (
          <div className="absolute right-3 top-1/2 z-[2000] -translate-y-1/2 flex flex-col gap-2 pointer-events-auto sm:right-4 md:right-auto md:left-4 md:gap-3">
            {shownAds.map((ad, idx) => (
              <button
                key={ad.id || idx}
                type="button"
                onClick={() => goToIndex(idx)}
                aria-label={`Slide ${idx + 1}`}
                className={`h-2.5 w-2.5 rounded-full shadow-md transition-all sm:h-3 sm:w-3 ${
                  idx === currentIndex ? "bg-primary-600 scale-110" : "bg-white hover:opacity-90"
                }`}
              />
            ))}
          </div>
        )}

        <div className="w-full overflow-hidden" ref={wrapRef}>
          <div
            className="heroSlider owl-carousel owl-theme flex transition-transform duration-500 ease-in-out"
            id="slider"
            style={{ transform: `translateX(-${currentIndex * (wrapWidth || 1)}px)` }}
          >
            {shownAds.map((ad, idx) => {
              const href = ad.link_url || "#";
              const order = idx + 1;
              const imgAlt = ad.title || "Slider";
              const group = "ANA-SLIDER";
              const overlayTitle = ad.overlay_title?.trim() || ad.title?.trim() || "HARIKA";
              const overlayDay = ad.overlay_day?.trim() || "05";
              const overlayMonthYear = ad.overlay_month_year?.trim() || "Mayıs 2026";
              const [overlayMonthRaw = "Mayıs", overlayYearRaw = "2026"] = overlayMonthYear.split(/\s+/);
              const overlayMonth = overlayMonthRaw;
              const overlayYear = overlayYearRaw;

              const inner = (
                <div className="w-full flex-shrink-0">
                  <div className="relative w-full h-[58vw] min-h-[220px] max-h-[360px] sm:h-[48vw] sm:max-h-[420px] lg:h-[36vw] lg:max-h-[520px] xl:h-[30vw] xl:max-h-[560px] bg-black">
                    <picture>
                      <img
                        src={ad.image_url}
                        alt={imgAlt}
                        className="w-full h-full object-cover object-[72%_top] sm:object-top"
                        loading={idx === currentIndex ? "eager" : "lazy"}
                      />
                    </picture>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-black/10" />
                    <div className="absolute inset-x-3 bottom-3 z-10 sm:inset-x-auto sm:left-10 sm:right-8 sm:top-1/2 sm:bottom-auto sm:-translate-y-1/2 md:left-14 md:right-10">
                      <div className="flex items-end gap-3 sm:items-center sm:gap-8 md:gap-10">
                        <div className="rounded-xl border border-white/35 bg-black/30 px-2.5 py-2 text-center text-white backdrop-blur-sm sm:rounded-2xl sm:px-5 sm:py-4 md:px-6 md:py-5">
                          <div className="text-3xl font-extrabold leading-none sm:text-5xl md:text-6xl">{overlayDay}</div>
                          <div className="mt-1 text-xs font-semibold leading-tight sm:text-base md:text-lg">{overlayMonth}</div>
                          <div className="mt-0.5 text-xs font-semibold leading-tight sm:text-base md:text-lg">{overlayYear}</div>
                        </div>
                        <h3 className="min-w-0 text-2xl font-extrabold leading-tight text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)] sm:text-5xl md:text-6xl lg:text-7xl">
                          {overlayTitle}
                        </h3>
                      </div>
                    </div>
                  </div>
                </div>
              );

              if (isInternalLink(href)) {
                return (
                  <Link
                    key={ad.id || idx}
                    href={href}
                    className="sliderItem block flex-shrink-0"
                    data-order={order}
                    data-slider-group={group}
                    data-slider-order={order}
                    data-slider-item={String(order)}
                    style={wrapWidth ? { width: `${wrapWidth}px` } : { width: "100%" }}
                  >
                    {inner}
                  </Link>
                );
              }

              return (
                <a
                  key={ad.id || idx}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="sliderItem block flex-shrink-0"
                  data-order={order}
                  data-slider-group={group}
                  data-slider-order={order}
                  data-slider-item={String(order)}
                  style={wrapWidth ? { width: `${wrapWidth}px` } : { width: "100%" }}
                >
                  {inner}
                </a>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}

