"use client";

import { useEffect, useState } from "react";
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

const MONTH_EQUIV: Record<
  string,
  { tr: string; de: string; en: string; ku: string; ckb: string }
> = {
  ocak: { tr: "Ocak", de: "Januar", en: "January", ku: "Rêbendan", ckb: "کانوونی دووەم" },
  subat: { tr: "Şubat", de: "Februar", en: "February", ku: "Sibat", ckb: "شوبات" },
  mart: { tr: "Mart", de: "März", en: "March", ku: "Adar", ckb: "ئادار" },
  nisan: { tr: "Nisan", de: "April", en: "April", ku: "Avrêl", ckb: "نیسان" },
  mayis: { tr: "Mayıs", de: "Mai", en: "May", ku: "Gulan", ckb: "ئایار" },
  haziran: { tr: "Haziran", de: "Juni", en: "June", ku: "Pûşper", ckb: "حوزەیران" },
  temmuz: { tr: "Temmuz", de: "Juli", en: "July", ku: "Tîrmeh", ckb: "تەممووز" },
  agustos: { tr: "Ağustos", de: "August", en: "August", ku: "Tebax", ckb: "ئاب" },
  eylul: { tr: "Eylül", de: "September", en: "September", ku: "Rezber", ckb: "ئەیلوول" },
  ekim: { tr: "Ekim", de: "Oktober", en: "October", ku: "Cotmeh", ckb: "تشرینی یەکەم" },
  kasim: { tr: "Kasım", de: "November", en: "November", ku: "Sermawez", ckb: "تشرینی دووەم" },
  aralik: { tr: "Aralık", de: "Dezember", en: "December", ku: "Berfanbar", ckb: "کانوونی یەکەم" },
};

function normalizeMonthToken(token: string): string {
  return (token || "")
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .replace(/İ/g, "i")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z]/g, "");
}

function localizeOverlayMonth(monthRaw: string, locale: string): string {
  const key = normalizeMonthToken(monthRaw);
  const item = MONTH_EQUIV[key];
  if (!item) return monthRaw;
  const loc = (locale || "").toLowerCase();
  if (loc.startsWith("de")) return item.de;
  if (loc.startsWith("en")) return item.en;
  if (loc.startsWith("ku")) return item.ku;
  if (loc.startsWith("ckb")) return item.ckb;
  return item.tr;
}

function splitOverlayMonthYear(raw: string, locale: string): { month: string; year: string } {
  const text = (raw || "").trim();
  if (!text) return { month: "", year: "" };
  const parts = text.split(/\s+/).filter(Boolean);
  const yearToken = parts.find((p) => /^\d{4}$/.test(p)) || "";
  const monthToken =
    parts.find((p) => !/^\d+$/.test(p) && !/^\d{4}$/.test(p)) ||
    parts.find((p) => !/^\d{4}$/.test(p)) ||
    "";
  return {
    month: monthToken ? localizeOverlayMonth(monthToken, locale) : "",
    year: yearToken,
  };
}

