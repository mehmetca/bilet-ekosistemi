"use client";

import { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, Calendar, MapPin, Music2 } from "lucide-react";
import { supabase } from "@/lib/supabase-client";
import type { Event, EventCategory } from "@/types/database";
import { CATEGORY_LABELS } from "@/types/database";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";

export default function AdminEvents() {
  const { isAdmin } = useSimpleAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAdmin) return;
    fetchEvents();
  }, [isAdmin]);

  async function fetchEvents() {
    try {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .order("date", { ascending: false });

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error("Etkinlikler yüklenemedi:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Bu etkinliği silmek istediğinizden emin misiniz?")) return;

    try {
      const { error } = await supabase.from("events").delete().eq("id", id);
      if (error) throw error;
      
      setEvents(events.filter(event => event.id !== id));
    } catch (error) {
      console.error("Etkinlik silinemedi:", error);
      alert("Etkinlik silinemedi. Lütfen tekrar deneyin.");
    }
  }

  function handleEdit(event: Event) {
    // Ana sayfadaki form ile düzenleme
    window.location.href = `/?edit=${event.id}`;
  }

  if (!isAdmin) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <Music2 className="h-12 w-12 text-red-600 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-red-800 mb-2">
            Erişim Reddedildi
          </h2>
          <p className="text-red-600">
            Bu sayfaya sadece yöneticiler erişebilir.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center text-slate-500">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold text-slate-900">Etkinlikler</h2>
        <button
          onClick={() => window.location.href = "/"}
          className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
        >
          <Plus className="h-4 w-4" />
          Yeni Etkinlik
        </button>
      </div>

      {events.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500">
          <Music2 className="h-16 w-16 mx-auto text-slate-300 mb-4" />
          <p className="text-lg font-medium">Henüz etkinlik yok</p>
          <p className="mt-2 text-sm">İlk etkinliğinizi eklemek için "Yeni Etkinlik" butonuna tıklayın.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {events.map((event) => (
            <div
              key={event.id}
              className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="flex gap-6">
                <div className="w-24 h-24 rounded-lg bg-gradient-to-br from-primary-100 to-primary-50 flex items-center justify-center flex-shrink-0">
                  {event.image_url ? (
                    <img
                      src={event.image_url}
                      alt={event.title}
                      className="w-full h-full object-cover rounded-lg"
                    />
                  ) : (
                    <Music2 className="h-8 w-8 text-primary-400" />
                  )}
                </div>
                
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <span className="text-xs font-medium text-primary-600">
                        {CATEGORY_LABELS[event.category]}
                      </span>
                      <h3 className="mt-1 text-lg font-semibold text-slate-900">
                        {event.title}
                      </h3>
                      <p className="mt-2 text-sm text-slate-600 line-clamp-2">
                        {event.description}
                      </p>
                      <div className="mt-3 space-y-1 text-sm text-slate-500">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          {new Date(event.date).toLocaleDateString("tr-TR")} • {event.time}
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          {event.venue}, {event.location}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-end gap-2 ml-4">
                      <div className="text-right">
                        <span className="font-bold text-primary-600">
                          {Number(event.price_from) > 0
                            ? `€${Number(event.price_from).toLocaleString("de-DE")}`
                            : "Ücretsiz"}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(event)}
                          className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(event.id)}
                          className="p-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
