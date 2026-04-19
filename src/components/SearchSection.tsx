"use client";

import { useState } from "react";
import { Search as SearchIcon, Filter } from "lucide-react";
import type { Event, EventCategory } from "@/types/database";
import { CATEGORY_LABELS, DISPLAY_CATEGORIES } from "@/types/database";

interface SearchSectionProps {
  events: Event[];
  onFilteredEventsChange: (filteredEvents: Event[]) => void;
}

export default function SearchSection({ events, onFilteredEventsChange }: SearchSectionProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<EventCategory | "all">("all");
  const [locationFilter, setLocationFilter] = useState("");

  function handleSearch() {
    let filtered = events;

    // Başlık ve açıklamada arama
    if (searchTerm) {
      filtered = filtered.filter(event =>
        event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (event.description && event.description.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Kategori filtresi
    if (selectedCategory !== "all") {
      filtered = filtered.filter(event => event.category === selectedCategory);
    }

    // Konum filtresi
    if (locationFilter) {
      filtered = filtered.filter(event =>
        event.location.toLowerCase().includes(locationFilter.toLowerCase()) ||
        event.venue.toLowerCase().includes(locationFilter.toLowerCase())
      );
    }

    onFilteredEventsChange(filtered);
  }

  function handleReset() {
    setSearchTerm("");
    setSelectedCategory("all");
    setLocationFilter("");
    onFilteredEventsChange(events);
  }

  return (
    <section className="bg-gradient-to-br from-primary-600 to-primary-800 text-white py-20">
      <div className="container mx-auto px-4 text-center">
        <h1 className="text-4xl font-bold md:text-5xl">
          Hayalinizdeki Etkinliğe Bilet Bulun
        </h1>
        <p className="mt-4 text-lg text-primary-100">
          Konser, tiyatro, stand-up ve daha fazlası. Güvenli ödeme ile kolayca bilet alın.
        </p>
        
        <div className="mx-auto mt-8 max-w-4xl space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Etkinlik adı veya açıklamasında ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full rounded-xl border-0 py-3 pl-12 pr-4 text-slate-900"
              />
            </div>
            <button
              onClick={handleSearch}
              className="rounded-xl bg-white px-6 py-3 font-semibold text-primary-700 hover:bg-primary-50 transition-colors"
            >
              Ara
            </button>
          </div>
          
          <div className="flex gap-2 flex-wrap justify-center">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as EventCategory | "all")}
              className="rounded-lg border-0 bg-white/10 text-white px-4 py-2 backdrop-blur-sm hover:bg-white/20 transition-colors"
            >
              <option value="all" className="text-slate-900">Tüm Kategoriler</option>
              {DISPLAY_CATEGORIES.map((key) => (
                <option key={key} value={key} className="text-slate-900">
                  {CATEGORY_LABELS[key]}
                </option>
              ))}
            </select>
            
            <input
              type="text"
              placeholder="Şehir veya mekan..."
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="rounded-lg border-0 bg-white/10 text-white placeholder-white/70 px-4 py-2 backdrop-blur-sm hover:bg-white/20 transition-colors"
            />
            
            <button
              onClick={handleReset}
              className="rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-white backdrop-blur-sm hover:bg-white/20 transition-colors flex items-center gap-2"
            >
              <Filter className="h-4 w-4" />
              Filtreleri Temizle
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
