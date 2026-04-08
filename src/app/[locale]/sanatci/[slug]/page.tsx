"use client";

import { useState, useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { supabase } from "@/lib/supabase-client";
import type { Artist, Event } from "@/types/database";
import { Music2, Share2, Heart, ExternalLink, Calendar, MapPin } from "lucide-react";
import MDEditor from "@uiw/react-md-editor";
import { parseArtistBio } from "@/lib/artistProfile";
import { getLocalizedArtist, getLocalizedEvent } from "@/lib/i18n-content";
import { formatPrice } from "@/lib/formatPrice";
import { CATEGORY_LABELS } from "@/types/database";
import Header from "@/components/Header";
import { Link } from "@/i18n/navigation";
import { formatEventDateDMY } from "@/lib/date-utils";

function getYouTubeEmbedUrl(url?: string): string | null {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase().replace("www.", "");
    let videoId = "";

    if (host === "youtube.com" || host === "m.youtube.com") {
      if (parsed.pathname === "/watch") {
        videoId = parsed.searchParams.get("v") || "";
      } else if (parsed.pathname.startsWith("/shorts/")) {
        videoId = parsed.pathname.split("/")[2] || "";
      } else if (parsed.pathname.startsWith("/embed/")) {
        videoId = parsed.pathname.split("/")[2] || "";
      }
    } else if (host === "youtu.be") {
      videoId = parsed.pathname.replace("/", "");
    }

    if (!videoId) return null;
    return `https://www.youtube.com/embed/${videoId}`;
  } catch {
    return null;
  }
}

