"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import Header from "@/components/Header";
import { extractMapEmbedUrl } from "@/lib/mapEmbed";
import { getLocalizedVenue } from "@/lib/i18n-content";
import { MapPin, Users, Car, DoorOpen, HelpCircle } from "lucide-react";
import { supabase } from "@/lib/supabase-client";

const SHARED_VENUE_HERO_URL = "/images/venue-shared-hero.png";

interface VenueFaqItem {
  soru: string;
  cevap: string;
}

export default function MekanDetailPage({ params }: { params: { id: string } }) {
  const t = useTranslations("venues");
  const tCommon = useTranslations("common");
  const locale = useLocale() as "tr" | "de" | "en";

  const [venueRaw, setVenueRaw] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [faqOpen, setFaqOpen] = useState(false);
  const [isGalleryModalOpen, setIsGalleryModalOpen] = useState(false);
  const [galleryModalIndex, setGalleryModalIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function fetchVenue() {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("venues")
          .select("*")
          .eq("id", params.id)
          .single();

        if (error || !data) return;

        if (!cancelled) setVenueRaw(data as Record<string, unknown>);
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchVenue();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  const localized = useMemo(() => {
    if (!venueRaw) return null;
    return getLocalizedVenue(venueRaw, locale);
  }, [venueRaw, locale]);

  const legacyHeroUrl = useMemo(() => {
    if (!venueRaw) return "";
    return (
      (venueRaw.image_url_1 as string | null) ||
      (venueRaw.image_url_2 as string | null) ||
      (venueRaw.image_url_3 as string | null) ||
      (venueRaw.image_url_4 as string | null) ||
      (venueRaw.image_url_5 as string | null) ||
      (venueRaw.seating_layout_image_url as string | null) ||
      ""
    );
  }, [venueRaw]);

  const gallery = useMemo(() => {
    if (!venueRaw) return [];
    const items = [
      venueRaw.image_url_1 as string | null,
      venueRaw.image_url_2 as string | null,
      venueRaw.image_url_3 as string | null,
      venueRaw.image_url_4 as string | null,
      venueRaw.image_url_5 as string | null,
      venueRaw.seating_layout_image_url as string | null,
    ].filter(Boolean) as string[];
    const uniqueItems = Array.from(new Set(items));
    if (!legacyHeroUrl) return uniqueItems;
    return [legacyHeroUrl, ...uniqueItems.filter((url) => url !== legacyHeroUrl)];
  }, [venueRaw, legacyHeroUrl]);

  const coverUrl = gallery[0] || "";

  function openGalleryModal(index: number) {
    if (index < 0 || index >= gallery.length) return;
    setGalleryModalIndex(index);
    setIsGalleryModalOpen(true);
  }

  function closeGalleryModal() {
    setIsGalleryModalOpen(false);
  }

  function goGalleryPrev() {
    if (gallery.length === 0) return;
    setGalleryModalIndex((prev) => (prev - 1 + gallery.length) % gallery.length);
  }

  function goGalleryNext() {
    if (gallery.length === 0) return;
    setGalleryModalIndex((prev) => (prev + 1) % gallery.length);
  }

  const mapUrl = useMemo(() => {
    const mapEmbed = venueRaw?.map_embed_url as string | null | undefined;
    if (!mapEmbed) return null;
    return extractMapEmbedUrl(mapEmbed);
  }, [venueRaw]);

  useEffect(() => {
    if (!isGalleryModalOpen) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closeGalleryModal();
      if (e.key === "ArrowLeft") goGalleryPrev();
      if (e.key === "ArrowRight") goGalleryNext();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isGalleryModalOpen, gallery.length]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f6f8]">
        <Header />
        <div className="mx-auto max-w-5xl px-4 py-16 text-center text-slate-600">{t("title")}</div>
      </div>
    );
  }

  if (!venueRaw || !localized) {
    return (
      <div className="min-h-screen bg-[#f5f6f8]">
        <Header />
        <div className="mx-auto max-w-5xl px-4 py-16 text-center text-slate-600">Mekan bulunamadı.</div>
      </div>
    );
  }

  const addr = localized.address || (venueRaw.address as string | null) || "";
  const cityName = localized.city || (venueRaw.city as string | null) || "";
  const capacity = venueRaw.capacity != null ? Number(venueRaw.capacity) : null;

  const seatingDesc = localized.seating_layout_description;
  const transportInfo = localized.transport_info;
  const entranceInfo = localized.entrance_info;
  const rules = localized.rules;

  const venueFaq = (Array.isArray(venueRaw.faq) ? (venueRaw.faq as VenueFaqItem[]) : []).filter((x) => x?.soru && x?.cevap);
  const venueId = String(venueRaw.id ?? params.id);
  const venueName = localized.name || (venueRaw.name as string | null) || venueId;

  return (
    <div className="min-h-screen bg-[#f5f6f8]">
      <Header />

      {isGalleryModalOpen && gallery[galleryModalIndex] && (
        <div
          className="fixed inset-0 z-[1000] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Galeri"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeGalleryModal();
          }}
        >
          <div className="relative w-full max-w-5xl">
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 rounded-full bg-black/50 border border-white/10 px-3 py-1 text-xs font-semibold text-white">
              {galleryModalIndex + 1} / {gallery.length}
            </div>
            <div className="w-full h-[80vh] overflow-hidden rounded-xl border border-white/20 bg-transparent">
              <img
                src={gallery[galleryModalIndex]}
                alt={`${localized.name || (venueRaw?.id as string) || "Venue"} fotoğraf`}
                className="w-full h-full object-cover object-top"
              />
            </div>

            <button
              type="button"
              onClick={goGalleryPrev}
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/55 hover:bg-black/80 p-3 text-white transition-colors shadow-sm border border-white/15"
              aria-label="Önceki"
            >
              &lt;
            </button>

            <button
              type="button"
              onClick={goGalleryNext}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/55 hover:bg-black/80 p-3 text-white transition-colors shadow-sm border border-white/15"
              aria-label="Sonraki"
            >
              &gt;
            </button>

            <button
              type="button"
              onClick={closeGalleryModal}
              className="absolute top-3 right-3 rounded-full bg-black/70 hover:bg-black/90 text-white px-3 py-2 text-sm font-semibold border border-white/20"
              aria-label={tCommon("close")}
            >
              {tCommon("close")}
            </button>
          </div>
        </div>
      )}

      <div className="relative">
        <div className="h-44 sm:h-56 md:h-72 bg-black">
          {SHARED_VENUE_HERO_URL ? (
            <img src={SHARED_VENUE_HERO_URL} alt={`${venueName} hero`} className="h-full w-full object-cover object-top" />
          ) : (
            <div className="h-full w-full bg-slate-200" />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/30 to-black/70" />
        </div>

        <div className="absolute inset-x-0 bottom-[-26px]">
          <div className="mx-auto max-w-5xl px-4 pb-6">
            <div className="rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 p-5">
              <div className="flex flex-col gap-2">
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white truncate">
                  {venueName}
                </h1>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 pt-16 pb-10">
        {/* Ayrıntılar */}
        <div className="grid gap-6 xl:grid-cols-[1fr_340px] xl:items-start">
          <div className="space-y-4">
            {seatingDesc && (
              <div
                className="text-slate-700 prose prose-sm max-w-none [&_p]:my-1 [&_ul]:my-2"
                dangerouslySetInnerHTML={{ __html: seatingDesc }}
              />
            )}

            {transportInfo && (
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <Car className="h-4 w-4 text-primary-600" /> {t("transport")}
                </h3>
                <div
                  className="text-slate-700 prose prose-sm max-w-none mt-3 [&_p]:my-1 [&_ul]:my-2"
                  dangerouslySetInnerHTML={{ __html: transportInfo || "" }}
                />
              </div>
            )}

            {entranceInfo && (
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <h3 className="text-sm font-semibold text-slate-800">{t("entrance")}</h3>
                <div
                  className="mt-2 text-slate-700 prose prose-sm max-w-none [&_p]:my-1 [&_ul]:my-2"
                  dangerouslySetInnerHTML={{ __html: entranceInfo }}
                />
              </div>
            )}

            {rules && (
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <h3 className="text-sm font-semibold text-slate-800">{t("salonRules")}</h3>
                <div
                  className="mt-2 text-slate-700 prose prose-sm max-w-none [&_p]:my-1 [&_ul]:my-2"
                  dangerouslySetInnerHTML={{ __html: rules }}
                />
              </div>
            )}

          </div>

          <div className="space-y-4">
            {/* Adres/Kapasite bilgisi (SSS üstü) */}
            {(addr || cityName || capacity != null) && (
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="space-y-2">
                  {(addr || cityName) && (
                    <p className="flex items-center gap-2 text-sm text-slate-700">
                      <MapPin className="h-4 w-4 text-primary-600" />
                      <span>{[addr, cityName].filter(Boolean).join(", ")}</span>
                    </p>
                  )}

                  {capacity != null && (
                    <p className="flex items-center gap-2 text-sm text-slate-700">
                      <Users className="h-4 w-4 text-primary-600" />
                      <span>
                        {t("capacity")}: {capacity} {t("persons")}
                      </span>
                    </p>
                  )}
                </div>
              </div>
            )}

            {venueFaq.length > 0 && (
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-slate-800">{t("faqCount")}</h3>
                  <button
                    type="button"
                    onClick={() => setFaqOpen((v) => !v)}
                    className="flex items-center gap-2 text-sm font-medium text-primary-600 hover:text-primary-700"
                    aria-expanded={faqOpen}
                    aria-label={faqOpen ? t("faqShow") : `${venueFaq.length} ${t("faqCount")}`}
                  >
                    <HelpCircle className={`h-4 w-4 transition-transform ${faqOpen ? "rotate-180" : ""}`} />
                    <span className="whitespace-nowrap">
                      {venueFaq.length} {t("faqCount")}
                    </span>
                  </button>
                </div>
                <div
                  className={`space-y-3 border-l-2 border-primary-200 pl-4 overflow-hidden transition-all duration-300 ${
                    faqOpen ? "max-h-[500px] opacity-100 pt-4" : "max-h-0 opacity-0 pt-0"
                  }`}
                  aria-hidden={!faqOpen}
                >
                  {venueFaq.map((item, i) => (
                    <div key={i} className="space-y-1">
                      <p className="font-medium text-slate-800">{item.soru}</p>
                      <p className="text-sm text-slate-600 leading-relaxed">{item.cevap}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Sağ tarafta küçük kapak özeti / görsel */}
            {coverUrl && gallery.length === 1 && (
              <div className="rounded-xl overflow-hidden border border-slate-200 bg-white">
                <img src={coverUrl} alt={`${venueName} kapak`} className="w-full h-52 object-cover object-top" />
              </div>
            )}
          </div>
        </div>

        {/* Tam Galeri */}
        {gallery.length > 0 && (
          <div className="mt-10">
            <h3 className="text-sm font-semibold text-slate-800 mb-4">
              {t("gallery")} ({gallery.length})
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {gallery.map((src, idx) => (
                <button
                  key={`${src}-${idx}`}
                  type="button"
                  onClick={() => openGalleryModal(idx)}
                  className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 hover:shadow-sm transition-shadow text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                >
                  <img
                    src={src}
                    alt={`${localized.name || "Venue"} fotoğraf ${idx + 1}`}
                    className="w-full h-44 sm:h-56 md:h-64 lg:h-72 object-cover object-top"
                  />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Harita (tam genişlik) */}
        {mapUrl && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-slate-800 mb-2">{t("map")}</h3>
            <div className="w-full aspect-video overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <iframe
                src={mapUrl}
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title={`${localized.name || venueId} ${t("map")}`}
                className="h-full w-full"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

