"use client";

import { Calendar, MapPin, Ticket, ExternalLink } from "lucide-react";
import type { Artist } from "@/types/database";

interface ArtistHeroProps {
  artist: Artist;
}

export default function ArtistHero({ artist }: ArtistHeroProps) {
  return (
    <div className="relative bg-gradient-to-br from-primary-600 to-primary-800 text-white">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-black/20" />
      
      <div className="relative site-container py-16">
        <div className="grid gap-8 lg:grid-cols-2 items-center">
          {/* Sol Taraf - Sanatçı Bilgileri */}
          <div className="space-y-6">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold mb-2">
                {artist.name}
              </h1>
              {artist.tour_name && (
                <p className="text-2xl text-primary-100 font-semibold">
                  {artist.tour_name}
                </p>
              )}
            </div>

            {/* Turne Tarih Aralığı */}
            {artist.tour_start_date && artist.tour_end_date && (
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5" />
                <span className="text-lg">
                  {new Date(artist.tour_start_date).toLocaleDateString("de-DE", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric"
                  })} – {new Date(artist.tour_end_date).toLocaleDateString("de-DE", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric"
                  })}
                </span>
              </div>
            )}

            {/* Fiyat Bilgisi */}
            {artist.price_from && (
              <div className="flex items-center gap-3">
                <Ticket className="h-5 w-5" />
                <span className="text-lg font-semibold">
                  Tickets ab €{Number(artist.price_from).toLocaleString("de-DE", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                </span>
              </div>
            )}

            {/* Sanatçı Açıklaması */}
            {artist.bio && (
              <p className="text-primary-100 leading-relaxed max-w-lg">
                {artist.bio}
              </p>
            )}

            {/* Termin Ansehen Butonu */}
            <button
              onClick={() => {
                const element = document.getElementById("tour-events");
                element?.scrollIntoView({ behavior: "smooth" });
              }}
              className="inline-flex items-center gap-2 bg-white text-primary-700 px-6 py-3 rounded-lg font-semibold hover:bg-primary-50 transition-colors"
            >
              <MapPin className="h-5 w-5" />
              Termin Ansehen
              <ExternalLink className="h-4 w-4" />
            </button>
          </div>

          {/* Sağ Taraf - Sanatçı Görseli */}
          <div className="flex justify-center lg:justify-end">
            <div className="relative w-64 h-64 lg:w-80 lg:h-80">
              {artist.image_url ? (
                <img
                  src={artist.image_url}
                  alt={artist.name}
                  className="w-full h-full object-cover rounded-2xl shadow-2xl"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary-400 to-primary-600 rounded-2xl shadow-2xl flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-6xl font-bold mb-2">
                      {artist.name.split(" ").map((word: string) => word[0]).join("")}
                    </div>
                    <p className="text-primary-100">Sanatçı Görseli</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
