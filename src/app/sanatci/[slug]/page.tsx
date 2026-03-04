"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase-client";
import type { Artist } from "@/types/database";
import { Music2, Share2, Heart, ExternalLink } from "lucide-react";
import MDEditor from "@uiw/react-md-editor";
import { parseArtistBio } from "@/lib/artistProfile";
import Header from "@/components/Header";

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
  const [artist, setArtist] = useState<Artist | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

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

  const parsedProfile = parseArtistBio(artist?.bio);
  const topGallery = parsedProfile.gallery.filter((item) => item.position === "top");
  const bottomGallery = parsedProfile.gallery.filter((item) => item.position === "bottom");
  const leftGallery = parsedProfile.gallery.filter((item) => item.position === "left");
  const rightGallery = parsedProfile.gallery.filter((item) => item.position === "right");
  const youtubeEmbedUrls = parsedProfile.videoUrls
    .map((url) => getYouTubeEmbedUrl(url))
    .filter(Boolean) as string[];

  function handleFollowToggle() {
    if (!artist) return;
    try {
      const stored = window.localStorage.getItem("followed_artists");
      const followed = stored ? (JSON.parse(stored) as string[]) : [];
      const alreadyFollowing = followed.includes(artist.id);
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
          <p className="text-slate-600">Yükleniyor...</p>
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
            Sanatçı Bulunamadı
          </h1>
          <p className="text-slate-600 mb-6">
            <strong>"{resolvedParams.slug}"</strong> slug'ına sahip sanatçı sistemde kayıtlı değil.
          </p>
          <div className="space-y-3">
            <a
              href="/"
              className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              Ana Sayfaya Dön
            </a>
            <div className="text-sm text-slate-500">
              <p>Olası nedenler:</p>
              <ul className="text-left mt-2 space-y-1">
                <li>• Sanatçı slug'ı yanlış yazılmış olabilir</li>
                <li>• Sanatçı sistemden kaldırılmış olabilir</li>
                <li>• URL adresi hatalı olabilir</li>
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
      {/* Hero Section */}
      <div className="relative">
        <div className="relative h-80 bg-gradient-to-r from-primary-700 to-primary-600">
          {/* Content */}
          <div className="relative mx-auto w-full max-w-6xl px-4 h-full flex items-end pb-8">
            <div className="flex gap-6 items-end">
              {/* Artist Image */}
              <div className="w-48 h-48 md:w-52 md:h-52 bg-gradient-to-br from-primary-600 to-primary-700 rounded-lg overflow-hidden flex-shrink-0 shadow-2xl">
                {artist.image_url ? (
                  <img
                    src={artist.image_url}
                    alt={artist.name}
                    className="w-full h-full object-cover object-top"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Music2 className="h-12 w-12 text-white" />
                  </div>
                )}
              </div>
              
              {/* Artist Info */}
              <div className="flex-1 text-white">
                <h1 className="text-4xl font-bold mb-2">{artist.name}</h1>
                <p className="text-xl text-white/90 mb-4">{artist.tour_name}</p>
                
                {/* Action Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={handleFollowToggle}
                    className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                  >
                    <Heart className="h-4 w-4" />
                    {isFollowing ? "Takiptesin" : "Takip Et"}
                  </button>
                  <button
                    onClick={handleShare}
                    className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-lg font-medium transition-colors backdrop-blur-sm"
                  >
                    <Share2 className="h-4 w-4" />
                    Paylaş
                  </button>
                </div>
                {actionMessage && <p className="mt-3 text-sm text-white/90">{actionMessage}</p>}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl px-4 py-8">
        {/* Bio Section */}
        {(parsedProfile.content ||
          parsedProfile.gallery.length > 0 ||
          parsedProfile.videoUrls.length > 0 ||
          parsedProfile.socials.youtube ||
          parsedProfile.socials.spotify ||
          parsedProfile.socials.instagram ||
          parsedProfile.socials.website) && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Sanatçı Hakkında</h2>
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              {topGallery.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
                  {topGallery.map((item, index) => (
                    <div
                      key={`${item.url}-${index}`}
                      className="aspect-[4/3] rounded-lg overflow-hidden border border-slate-200 bg-slate-100"
                    >
                      <img
                        src={item.url}
                        alt={`${artist.name} galeri`}
                        className="h-full w-full object-cover object-top"
                      />
                    </div>
                  ))}
                </div>
              )}
              {parsedProfile.content ? (
                <div className="flow-root">
                  {leftGallery.length > 0 && (
                    <div className="w-full md:w-64 md:float-left md:mr-5 mb-4 space-y-3">
                      {leftGallery.map((item, index) => (
                        <div
                          key={`${item.url}-left-${index}`}
                          className="aspect-[4/3] rounded-lg overflow-hidden border border-slate-200 bg-slate-100"
                        >
                          <img
                            src={item.url}
                            alt={`${artist.name} galeri`}
                            className="h-full w-full object-cover object-top"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  {rightGallery.length > 0 && (
                    <div className="w-full md:w-64 md:float-right md:ml-5 mb-4 space-y-3">
                      {rightGallery.map((item, index) => (
                        <div
                          key={`${item.url}-right-${index}`}
                          className="aspect-[4/3] rounded-lg overflow-hidden border border-slate-200 bg-slate-100"
                        >
                          <img
                            src={item.url}
                            alt={`${artist.name} galeri`}
                            className="h-full w-full object-cover object-top"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  <div data-color-mode="light">
                    <MDEditor.Markdown source={parsedProfile.content} />
                  </div>
                </div>
              ) : (
                <p className="text-slate-600">Biyografi bilgisi yakında eklenecek.</p>
              )}
              {bottomGallery.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-5">
                  {bottomGallery.map((item, index) => (
                    <div
                      key={`${item.url}-bottom-${index}`}
                      className="aspect-[4/3] rounded-lg overflow-hidden border border-slate-200 bg-slate-100"
                    >
                      <img
                        src={item.url}
                        alt={`${artist.name} galeri`}
                        className="h-full w-full object-cover object-top"
                      />
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
                  <h3 className="text-sm font-semibold text-slate-800 mb-3">Sosyal Bağlantılar</h3>
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
                      <h4 className="text-sm font-semibold text-slate-800 mb-3">Video</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {youtubeEmbedUrls.map((embedUrl, index) => (
                          <div
                            key={`${embedUrl}-${index}`}
                            className="aspect-video w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-100"
                          >
                            <iframe
                              src={embedUrl}
                              title={`${artist.name} YouTube videosu ${index + 1}`}
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
    </div>
  );
}
