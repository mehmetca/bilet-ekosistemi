"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Calendar, MapPin, Music2 } from "lucide-react";
import Header from "@/components/Header";
import { supabase } from "@/lib/supabase-client";
import type { Artist, TourEvent } from "@/types/database";

const ALLOWED_TOUR_ARTIST_SLUGS = ["mem-ararat", "rojda"];

function isAllowedTourArtist(artist: Artist): boolean {
  const slug = (artist.slug || "").toLowerCase();
  const name = (artist.name || "").toLowerCase();
  return (
    ALLOWED_TOUR_ARTIST_SLUGS.includes(slug) ||
    name.includes("mem ararat") ||
    name.includes("rojda")
  );
}

export default function TurnePage() {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [events, setEvents] = useState<TourEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTurneData() {
      try {
        setLoading(true);

        const { data: allArtists, error: artistsError } = await supabase
          .from("artists")
          .select("*")
          .order("name", { ascending: true });

        if (artistsError) {
          console.error("Turne artist fetch error:", artistsError);
          setArtists([]);
          setEvents([]);
          return;
        }

        const turneArtists = ((allArtists || []) as Artist[]).filter(isAllowedTourArtist);
        setArtists(turneArtists);

        const artistIds = turneArtists.map((artist) => artist.id);
        if (artistIds.length === 0) {
          setEvents([]);
          return;
        }

        const { data: eventData, error: eventsError } = await supabase
          .from("tour_events")
          .select("*")
          .in("artist_id", artistIds)
          .order("event_date", { ascending: true });

        if (eventsError) {
          console.error("Turne events fetch error:", eventsError);
          setEvents([]);
          return;
        }

        setEvents((eventData || []) as TourEvent[]);
      } catch (error) {
        console.error("Turne data fetch exception:", error);
        setArtists([]);
        setEvents([]);
      } finally {
        setLoading(false);
      }
    }

    fetchTurneData();
  }, []);

  const eventsByArtistId = useMemo(() => {
    return events.reduce<Record<string, TourEvent[]>>((acc, event) => {
      const artistId = event.artist_id || "";
      if (!artistId) return acc;
      if (!acc[artistId]) acc[artistId] = [];
      acc[artistId].push(event);
      return acc;
    }, {});
  }, [events]);

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="container mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Turneler</h1>
          <p className="mt-2 text-slate-600">
            Aktif turne sanatçılarının etkinlik takvimini buradan takip edebilirsiniz.
          </p>
        </div>

        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-500">
            Yükleniyor...
          </div>
        ) : artists.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-500">
            Henüz turne sanatçısı bulunamadı.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {artists.map((artist) => {
              const artistEvents = eventsByArtistId[artist.id] || [];
              const nextEvent = artistEvents.find(
                (event) => event.event_date && new Date(event.event_date) >= new Date()
              );

              return (
                <article
                  key={artist.id}
                  className="rounded-xl border border-slate-200 bg-white overflow-hidden"
                >
                  <div className="flex flex-col sm:flex-row">
                    <div className="w-full sm:w-44 h-44 bg-slate-100">
                      {artist.image_url ? (
                        <img
                          src={artist.image_url}
                          alt={artist.name}
                          className="h-full w-full object-cover object-top"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-slate-400">
                          <Music2 className="h-8 w-8" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 p-4">
                      <h2 className="text-xl font-semibold text-slate-900">{artist.name}</h2>
                      <p className="mt-1 text-sm text-slate-600">
                        {artist.tour_name || "Turne adı yakında güncellenecek."}
                      </p>

                      <div className="mt-4 space-y-2 text-sm text-slate-700">
                        <p className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-slate-500" />
                          Toplam etkinlik: {artistEvents.length}
                        </p>
                        {nextEvent?.event_date && (
                          <p className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-slate-500" />
                            Sıradaki: {nextEvent.city} -{" "}
                            {new Date(nextEvent.event_date).toLocaleDateString("tr-TR")}
                          </p>
                        )}
                      </div>

                      <div className="mt-4">
                        <Link
                          href={`/turne/${artist.slug}`}
                          className="inline-flex items-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
                        >
                          Turne Detayı
                        </Link>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

