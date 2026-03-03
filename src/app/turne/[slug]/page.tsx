"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Calendar, Clock3, ExternalLink, MapPin, Music2 } from "lucide-react";
import Header from "@/components/Header";
import { supabase } from "@/lib/supabase-client";
import { parseArtistBio } from "@/lib/artistProfile";
import type { Artist, TourEvent } from "@/types/database";

const ALLOWED_TOUR_ARTIST_SLUGS = ["mem-ararat", "rojda"];

function isAllowedTurneSlug(slug: string): boolean {
  return ALLOWED_TOUR_ARTIST_SLUGS.includes((slug || "").toLowerCase());
}

function formatDate(dateValue?: string) {
  if (!dateValue) return "-";
  const value = new Date(dateValue);
  return value.toLocaleDateString("tr-TR", {
    weekday: "short",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatTime(dateValue?: string) {
  if (!dateValue) return "";
  const value = new Date(dateValue);
  return value.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

export default function TurneDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = String(params?.slug || "");
  const [artist, setArtist] = useState<Artist | null>(null);
  const [events, setEvents] = useState<TourEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTurneDetail() {
      if (!slug) {
        setLoading(false);
        return;
      }

      if (!isAllowedTurneSlug(slug)) {
        setArtist(null);
        setEvents([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        const { data: artistData, error: artistError } = await supabase
          .from("artists")
          .select("*")
          .eq("slug", slug)
          .single();

        if (artistError || !artistData) {
          setArtist(null);
          setEvents([]);
          return;
        }

        const typedArtist = artistData as Artist;
        setArtist(typedArtist);

        const { data: eventData, error: eventsError } = await supabase
          .from("tour_events")
          .select("*")
          .eq("artist_id", typedArtist.id)
          .order("event_date", { ascending: true });

        if (eventsError) {
          console.error("Turne detail events error:", eventsError);
          setEvents([]);
          return;
        }

        setEvents((eventData || []) as TourEvent[]);
      } catch (error) {
        console.error("Turne detail fetch exception:", error);
        setArtist(null);
        setEvents([]);
      } finally {
        setLoading(false);
      }
    }

    fetchTurneDetail();
  }, [slug]);

  const parsed = useMemo(() => parseArtistBio(artist?.bio), [artist?.bio]);
  const upcomingEvents = useMemo(
    () =>
      events.filter((event) => event.event_date && new Date(event.event_date).getTime() >= Date.now()),
    [events]
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header />
        <main className="container mx-auto px-4 py-16">
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-500">
            Yükleniyor...
          </div>
        </main>
      </div>
    );
  }

  if (!artist) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header />
        <main className="container mx-auto px-4 py-16">
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
            <h1 className="text-2xl font-semibold text-slate-900">Turne bulunamadı</h1>
            <p className="mt-2 text-slate-600">
              Aradığınız turne yayında değil veya sadece sanatçı sayfasında gösteriliyor olabilir.
            </p>
            <Link
              href="/turne"
              className="mt-5 inline-flex items-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
            >
              Turne listesine dön
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />

      <section className="relative h-[220px] overflow-hidden bg-gradient-to-r from-primary-700 to-primary-600 md:h-[280px]">
        {(parsed.turneBannerUrl || artist.image_url) && (
          <img
            src={parsed.turneBannerUrl || artist.image_url || ""}
            alt={`${artist.name} turne banner`}
            className="absolute inset-0 h-full w-full object-cover object-top"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-primary-900/85 via-primary-700/80 to-primary-600/55" />

        <div className="relative mx-auto flex h-full w-full max-w-7xl items-center px-4">
          <div className="w-full md:max-w-xl">
            <p className="text-sm uppercase tracking-wide text-white/75">Turne</p>
            <h1 className="mt-1 text-4xl md:text-5xl font-extrabold text-white">{artist.name}</h1>
            <p className="mt-2 text-lg text-white/90">
              {artist.tour_name || "Güncel turne tarihleri ve bilet bağlantıları"}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/turne"
                className="inline-flex items-center rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-100"
              >
                Tüm turneler
              </Link>
              <Link
                href={`/sanatci/${artist.slug}`}
                className="inline-flex items-center rounded-lg border border-white/50 bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20"
              >
                Sanatçı Profili
              </Link>
              {parsed.turneExternalUrl && (
                <a
                  href={parsed.turneExternalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-white/50 bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20"
                >
                  Resmi Bağlantı <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 px-4 py-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 md:p-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-2xl font-bold text-slate-900">Available Events</h2>
              <span className="rounded-full bg-primary-50 px-3 py-1 text-sm font-medium text-primary-700">
                {upcomingEvents.length} etkinlik
              </span>
            </div>
          </div>

          {upcomingEvents.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
              Bu turne için yaklaşan etkinlik bulunamadı.
            </div>
          ) : (
            upcomingEvents.map((event) => (
              <article
                key={event.id}
                className="rounded-xl border border-slate-200 bg-white p-4 md:p-5 transition-shadow hover:shadow-md"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold uppercase tracking-wide text-primary-700">
                      {formatDate(event.event_date)}
                    </p>
                    <h3 className="mt-1 text-xl font-semibold text-slate-900">
                      {artist.name} - {event.city}
                    </h3>
                    <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-slate-600">
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="h-4 w-4" />
                        {event.venue}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Clock3 className="h-4 w-4" />
                        {formatTime(event.event_date)}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar className="h-4 w-4" />
                        {event.city}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-start gap-2 md:items-end">
                    <p className="text-lg font-bold text-slate-900">
                      {Number.isFinite(Number(event.price)) ? `€${Number(event.price).toLocaleString("de-DE")}` : "-"}
                    </p>
                    {event.ticket_url ? (
                      <a
                        href={event.ticket_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
                      >
                        Bileti Buradan Al <ExternalLink className="h-4 w-4" />
                      </a>
                    ) : event.event_id ? (
                      <Link
                        href={`/etkinlik/${event.event_id}`}
                        className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
                      >
                        Bilet Al
                      </Link>
                    ) : (
                      <button
                        disabled
                        className="inline-flex items-center rounded-lg bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-500"
                      >
                        Yakında
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))
          )}
        </section>

        <aside className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-lg font-semibold text-slate-900">
              {parsed.turneInfoTitle || "Artist Info"}
            </h3>
            <p className="mt-2 text-sm text-slate-600 line-clamp-6">
              {parsed.turneInfoText ||
                parsed.cardText ||
                parsed.content ||
                "Sanatçı açıklaması yakında güncellenecek."}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-lg font-semibold text-slate-900">Turne Özeti</h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              <li className="flex items-center gap-2">
                <Music2 className="h-4 w-4 text-slate-500" />
                Toplam etkinlik: {events.length}
              </li>
              <li className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-slate-500" />
                Yaklaşan etkinlik: {upcomingEvents.length}
              </li>
            </ul>
          </div>
        </aside>
      </main>
    </div>
  );
}

