"use client";

import { useState } from "react";
import { Filter, Calendar, MapPin } from "lucide-react";
import TourEventCard from "./TourEventCard";
import type { TourEvent, Artist } from "@/types/database";

interface TourEventListProps {
  events: TourEvent[];
  artist: Artist;
}

export default function TourEventList({ events, artist }: TourEventListProps) {
  const [selectedCity, setSelectedCity] = useState<string>("");
  const [sortBy, setSortBy] = useState<"date" | "city" | "price">("date");

  // Şehir listesi
  const cities = Array.from(new Set(events.map(event => event.city))).sort();

  // Filtrelenmiş ve sıralanmış etkinlikler
  const filteredEvents = events
    .filter(event => !selectedCity || event.city === selectedCity)
    .sort((a, b) => {
      switch (sortBy) {
        case "date":
          return new Date(a.event_date).getTime() - new Date(b.event_date).getTime();
        case "city":
          return a.city.localeCompare(b.city);
        case "price":
          return a.price - b.price;
        default:
          return 0;
      }
    });

  return (
    <div id="tour-events" className="container mx-auto px-4 py-12">
      {/* Başlık */}
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-slate-900 mb-2">{artist.name} — Tour Termine</h2>
        <p className="text-sm text-slate-600 max-w-3xl mx-auto">Wählen Sie aus den folgenden Terminen Ihre bevorzugte Stadt und buchen Sie Ihre Tickets.</p>
      </div>

      <div className="grid gap-8 md:grid-cols-3">
        {/* Sol sütun: filtreler (sticky) */}
        <aside className="md:col-span-1">
          <div className="sticky top-6 bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Filter</h3>
            <div className="mb-4">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
                <MapPin className="h-4 w-4" />
                Stadt
              </label>
              <select
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              >
                <option value="">Alle Städte</option>
                {cities.map(city => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
                <Calendar className="h-4 w-4" />
                Sortieren
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as "date" | "city" | "price")}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              >
                <option value="date">Datum</option>
                <option value="city">Stadt</option>
                <option value="price">Preis</option>
              </select>
            </div>

            <div className="pt-4 border-t border-slate-100 text-sm text-slate-600">
              <div>{filteredEvents.length} Termine{selectedCity && ` in ${selectedCity}`}</div>
            </div>
          </div>
        </aside>

        {/* Sağ sütun: etkinlik listesi */}
        <section className="md:col-span-2 space-y-6">
          {filteredEvents.length > 0 ? (
            filteredEvents.map(event => (
              <div key={event.id}>
                <TourEventCard event={event} artistName={artist.name} />
              </div>
            ))
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
              <Filter className="h-16 w-16 mx-auto text-slate-300 mb-4" />
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Keine Termine gefunden</h3>
              <p className="text-slate-600">{selectedCity ? `Keine Termine in ${selectedCity} gefunden.` : 'Keine Termine für diese Tour gefunden.'}</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