export default function ArtistPage({ params }: { params: { slug: string } }) {
  const resolvedParams = params;
  const locale = useLocale() as "tr" | "de" | "en";
  const t = useTranslations("artists");
  const tCommon = useTranslations("common");
  const tHome = useTranslations("home");
  const [artist, setArtist] = useState<Artist | null>(null);
  const [artistEvents, setArtistEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isGalleryModalOpen, setIsGalleryModalOpen] = useState(false);
  const [galleryModalIndex, setGalleryModalIndex] = useState(0);

  const fallbackImage =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 450'%3E%3Crect width='800' height='450' fill='%23e2e8f0'/%3E%3Cg fill='%2364748b'%3E%3Ccircle cx='330' cy='190' r='36'/%3E%3Cpath d='M220 330l95-95 70 70 55-55 140 140H220z'/%3E%3C/g%3E%3C/svg%3E";

  useEffect(() => {
    if (!actionMessage) return;
    const timer = window.setTimeout(() => setActionMessage(null), 2400);
    return () => window.clearTimeout(timer);
  }, [actionMessage]);

  useEffect(() => {
    if (!artist) return;
    try {
      const stored = window.localStorage.getItem("followed_artists");
      const followed = stored ? (JSON.parse(stored) as string[]) : [];
      setIsFollowing(followed.includes(artist.id));
    } catch {
      setIsFollowing(false);
    }
  }, [artist]);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        
        // Sanatçı verisini çek
        const { data: artistData, error: artistError } = await supabase
          .from("artists")
          .select("*")
          .eq("slug", resolvedParams.slug)
          .single();

        if (artistError) {
          console.error("Artist fetch error:", {
            error: artistError,
            slug: resolvedParams.slug,
            details: artistError.details,
            message: artistError.message,
            code: artistError.code
          });
          
          // Hata mesajını kullanıcıya göster
          if (artistError.code === 'PGRST116') {
            // Kayıt bulunamadı
            setArtist(null);
          } else {
            // Diğer veritabanı hataları
            console.error("Database error:", artistError);
            setArtist(null);
          }
          setLoading(false);
          return;
        }

        if (!artistData) {
          setArtist(null);
          setLoading(false);
          return;
        }

        setArtist(artistData as Artist);
      } catch (error) {
        console.error("Fetch error:", error);
        setArtist(null);
        setLoading(false);
        return;
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [resolvedParams.slug]);

  // Tüm yaklaşan etkinliklerden rastgele 3 adet çek (sayfa/sanatçı değişince farklı seçim)
  useEffect(() => {
    let cancelled = false;
    async function fetchEvents() {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const { data, error } = await supabase
          .from("events")
          .select("*")
          .eq("is_active", true)
          .gte("date", today)
          .order("date", { ascending: true })
          .limit(30);
        if (error || !data) return;
        const shuffled = [...(data as Event[])].sort(() => Math.random() - 0.5);
        if (!cancelled) setArtistEvents(shuffled.slice(0, 3));
      } catch {
        if (!cancelled) setArtistEvents([]);
      }
    }
    fetchEvents();
    return () => { cancelled = true; };
  }, [resolvedParams.slug]);

  const localized = artist ? getLocalizedArtist(artist as unknown as Record<string, unknown>, locale) : { name: "", bio: "" };
  const parsedProfile = parseArtistBio(localized.bio || artist?.bio);
  // Admin panelde ayrı "turne banner" alanı görünmüyorsa ana fotoğrafı da hero banner olarak kullan.
  const heroBannerUrl = parsedProfile.turneBannerUrl || artist?.image_url || "";
  const topGallery = parsedProfile.gallery.filter((item) => item.position === "top");
  const bottomGallery = parsedProfile.gallery.filter((item) => item.position === "bottom");
  const leftGallery = parsedProfile.gallery.filter((item) => item.position === "left");
  const rightGallery = parsedProfile.gallery.filter((item) => item.position === "right");
  const allGallery = [...topGallery, ...leftGallery, ...rightGallery, ...bottomGallery];

  function openGalleryModal(item: (typeof topGallery)[number]) {
    const idx = allGallery.indexOf(item);
    if (idx < 0) return;
    setGalleryModalIndex(idx);
    setIsGalleryModalOpen(true);
  }

  function closeGalleryModal() {
    setIsGalleryModalOpen(false);
  }

  function goGalleryPrev() {
    setGalleryModalIndex((prev) => {
      if (allGallery.length === 0) return 0;
      return (prev - 1 + allGallery.length) % allGallery.length;
    });
  }

  function goGalleryNext() {
    setGalleryModalIndex((prev) => {
      if (allGallery.length === 0) return 0;
      return (prev + 1) % allGallery.length;
    });
  }

  useEffect(() => {
    if (!isGalleryModalOpen) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closeGalleryModal();
      if (e.key === "ArrowLeft") goGalleryPrev();
      if (e.key === "ArrowRight") goGalleryNext();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGalleryModalOpen, allGallery.length]);
  const youtubeEmbedUrls = parsedProfile.videoUrls
    .map((url) => getYouTubeEmbedUrl(url))
    .filter(Boolean) as string[];

  async function handleFollowToggle() {
    if (!artist) return;
    const stored = window.localStorage.getItem("followed_artists");
    const followed = stored ? (JSON.parse(stored) as string[]) : [];
    const alreadyFollowing = followed.includes(artist.id);
    const action = alreadyFollowing ? "unfollow" : "follow";

    try {
      let sessionId = "";
      try {
        sessionId = sessionStorage.getItem("follow_session") || "";
        if (!sessionId) {
          sessionId = `fs_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
          sessionStorage.setItem("follow_session", sessionId);
        }
      } catch {
        /* ignore */
      }
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/artist-follow", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          artist_id: artist.id,
          action,
          session_id: sessionId || undefined,
        }),
      });
      const data = await res.json();
      if (!data.success && res.status >= 400) {
        throw new Error(data.message || "İşlem başarısız");
      }

      const next = alreadyFollowing
        ? followed.filter((id) => id !== artist.id)
        : [...followed, artist.id];
      window.localStorage.setItem("followed_artists", JSON.stringify(next));
      setIsFollowing(!alreadyFollowing);
      setActionMessage(
        alreadyFollowing ? `${artist.name} takipten cikarildi.` : `${artist.name} takip edildi.`
      );
    } catch {
      setActionMessage("Islem su anda tamamlanamadi.");
    }
  }

  async function handleShare() {
    if (!artist) return;
    const shareUrl = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({
          title: artist.name,
          text: `${artist.name} sanatci profilini inceleyin.`,
          url: shareUrl,
        });
        setActionMessage("Paylasim penceresi acildi.");
        return;
      }

      await navigator.clipboard.writeText(shareUrl);
      setActionMessage("Profil linki kopyalandi.");
    } catch {
      setActionMessage("Paylasim tamamlanamadi.");
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-slate-600">{t("loading")}</p>
        </div>
      </div>
    );
  }

  if (!artist) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="text-6xl mb-4">🎭</div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            {t("artistNotFound")}
          </h1>
          <p className="text-slate-600 mb-6">
            {t("artistNotFoundDesc", { slug: resolvedParams.slug })}
          </p>
          <div className="space-y-3">
            <a
              href="/"
              className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              {tCommon("backToHome")}
            </a>
            <div className="text-sm text-slate-500">
              <p>{t("possibleReasons")}</p>
              <ul className="text-left mt-2 space-y-1">
                <li>• {t("reason1")}</li>
                <li>• {t("reason2")}</li>
                <li>• {t("reason3")}</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <Header />
      {isGalleryModalOpen && allGallery[galleryModalIndex] && (
        <div
          className="fixed inset-0 z-[1000] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Foto galeri"
          onMouseDown={(e) => {
            // Arka plana tıklanınca kapat
            if (e.target === e.currentTarget) closeGalleryModal();
          }}
        >
          <div className="relative w-full max-w-4xl">
            <div className="w-full h-[80vh] overflow-hidden rounded-xl border border-white/20 bg-transparent">
              <img
                src={allGallery[galleryModalIndex].url}
                alt={`${localized.name || artist.name} galeri`}
                className="w-full h-full object-cover object-top"
              />
            </div>

            <button
              type="button"
              onClick={goGalleryPrev}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 hover:bg-black/70 p-2 text-white transition-colors"
              aria-label="Önceki"
            >
              &lt;
            </button>

            <button
              type="button"
              onClick={goGalleryNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 hover:bg-black/70 p-2 text-white transition-colors"
              aria-label="Sonraki"
            >
              &gt;
            </button>

            <button
              type="button"
              onClick={closeGalleryModal}
              className="absolute -top-3 -right-3 rounded-full bg-black/70 hover:bg-black/90 text-white px-3 py-2 text-sm font-semibold border border-white/20"
              aria-label={tCommon("close")}
            >
              {tCommon("close")}
            </button>
          </div>
        </div>
      )}
      {/* Hero Section */}
      <div className="relative">
        <div className="relative min-h-[320px] md:h-80 bg-black">
          {heroBannerUrl && (
            <img
              src={heroBannerUrl}
              alt={`${localized.name || artist.name} banner`}
              className="absolute left-1/2 top-0 h-auto max-h-full w-auto max-w-full -translate-x-1/2 object-top"
            />
          )}
          {heroBannerUrl && (
            <>
              <div className="absolute inset-y-0 left-0 w-2/5 bg-gradient-to-r from-black/90 via-black/55 to-transparent" />
              <div className="absolute inset-y-0 right-0 w-2/5 bg-gradient-to-l from-black/90 via-black/55 to-transparent" />
            </>
          )}
          {!heroBannerUrl && <div className="absolute inset-0 bg-black/55" />}
          {/* Content */}
          <div className="relative mx-auto w-full max-w-6xl px-4 py-6 md:py-0 md:h-full md:flex md:items-end md:pb-8">
            <div className="flex flex-col md:flex-row gap-4 md:gap-6 md:items-end">
              {/* Artist Image */}
              {!heroBannerUrl && (
                <div className="w-24 h-24 sm:w-32 sm:h-32 md:w-52 md:h-52 bg-gradient-to-br from-primary-600 to-primary-700 rounded-lg overflow-hidden flex-shrink-0 shadow-2xl self-start">
                  {artist.image_url ? (
                    <img
                      src={artist.image_url}
                      alt={artist.name}
                      className="w-full h-full object-cover object-top"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Music2 className="h-8 w-8 md:h-12 md:w-12 text-white" />
                    </div>
                  )}
                </div>
              )}
              
              {/* Artist Info */}
              <div className="flex-1 text-white min-w-0">
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-1 md:mb-2">{localized.name || artist.name}</h1>
                {artist.tour_name && <p className="text-base sm:text-lg md:text-xl text-white/90 mb-3 md:mb-4">{artist.tour_name}</p>}
                
                {/* Action Buttons - mobilde wrap, her zaman görünür */}
                <div className="flex flex-wrap gap-2 sm:gap-3">
                  <button
                    onClick={handleFollowToggle}
                    className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2.5 sm:px-6 sm:py-3 rounded-lg font-medium transition-colors text-sm sm:text-base"
                  >
                    <Heart className="h-4 w-4 flex-shrink-0" />
                    {isFollowing ? t("following") : t("follow")}
                  </button>
                  <button
                    onClick={handleShare}
                    className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2.5 sm:px-6 sm:py-3 rounded-lg font-medium transition-colors backdrop-blur-sm text-sm sm:text-base"
                  >
                    <Share2 className="h-4 w-4 flex-shrink-0" />
                    {tCommon("share")}
                  </button>
                </div>
                {actionMessage && <p className="mt-2 md:mt-3 text-sm text-white/90">{actionMessage}</p>}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl px-4 py-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
          {/* Sol: Bio Section */}
          <div className="min-w-0">
        {/* Bio Section */}
        {(parsedProfile.content ||
          parsedProfile.gallery.length > 0 ||
          parsedProfile.videoUrls.length > 0 ||
          parsedProfile.socials.youtube ||
          parsedProfile.socials.spotify ||
          parsedProfile.socials.instagram ||
          parsedProfile.socials.website) && (
          <div className="mb-8">
            <h2 className="section-title mb-4">
              {t("aboutArtist", { name: localized.name || artist.name })}
            </h2>
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              {topGallery.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
                  {topGallery.map((item, index) => (
                    <div
                      key={`${item.url}-${index}`}
                      className="aspect-[4/3] rounded-lg overflow-hidden border border-slate-200 bg-slate-100"
                    >
                      <button
                        type="button"
                        onClick={() => openGalleryModal(item)}
                        className="h-full w-full"
                        aria-label="Fotoğrafı büyüt"
                      >
                        <img
                          src={item.url}
                          alt={`${localized.name || artist.name} galeri`}
                          className="h-full w-full object-cover object-top"
                        />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {parsedProfile.content ? (
                <div className="flow-root">
                  {leftGallery.length > 0 && (
                    <div className="w-full md:w-96 md:float-left md:mr-5 mb-4">
                      <div className="grid grid-cols-1 gap-3">
                        {leftGallery.map((item, index) => (
                          <div
                            key={`${item.url}-left-${index}`}
                            className="aspect-[4/3] rounded-lg overflow-hidden border border-slate-200 bg-slate-100"
                          >
                            <button
                              type="button"
                              onClick={() => openGalleryModal(item)}
                              className="h-full w-full"
                              aria-label="Fotoğrafı büyüt"
                            >
                              <img
                                src={item.url}
                                alt={`${localized.name || artist.name} galeri`}
                                className="h-full w-full object-cover object-top"
                              />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {rightGallery.length > 0 && (
                    <div className="w-full md:w-96 md:float-right md:ml-5 mb-4">
                      <div className="grid grid-cols-1 gap-3">
                        {rightGallery.map((item, index) => (
                          <div
                            key={`${item.url}-right-${index}`}
                            className="aspect-[4/3] rounded-lg overflow-hidden border border-slate-200 bg-slate-100"
                          >
                            <button
                              type="button"
                              onClick={() => openGalleryModal(item)}
                              className="h-full w-full"
                              aria-label="Fotoğrafı büyüt"
                            >
                              <img
                                src={item.url}
                                alt={`${localized.name || artist.name} galeri`}
                                className="h-full w-full object-cover object-top"
                              />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div data-color-mode="light">
                    <MDEditor.Markdown source={parsedProfile.content} />
                  </div>
                </div>
              ) : (
                <p className="text-slate-600">{t("bioPlaceholder")}</p>
              )}
              {bottomGallery.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-5">
                  {bottomGallery.map((item, index) => (
                    <div
                      key={`${item.url}-bottom-${index}`}
                      className="aspect-[4/3] rounded-lg overflow-hidden border border-slate-200 bg-slate-100"
                    >
                      <button
                        type="button"
                        onClick={() => openGalleryModal(item)}
                        className="h-full w-full"
                        aria-label="Fotoğrafı büyüt"
                      >
                        <img
                          src={item.url}
                          alt={`${localized.name || artist.name} galeri`}
                          className="h-full w-full object-cover object-top"
                        />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {(parsedProfile.socials.youtube ||
                parsedProfile.socials.spotify ||
                parsedProfile.socials.instagram ||
                parsedProfile.socials.website ||
                youtubeEmbedUrls.length > 0) && (
                <div className="mt-6 pt-5 border-t border-slate-200">
                  <h3 className="text-sm font-semibold text-slate-800 mb-3">{t("socialLinks")}</h3>
                  <div className="flex flex-wrap gap-2">
                    {parsedProfile.socials.youtube && (
                      <a
                        href={parsedProfile.socials.youtube}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-md bg-red-50 text-red-700 px-3 py-2 text-sm font-medium hover:bg-red-100"
                      >
                        YouTube <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                    {parsedProfile.socials.spotify && (
                      <a
                        href={parsedProfile.socials.spotify}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-md bg-green-50 text-green-700 px-3 py-2 text-sm font-medium hover:bg-green-100"
                      >
                        Spotify <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                    {parsedProfile.socials.instagram && (
                      <a
                        href={parsedProfile.socials.instagram}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-md bg-pink-50 text-pink-700 px-3 py-2 text-sm font-medium hover:bg-pink-100"
                      >
                        Instagram <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                    {parsedProfile.socials.website && (
                      <a
                        href={parsedProfile.socials.website}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-md bg-slate-100 text-slate-700 px-3 py-2 text-sm font-medium hover:bg-slate-200"
                      >
                        Web Sitesi <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                  {youtubeEmbedUrls.length > 0 && (
                    <div className="mt-5">
                      <h4 className="text-sm font-semibold text-slate-800 mb-3">{t("video")}</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {youtubeEmbedUrls.map((embedUrl, index) => (
                          <div
                            key={`${embedUrl}-${index}`}
                            className="aspect-video w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-100"
                          >
                            <iframe
                              src={embedUrl}
                              title={`${localized.name || artist.name} video ${index + 1}`}
                              className="h-full w-full"
                              loading="lazy"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                              referrerPolicy="strict-origin-when-cross-origin"
                              allowFullScreen
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

          </div>

          {/* Sağ: Yaklaşan Etkinlikler */}
          <aside className="lg:sticky lg:top-24 space-y-4">
            <h2 className="card-title mb-4">{tHome("upcomingEvents")}</h2>
            <div className="space-y-4">
              {artistEvents.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-slate-500">
                  <Music2 className="h-12 w-12 mx-auto text-slate-300 mb-2" />
                  <p className="text-sm">{tHome("noEventsSlider")}</p>
                </div>
              ) : (
                artistEvents.map((event) => {
                  const eventDate = new Date(`${event.date} ${event.time || "00:00"}`);
                  const isPast = eventDate < new Date();
                  const localizedEvent = getLocalizedEvent(event as unknown as Record<string, unknown>, locale);
                  return (
                    <Link key={event.id} href={`/etkinlik/${(event as Event & { show_slug?: string }).show_slug || event.id}`}>
                      <div
                        className={`overflow-hidden rounded-xl border shadow-sm hover:shadow-md transition-shadow ${
                          isPast ? "bg-slate-50 border-slate-300 opacity-75" : "bg-white border-slate-200"
                        }`}
                      >
                        <div className="aspect-video bg-gradient-to-br from-primary-100 to-primary-50 flex items-center justify-center overflow-hidden relative">
                          {event.image_url ? (
                            <img
                              src={event.image_url}
                              alt={localizedEvent.title}
                              className="h-full w-full object-cover object-top"
                              onError={(e) => {
                                if (e.currentTarget.dataset.fallbackApplied === "1") return;
                                e.currentTarget.dataset.fallbackApplied = "1";
                                e.currentTarget.src = fallbackImage;
                              }}
                            />
                          ) : (
                            <Music2 className="h-12 w-12 text-primary-400" />
                          )}
                          {isPast && (
                            <div className="absolute left-2 top-2">
                              <span className="px-2 py-1 text-xs font-bold text-white bg-red-600 rounded">
                                {tHome("eventEnded")}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="p-4">
                          <span className="text-xs font-medium text-primary-600">
                            {CATEGORY_LABELS[event.category as keyof typeof CATEGORY_LABELS] ?? event.category ?? "Etkinlik"}
                          </span>
                          <h3 className={`font-semibold line-clamp-2 mt-1 mb-2 ${isPast ? "text-slate-600" : "text-slate-900"}`}>
                            {localizedEvent.title}
                          </h3>
                          <div className="space-y-1 text-sm text-slate-600">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
                              <span>{formatEventDateDMY(event.date)} • {event.time}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                              <span className="line-clamp-1">{localizedEvent.venue || event.venue}, {event.location}</span>
                            </div>
                          </div>
                          <div className="mt-3 pt-3 border-t border-slate-100">
                            <span className={`font-bold ${isPast ? "text-slate-500" : "text-primary-600"}`}>
                              {Number(event.price_from) > 0
                                ? `${tHome("from")} ${formatPrice(Number(event.price_from), event.currency)}`
                                : tHome("free")}
                            </span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
