"use client";

import { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, Calendar, MapPin, Music2, Users } from "lucide-react";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";
import { supabase } from "@/lib/supabase-client";
import type { Artist, TourEvent } from "@/types/database";
import { useRouter } from "next/navigation";

const TURNER_ALLOWED_SLUGS = ["mem-ararat", "rojda"];

function isTurneArtist(artist: Artist): boolean {
  const slug = (artist.slug || "").toLowerCase();
  const name = (artist.name || "").toLowerCase();
  return (
    TURNER_ALLOWED_SLUGS.includes(slug) ||
    name.includes("mem ararat") ||
    name.includes("rojda")
  );
}

export default function TourManagementPage() {
  const { isAdmin, loading: authLoading } = useSimpleAuth();
  const router = useRouter();
  
  const [artists, setArtists] = useState<Artist[]>([]);
  const [tourEvents, setTourEvents] = useState<TourEvent[]>([]);
  const [selectedArtist, setSelectedArtist] = useState<Artist | null>(null);
  const [showAddEventForm, setShowAddEventForm] = useState(false);
  const [showAddArtistForm, setShowAddArtistForm] = useState(false);
  const [editingArtist, setEditingArtist] = useState<Artist | null>(null);
  const [editingEvent, setEditingEvent] = useState<TourEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const visibleArtists = artists.filter(isTurneArtist);
  const visibleArtistIdSet = new Set(visibleArtists.map((artist) => artist.id));
  const visibleTourEvents = tourEvents.filter(
    (event) => event.artist_id && visibleArtistIdSet.has(event.artist_id)
  );

  const [newArtist, setNewArtist] = useState({
    name: "",
    slug: "",
    tour_name: "",
    tour_start_date: new Date().toISOString().slice(0, 16),
    tour_end_date: new Date().toISOString().slice(0, 16),
    price_from: ""
  });

  const [newEvent, setNewEvent] = useState({
    city: "",
    venue: "",
    event_date: new Date().toISOString().slice(0, 16),
    price: "",
    ticket_url: ""
  });

  useEffect(() => {
    fetchArtists();
    fetchTourEvents();
  }, []);

  useEffect(() => {
    if (!selectedArtist) return;
    if (!visibleArtists.some((artist) => artist.id === selectedArtist.id)) {
      setSelectedArtist(null);
    }
  }, [selectedArtist, visibleArtists]);

  // Yetki kontrolü
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Yetkisiz Erişim</h1>
          <p className="text-slate-600 mb-4">Bu sayfaya erişim için admin yetkisi gereklidir.</p>
          <a href="/" className="text-primary-600 hover:text-primary-700 underline">
            Ana Sayfaya Dön
          </a>
        </div>
      </div>
    );
  }

  async function fetchArtists() {
    try {
      const { data, error } = await supabase
        .from("artists")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Artists fetch error:", error);
      } else {
        setArtists(data || []);
      }
    } catch (error) {
      console.error("Fetch artists error:", error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchTourEvents() {
    try {
      const { data, error } = await supabase
        .from("tour_events")
        .select(`
          *,
          artists!inner(
            name,
            slug
          )
        `)
        .order("event_date", { ascending: false });

      if (error) {
        console.error("Tour events fetch error:", error);
      } else {
        setTourEvents(data || []);
      }
    } catch (error) {
      console.error("Fetch tour events error:", error);
    }
  }

  async function handleAddArtist() {
    try {
      const { data, error } = await supabase
        .from("artists")
        .insert({
          ...newArtist,
          price_from: newArtist.price_from ? parseFloat(newArtist.price_from) : null,
          tour_start_date: new Date(newArtist.tour_start_date).toISOString(),
          tour_end_date: new Date(newArtist.tour_end_date).toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error("Artist creation error:", error);
        alert("Sanatçı eklenemedi: " + error.message);
      } else {
        
        alert("Sanatçı başarıyla eklendi!");
        setNewArtist({
          name: "",
          slug: "",
          tour_name: "",
          tour_start_date: new Date().toISOString().slice(0, 16),
          tour_end_date: new Date().toISOString().slice(0, 16),
          price_from: ""
        });
        setShowAddArtistForm(false);
        fetchArtists();
      }
    } catch (error) {
      console.error("Add artist error:", error);
      alert("Sanatçı eklenemedi!");
    }
  }

  async function handleUpdateArtist() {
    if (!editingArtist) return;

    try {
      const { data, error } = await supabase
        .from("artists")
        .update({
          ...newArtist,
          price_from: newArtist.price_from ? parseFloat(newArtist.price_from) : null,
          tour_start_date: new Date(newArtist.tour_start_date).toISOString(),
          tour_end_date: new Date(newArtist.tour_end_date).toISOString()
        })
        .eq("id", editingArtist.id)
        .select()
        .single();

      if (error) {
        console.error("Artist update error:", error);
        alert("Sanatçı güncellenemedi: " + error.message);
      } else {
        
        alert("Sanatçı başarıyla güncellendi!");
        setEditingArtist(null);
        setNewArtist({
          name: "",
          slug: "",
          tour_name: "",
          tour_start_date: new Date().toISOString().slice(0, 16),
          tour_end_date: new Date().toISOString().slice(0, 16),
          price_from: ""
        });
        fetchArtists();
      }
    } catch (error) {
      console.error("Update artist error:", error);
      alert("Sanatçı güncellenemedi!");
    }
  }

  function startEditArtist(artist: Artist) {
    setEditingArtist(artist);
    setNewArtist({
      name: artist.name,
      slug: artist.slug,
      tour_name: artist.tour_name || "",
      tour_start_date: artist.tour_start_date ? new Date(artist.tour_start_date).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16),
      tour_end_date: artist.tour_end_date ? new Date(artist.tour_end_date).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16),
      price_from: artist.price_from?.toString() || ""
    });
    setShowAddArtistForm(true);
  }

  function cancelEdit() {
    setEditingArtist(null);
    setShowAddArtistForm(false);
    setNewArtist({
      name: "",
      slug: "",
      tour_name: "",
      tour_start_date: new Date().toISOString().slice(0, 16),
      tour_end_date: new Date().toISOString().slice(0, 16),
      price_from: ""
    });
  }

  async function handleAddEvent() {
    if (!selectedArtist) {
      alert("Lütfen bir sanatçı seçin!");
      return;
    }

    try {
      const eventData = {
        ...newEvent,
        artist_id: selectedArtist.id,
        price: parseFloat(newEvent.price),
        event_date: new Date(newEvent.event_date).toISOString()
      };

      const response = await fetch("/api/tour-events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(eventData),
      });

      if (response.ok) {
        const data = await response.json();
        alert("Etkinlik başarıyla eklendi!");
        setNewEvent({
          city: "",
          venue: "",
          event_date: "",
          price: "",
          ticket_url: ""
        });
        setShowAddEventForm(false);
        setSelectedArtist(null);
        await fetchTourEvents();
      } else {
        const error = await response.json();
        alert("Etkinlik eklenemedi: " + error.error);
      }
    } catch (error) {
      console.error("Add event error:", error);
      alert("Etkinlik eklenemedi!");
    }
  }

  async function handleDeleteArtist(artistId: string) {
    if (!confirm("Bu sanatçıyı silmek istediğinizden emin misiniz? Bu işlem geri alınamaz!")) {
      return;
    }

    try {
      // Önce sanatçıya ait etkinlikleri sil
      const { error: eventsError } = await supabase
        .from("tour_events")
        .delete()
        .eq("artist_id", artistId);

      if (eventsError) {
        console.error("Delete events error:", eventsError);
        alert("Etkinlikler silinemedi: " + eventsError.message);
        return;
      }

      // Sonra sanatçıyı sil
      const { error: artistError } = await supabase
        .from("artists")
        .delete()
        .eq("id", artistId);

      if (artistError) {
        console.error("Delete artist error:", artistError);
        alert("Sanatçı silinemedi: " + artistError.message);
      } else {
        alert("Sanatçı ve etkinlikleri başarıyla silindi!");
        fetchArtists();
        fetchTourEvents();
        
        // Eğer silinen sanatçı seçiliyse, seçimi temizle
        if (selectedArtist?.id === artistId) {
          setSelectedArtist(null);
        }
      }
    } catch (error) {
      console.error("Delete artist error:", error);
      alert("Sanatçı silinemedi!");
    }
  }

  async function handleDeleteEvent(eventId: string) {
    if (!confirm("Bu etkinliği silmek istediğinizden emin misiniz?")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("tour_events")
        .delete()
        .eq("id", eventId);

      if (error) {
        console.error("Delete event error:", error);
        alert("Etkinlik silinemedi: " + error.message);
      } else {
        alert("Etkinlik başarıyla silindi!");
        fetchTourEvents();
      }
    } catch (error) {
      console.error("Delete event error:", error);
      alert("Etkinlik silinemedi!");
    }
  }

  async function handleUpdateEvent() {
    
    if (!editingEvent) {
      return;
    }

    try {
      
      
      const updateData = {
        ...newEvent,
        price: newEvent.price ? parseFloat(newEvent.price) : 0,
        event_date: new Date(newEvent.event_date).toISOString()
      };
      
      
      
      const { data, error } = await supabase
        .from("tour_events")
        .update(updateData)
        .eq("id", editingEvent.id)
        .select()
        .single();

      if (error) {
        console.error("Event update error:", error);
        alert("Etkinlik güncellenemedi: " + error.message);
      } else {
        alert("Etkinlik başarıyla güncellendi!");
        setEditingEvent(null);
        setNewEvent({
          city: "",
          venue: "",
          event_date: new Date().toISOString().slice(0, 16),
          price: "",
          ticket_url: ""
        });
        fetchTourEvents();
      }
    } catch (error) {
      console.error("Update event error:", error);
      alert("Etkinlik güncellenemedi!");
    }
  }

  function startEditEvent(event: TourEvent) {
    
    
    setEditingEvent(event);
    setNewEvent({
      city: event.city || "",
      venue: event.venue || "",
      event_date: event.event_date ? new Date(event.event_date).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16),
      price: event.price?.toString() || "",
      ticket_url: event.ticket_url || ""
    });
    setShowAddEventForm(true);
  }

  function cancelEventEdit() {
    setEditingEvent(null);
    setShowAddEventForm(false);
    setNewEvent({
      city: "",
      venue: "",
      event_date: new Date().toISOString().slice(0, 16),
      price: "",
      ticket_url: ""
    });
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Users className="h-16 w-16 mx-auto text-slate-300 mb-4" />
          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            Yetkisiz Erişim
          </h1>
          <p className="text-slate-600">
            Bu sayfaya erişim için admin yetkisi gereklidir.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Turne Yönetimi</h1>
          <button
            onClick={() => setShowAddArtistForm(true)}
            className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg font-medium"
          >
            <Plus className="h-4 w-4" />
            Sanatçı Ekle
          </button>
        </div>

        {/* Sanatçı Ekleme/Düzenleme Formu */}
        {showAddArtistForm && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 mb-8">
            <h2 className="text-xl font-bold text-slate-900 mb-6">
              {editingArtist ? "Sanatçı Düzenle" : "Yeni Sanatçı Ekle"}
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              <input
                type="text"
                placeholder="Sanatçı Adı"
                id="artist_name"
                name="name"
                value={newArtist.name}
                onChange={(e) => setNewArtist({ ...newArtist, name: e.target.value })}
                className="rounded-lg border border-slate-300 px-3 py-2"
              />
              <input
                type="text"
                placeholder="Slug (URL)"
                id="artist_slug"
                name="slug"
                value={newArtist.slug}
                onChange={(e) => setNewArtist({ ...newArtist, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                className="rounded-lg border border-slate-300 px-3 py-2"
              />
              <input
                type="text"
                placeholder="Turne Adı"
                id="artist_tour_name"
                name="tour_name"
                value={newArtist.tour_name}
                onChange={(e) => setNewArtist({ ...newArtist, tour_name: e.target.value })}
                className="rounded-lg border border-slate-300 px-3 py-2"
              />
              <input
                type="number"
                placeholder="Başlangıç Fiyatı"
                id="artist_price_from"
                name="price_from"
                value={newArtist.price_from}
                onChange={(e) => setNewArtist({ ...newArtist, price_from: e.target.value })}
                className="rounded-lg border border-slate-300 px-3 py-2"
              />
              <input
                type="datetime-local"
                placeholder="Turne Başlangıç"
                id="artist_tour_start_date"
                name="tour_start_date"
                value={newArtist.tour_start_date}
                onChange={(e) => setNewArtist({ ...newArtist, tour_start_date: e.target.value })}
                className="rounded-lg border border-slate-300 px-3 py-2"
              />
              <input
                type="datetime-local"
                placeholder="Turne Bitiş"
                id="artist_tour_end_date"
                name="tour_end_date"
                value={newArtist.tour_end_date}
                onChange={(e) => setNewArtist({ ...newArtist, tour_end_date: e.target.value })}
                className="rounded-lg border border-slate-300 px-3 py-2"
              />
            </div>
            <p className="mt-4 text-sm text-slate-600">
              Bu sayfa yalnızca turne bilgilerini ve turne etkinliklerini yönetir.
              Sanatçı biyografisi, sosyal bağlantılar ve görseller için{" "}
              <a href="/yonetim/sanatcilar" className="text-primary-600 hover:text-primary-700 underline">
                Sanatçılar
              </a>{" "}
              sayfasını kullanın.
            </p>
            <div className="flex gap-2 mt-4">
              <button
                onClick={editingArtist ? handleUpdateArtist : handleAddArtist}
                className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg font-medium"
              >
                {editingArtist ? "Güncelle" : "Sanatçı Ekle"}
              </button>
              <button
                onClick={cancelEdit}
                className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-lg font-medium"
              >
                İptal
              </button>
            </div>
          </div>
        )}

        {/* Sanatçı Seçimi ve Etkinlik Ekleme/Düzenleme */}
        {showAddEventForm && (
          <>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-blue-800 text-sm">Form açık! showAddEventForm: {showAddEventForm.toString()}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-6 mb-8">
            <h2 className="text-xl font-bold text-slate-900 mb-6">
              {editingEvent ? "Turne Etkinliği Düzenle" : "Turne Etkinliği Ekle"}
            </h2>
          <div className="grid gap-4 md:grid-cols-2 mb-6">
            <select
              id="event_artist_id"
              name="artist_id"
              value={selectedArtist?.id || ""}
              onChange={(e) => {
                const artist = visibleArtists.find(a => a.id === e.target.value);
                setSelectedArtist(artist || null);
              }}
              className="rounded-lg border border-slate-300 px-3 py-2"
            >
              <option value="">Sanatçı Seçin</option>
              {visibleArtists.map(artist => (
                <option key={artist.id} value={artist.id}>
                  {artist.name}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Şehir"
              id="event_city"
              name="city"
              value={newEvent.city}
              onChange={(e) => setNewEvent({ ...newEvent, city: e.target.value })}
              className="rounded-lg border border-slate-300 px-3 py-2"
            />
            <input
              type="text"
              placeholder="Mekan"
              id="event_venue"
              name="venue"
              value={newEvent.venue}
              onChange={(e) => setNewEvent({ ...newEvent, venue: e.target.value })}
              className="rounded-lg border border-slate-300 px-3 py-2"
            />
            <input
              type="datetime-local"
              placeholder="Etkinlik Tarihi"
              id="event_date"
              name="event_date"
              value={newEvent.event_date}
              onChange={(e) => setNewEvent({ ...newEvent, event_date: e.target.value })}
              className="rounded-lg border border-slate-300 px-3 py-2"
            />
            <input
              type="number"
              placeholder="Fiyat"
              id="event_price"
              name="price"
              value={newEvent.price}
              onChange={(e) => setNewEvent({ ...newEvent, price: e.target.value })}
              className="rounded-lg border border-slate-300 px-3 py-2"
            />
            <input
              type="url"
              placeholder="Bilet URL"
              id="event_ticket_url"
              name="ticket_url"
              value={newEvent.ticket_url}
              onChange={(e) => setNewEvent({ ...newEvent, ticket_url: e.target.value })}
              className="rounded-lg border border-slate-300 px-3 py-2 md:col-span-2"
            />
          </div>
          <div className="flex gap-2">
            <button
                onClick={() => {
                if (editingEvent) {
                  handleUpdateEvent();
                } else {
                  handleAddEvent();
                }
              }}
              className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg font-medium"
            >
              {editingEvent ? "Güncelle" : "Etkinlik Ekle"}
            </button>
            <button
              onClick={cancelEventEdit}
              className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-lg font-medium"
            >
              İptal
            </button>
          </div>
        </div>
          </>
        )}

        {/* Etkinlik Ekleme Butonu */}
        {!showAddEventForm && (
          <div className="text-center mb-8">
            <button
              onClick={() => {
                console.log("Yeni Etkinlik Ekle clicked");
                console.log("showAddEventForm before:", showAddEventForm);
                setShowAddEventForm(true);
                // Zorla render et
                setTimeout(() => {
                  console.log("showAddEventForm after timeout:", showAddEventForm);
                }, 100);
              }}
              className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg font-medium"
            >
              <Plus className="h-4 w-4" />
              Yeni Etkinlik Ekle
            </button>
          </div>
        )}

        {/* Sanatçı Listesi */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-xl font-bold text-slate-900 mb-6">Sanatçılar</h2>
          {visibleArtists.length === 0 ? (
            <p className="text-slate-500 text-center py-8">
              Turne yönetimi için sadece Rojda ve Mem Ararat gösteriliyor.
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {visibleArtists.map((artist) => (
                <div key={artist.id} className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 
                        className="font-semibold text-slate-900 text-lg hover:text-primary-600 cursor-pointer transition-colors"
                        onClick={() => window.open(`/sanatci/${artist.slug}`, '_blank')}
                        title="Sanatçı detay sayfasını aç"
                      >
                        {artist.name}
                      </h3>
                      <p className="text-sm text-slate-600 mt-1">{artist.tour_name}</p>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => startEditArtist(artist)}
                        className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50"
                        title="Sanatçıyı Düzenle"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteArtist(artist.id)}
                        className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50"
                        title="Sanatçıyı Sil"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center text-slate-600">
                      <Calendar className="h-4 w-4 mr-2" />
                      {artist.tour_start_date && artist.tour_end_date ? (
                        <span>
                          {new Date(artist.tour_start_date).toLocaleDateString("tr-TR")} - {new Date(artist.tour_end_date).toLocaleDateString("tr-TR")}
                        </span>
                      ) : (
                        <span>Tarih belirtilmemiş</span>
                      )}
                    </div>
                    
                    {artist.price_from && (
                      <div className="flex items-center text-slate-600">
                        <span className="font-medium">€{(typeof artist.price_from === 'string' ? parseFloat(artist.price_from) : artist.price_from).toLocaleString("de-DE")}'den başlayan fiyatlar</span>
                      </div>
                    )}
                    {/* Sanatçıya Ait Etkinlikler */}
                    <div className="mt-4 pt-4 border-t border-slate-200">
                      <h4 className="font-medium text-slate-900 mb-3 flex items-center">
                        <Music2 className="h-4 w-4 mr-2" />
                        Turne Etkinlikleri
                      </h4>
                      {visibleTourEvents.filter(event => event.artist_id === artist.id).length === 0 ? (
                        <p className="text-slate-500 text-sm italic">Henüz etkinlik eklenmemiş.</p>
                      ) : (
                        <div className="space-y-2">
                          {visibleTourEvents
                            .filter(event => event.artist_id === artist.id)
                            .sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime())
                            .map((event) => (
                              <div key={event.id} className="bg-slate-50 rounded-lg p-3 text-sm">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center text-slate-900 font-medium mb-1">
                                      <MapPin className="h-3 w-3 mr-1" />
                                      {event.city} - {event.venue}
                                    </div>
                                    <div className="flex items-center text-slate-600 text-xs">
                                      <Calendar className="h-3 w-3 mr-1" />
                                      {new Date(event.event_date).toLocaleDateString("tr-TR")}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 ml-2">
                                    <span className="text-slate-900 font-medium">€{event.price}</span>
                                    <button
                                      onClick={() => startEditEvent(event)}
                                      className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50"
                                      title="Etkinliği Düzenle"
                                    >
                                      <Edit2 className="h-3 w-3" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteEvent(event.id)}
                                      className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50"
                                      title="Etkinliği Sil"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