export default function AnaHeroSlider({
  placement = "main_slider",
  initialAds,
}: {
  placement?: string;
  initialAds?: Advertisement[];
}) {
  const locale = useLocale();
  const hasInitialAds = Array.isArray(initialAds) && initialAds.length > 0;
  const [ads, setAds] = useState<Advertisement[]>(initialAds ?? []);
  const [loading, setLoading] = useState(!hasInitialAds);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlay, setIsAutoPlay] = useState(true);
  const shownAds = ads.slice(0, 10);


  useEffect(() => {
    if (hasInitialAds) return;
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
  }, [locale, placement, hasInitialAds]);

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

  if (loading) {
    return (
      <div className="w-full">
        <div className="aspect-[16/7] w-full animate-pulse bg-ink-100 sm:max-h-[480px] lg:aspect-[16/6] lg:max-h-[560px] xl:max-h-[640px]" />
      </div>
    );
  }

  if (shownAds.length === 0) return null;

  return (
    <div className="w-full">
      <div
        className="relative w-full"
        onMouseEnter={() => setIsAutoPlay(false)}
        onMouseLeave={() => setIsAutoPlay(true)}
      >
        {shownAds.length > 1 && (
          <div className="pointer-events-auto absolute bottom-1 left-1/2 z-[2000] flex -translate-x-1/2 flex-row items-center gap-0.5 rounded-full bg-ink-950/25 px-1.5 py-0.5 backdrop-blur-sm sm:bottom-auto sm:left-4 sm:top-1/2 sm:flex-col sm:-translate-x-0 sm:-translate-y-1/2">
            {shownAds.map((ad, idx) => (
              <button
                key={ad.id || idx}
                type="button"
                onClick={() => goToIndex(idx)}
                aria-label={`Slide ${idx + 1}`}
                aria-current={idx === currentIndex ? "true" : undefined}
                className="group flex h-9 w-6 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500/70 sm:h-6 sm:w-6"
              >
                <span
                  className={`block rounded-full transition-all duration-300 ease-out ${
                    idx === currentIndex
                      ? "h-1.5 w-5 bg-gold-500 shadow-[0_0_0_1px_rgba(14,14,13,0.25)] sm:h-5 sm:w-1.5"
                      : "h-1.5 w-1.5 bg-white/65 group-hover:bg-white/95 sm:h-1.5 sm:w-1.5"
                  }`}
                />
              </button>
            ))}
          </div>
        )}

        <div className="w-full overflow-hidden aspect-[16/7] sm:max-h-[480px] lg:aspect-[16/6] lg:max-h-[560px] xl:max-h-[640px]">
          <div
            className="heroSlider owl-carousel owl-theme flex h-full transition-transform duration-500 ease-in-out"
            id="slider"
            style={{ transform: `translateX(-${currentIndex * 100}%)` }}
          >
            {shownAds.map((ad, idx) => {
              const href = ad.link_url || "#";
              const order = idx + 1;
              const imgAlt = ad.title || "Slider";
              const group = "ANA-SLIDER";
              const overlayTitle = ad.overlay_title?.trim() || "";
              const overlayDay = ad.overlay_day?.trim() || "";
              const overlayMonthYear = ad.overlay_month_year?.trim() || "";
              const hasOverlay = Boolean(overlayTitle || overlayDay || overlayMonthYear);
              const { month: overlayMonth, year: overlayYear } = splitOverlayMonthYear(
                overlayMonthYear,
                locale
              );
              const showDateBox = Boolean(overlayDay || overlayMonth || overlayYear);

              const slide = (
                <div className="relative h-full w-full bg-black">
                    <picture>
                      <img
                        src={ad.image_url}
                        alt={imgAlt}
                        className="h-full w-full object-cover object-center"
                        loading={idx === currentIndex ? "eager" : "lazy"}
                      />
                    </picture>
                    {hasOverlay ? (
                      <>
                        <div className="poster-scrim pointer-events-none absolute inset-0" aria-hidden />
                        <div className="absolute inset-x-3 bottom-3 z-10 sm:inset-x-auto sm:left-10 sm:right-8 sm:top-1/2 sm:bottom-auto sm:-translate-y-1/2 md:left-14 md:right-10">
                          <div className="flex items-end gap-3 sm:items-center sm:gap-8 md:gap-10">
                            {showDateBox ? (
                              <div className="flex flex-col border-l-2 border-gold-500 pl-3 text-left sm:pl-4">
                                {overlayDay ? (
                                  <div className="font-display text-3xl font-semibold leading-none text-white drop-shadow-md sm:text-5xl md:text-6xl">
                                    {overlayDay}
                                  </div>
                                ) : null}
                                {overlayMonth ? (
                                  <div className="mt-1 text-[10px] font-semibold uppercase leading-tight tracking-widest2 text-gold-300 sm:text-xs md:text-sm">
                                    {overlayMonth}
                                  </div>
                                ) : null}
                                {overlayYear ? (
                                  <div className="mt-0.5 text-xs font-medium leading-tight text-white/70 sm:text-sm md:text-base">
                                    {overlayYear}
                                  </div>
                                ) : null}
                              </div>
                            ) : null}
                            {overlayTitle ? (
                              <h3 className="min-w-0 font-display text-2xl font-semibold leading-tight tracking-tight text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)] sm:text-5xl md:text-6xl lg:text-7xl">
                                {overlayTitle}
                              </h3>
                            ) : null}
                          </div>
                        </div>
                      </>
                    ) : null}
                  </div>
              );

              const slideWrapClass =
                "sliderItem block w-full shrink-0 grow-0 basis-full min-w-0";

              if (isInternalLink(href)) {
                return (
                  <Link
                    key={ad.id || idx}
                    href={href}
                    className={slideWrapClass}
                    data-order={order}
                    data-slider-group={group}
                    data-slider-order={order}
                    data-slider-item={String(order)}
                  >
                    {slide}
                  </Link>
                );
              }

              return (
                <a
                  key={ad.id || idx}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className={slideWrapClass}
                  data-order={order}
                  data-slider-group={group}
                  data-slider-order={order}
                  data-slider-item={String(order)}
                >
                  {slide}
                </a>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}

