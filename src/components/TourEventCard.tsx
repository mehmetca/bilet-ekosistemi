"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import type { TourEvent } from "@/types/database";

interface TourEventCardProps {
  event: TourEvent;
  artistName: string;
}

export default function TourEventCard({ event, artistName }: TourEventCardProps) {
  const eventDate = new Date(event.event_date);
  const day = eventDate.getDate();
  const month = eventDate.toLocaleDateString('de-DE', { month: 'long' });
  const year = eventDate.getFullYear();
  const dayName = eventDate.toLocaleDateString('de-DE', { weekday: 'short' });
  const time = eventDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  
  // Etkinlik durumunu kontrol et
  const isPast = eventDate < new Date();
  
  return (
    <div className={`bg-white border rounded-lg overflow-hidden hover:shadow-lg transition-shadow ${
      isPast ? 'border-slate-300 opacity-75' : 'border-slate-200'
    }`}>
      <div className="p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Sol Taraf - Tarih ve Bilgiler */}
          <div className="flex-1">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              {/* Tarih */}
              <div className={`p-4 rounded-lg md:w-32 text-center ${
                isPast 
                  ? 'bg-slate-100 text-slate-600' 
                  : 'bg-gradient-to-br from-primary-600 to-primary-700 text-white'
              }`}>
                <div className="text-2xl font-bold mb-1">{day}</div>
                <div className="text-sm uppercase tracking-wide mb-1">{month.slice(0, 3)}</div>
                <div className="text-xs opacity-90">{year}</div>
                <div className="text-xs mt-1 opacity-90">{dayName}. {time}</div>
                {isPast && (
                  <div className="text-xs font-medium text-red-600 mt-1">
                    SONA ERDİ
                  </div>
                )}
              </div>
              
              {/* Sanatçı ve Konum */}
              <div className="flex-1 text-center md:text-left">
                <div className={`text-lg font-bold mb-1 ${
                  isPast ? 'text-slate-600' : 'text-slate-900'
                }`}>
                  {artistName}
                </div>
                <div className={`flex items-center justify-center md:justify-start gap-2 ${
                  isPast ? 'text-slate-500' : 'text-slate-600'
                }`}>
                  <span className="font-medium">{event.city.toUpperCase()}</span>
                  <span>•</span>
                  <span>{event.venue}</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Sağ Taraf - Fiyat ve Satın Al */}
          <div className="flex flex-col items-end gap-3">
            {event.price && (
              <div className="text-right">
                <div className={`text-sm mb-1 ${
                  isPast ? 'text-slate-500' : 'text-slate-600'
                }`}>
                  Başlangıç Fiyatı
                </div>
                <div className={`text-2xl font-bold ${
                  isPast ? 'text-slate-600' : 'text-slate-900'
                }`}>
                  ab € {event.price.toFixed(2).replace('.', ',')}
                </div>
              </div>
            )}
            
            <div className="flex gap-2">
              <Link
                href={`/etkinlik/${event.id}`}
                className={`inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all ${
                  isPast
                    ? 'bg-slate-100 text-slate-600'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                Detaylar
              </Link>
              <button
                onClick={() => {
                  if (event.ticket_url) {
                    window.open(event.ticket_url, '_blank');
                  }
                }}
                className={`inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all transform hover:scale-105 shadow-lg whitespace-nowrap ${
                  isPast
                    ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-primary-600 to-primary-700 text-white hover:from-primary-700 hover:to-primary-800'
                }`}
                disabled={isPast}
              >
                {isPast ? 'Bitti' : 'Bilet Al'}
                {event.ticket_url && !isPast && <ExternalLink className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
