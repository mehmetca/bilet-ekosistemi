"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Edit2, Trash2, Calendar, MapPin, Music2, Users, Plus, ExternalLink } from "lucide-react";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";
import { supabase } from "@/lib/supabase-client";
import type { Artist, Event, TourEvent } from "@/types/database";
import AdminImageUploadFixed from "@/components/AdminImageUploadFixed";
import { buildArtistBio, parseArtistBio } from "@/lib/artistProfile";

export default function ArtistDetailPage() {
  const { slug } = useParams();
  const router = useRouter();
  const { isAdmin, loading: authLoading } = useSimpleAuth();
  
  const [artist, setArtist] = useState<Artist | null>(null);
  const [tourEvents, setTourEvents] = useState<TourEvent[]>([]);
  const [availableEvents, setAvailableEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddEventForm, setShowAddEventForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<TourEvent | null>(null);
  const [editingArtist, setEditingArtist] = useState(false);

  const [newEvent, setNewEvent] = useState({
    city: "",
    venue: "",
    event_date: new Date().toISOString().slice(0, 16),
    price: "",
    event_mode: "external" as "external" | "internal",
    linked_event_id: "",
    ticket_url: "",
    image_url: ""
  });

  const [editedArtist, setEditedArtist] = useState({
    name: "",
    slug: "",
    tour_name: "",
    tour_start_date: "",
    tour_end_date: "",
    price_from: ""
  });
  const [turneProfile, setTurneProfile] = useState({
    info_title: "",
    info_text: "",
    banner_url: "",
    external_url: "",
  });

  useEffect(() => {
    if (slug) {
      fetchArtist();
    }
  }, [slug]);

  useEffect(() => {
    if (artist) {
      fetchTourEvents();
    }
  }, [artist]);

  useEffect(() => {
    fetchAvailableEvents();
  }, []);

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
          <button
            onClick={() => router.push("/")}
            className="text-primary-600 hover:text-primary-700 underline"
          >
            Ana Sayfaya Dön
          </button>
        </div>
      </div>
    );
  }

  async function fetchArtist() {
    try {
      const { data, error } = await supabase
        .from("artists")
        .select("*")
        .eq("slug", slug)
        .single();

      if (error) {
        console.error("Artist fetch error:", error);
        router.push("/yonetim/turneler");
      } else {
        const parsed = parseArtistBio(data.bio);
        setArtist(data);
        setEditedArtist({
          name: data.name,
          slug: data.slug,
          tour_name: data.tour_name || "",
          tour_start_date: data.tour_start_date ? new Date(data.tour_start_date).toISOString().slice(0, 16) : "",
          tour_end_date: data.tour_end_date ? new Date(data.tour_end_date).toISOString().slice(0, 16) : "",
          price_from: data.price_from?.toString() || ""
        });
        setTurneProfile({
          info_title: parsed.turneInfoTitle || "Artist Info",
          info_text: parsed.turneInfoText || parsed.cardText || "",
          banner_url: parsed.turneBannerUrl || "",
          external_url: parsed.turneExternalUrl || "",
        });
      }
    } catch (error) {
      console.error("Fetch artist error:", error);
      router.push("/yonetim/turneler");
    } finally {
      setLoading(false);
    }
  }

  async function fetchTourEvents() {
    if (!artist) return;
    
    try {
      const { data, error } = await supabase
        .from("tour_events")
        .select("*")
        .eq("artist_id", artist.id)
        .order("event_date", { ascending: true });

      if (error) {
        console.error("Tour events fetch error:", error);
      } else {
        setTourEvents(data || []);
      }
    } catch (error) {
      console.error("Fetch tour events error:", error);
    }
  }

  async function fetchAvailableEvents() {
    try {
      const { data, error } = await supabase
        .from("events")
        .select("id,title,date,time,location,venue,price_from,image_url,category,is_active,slug,ticket_url,created_at,updated_at")
        .order("date", { ascending: false });

      if (error) {
        console.error("Events fetch error:", error);
      } else {
        setAvailableEvents((data || []) as Event[]);
      }
    } catch (error) {
      console.error("Fetch events error:", error);
    }
  }

  async function handleAddEvent() {
    if (!artist) return;
    if (newEvent.event_mode === "internal" && !newEvent.linked_event_id) {
      alert("Lütfen dahili etkinlik seçin.");
      return;
    }
    if (newEvent.event_mode === "external" && !newEvent.ticket_url.trim()) {
      alert("Lütfen harici bilet URL girin.");
      return;
    }

    try {
      const eventData = {
        city: newEvent.city,
        venue: newEvent.venue,
        image_url: newEvent.image_url || null,
        artist_id: artist.id,
        price: parseFloat(newEvent.price),
        event_date: new Date(newEvent.event_date).toISOString(),
        event_id:
          newEvent.event_mode === "internal" && newEvent.linked_event_id
            ? newEvent.linked_event_id
            : null,
        ticket_url:
          newEvent.event_mode === "external" && newEvent.ticket_url.trim()
            ? newEvent.ticket_url.trim()
            : null,
      };

      const response = await fetch("/api/tour-events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(eventData),
      });

      if (response.ok) {
        alert("Etkinlik başarıyla eklendi!");
        setNewEvent({
          city: "",
          venue: "",
          event_date: new Date().toISOString().slice(0, 16),
          price: "",
          event_mode: "external",
          linked_event_id: "",
          ticket_url: "",
          image_url: ""
        });
        setShowAddEventForm(false);
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

  async function handleUpdateEvent() {
    if (!editingEvent) return;
    if (newEvent.event_mode === "internal" && !newEvent.linked_event_id) {
      alert("Lütfen dahili etkinlik seçin.");
      return;
    }
    if (newEvent.event_mode === "external" && !newEvent.ticket_url.trim()) {
      alert("Lütfen harici bilet URL girin.");
      return;
    }

    try {
      const updateData = {
        city: newEvent.city,
        venue: newEvent.venue,
        image_url: newEvent.image_url || null,
        price: newEvent.price ? parseFloat(newEvent.price) : 0,
        event_date: new Date(newEvent.event_date).toISOString(),
        event_id:
          newEvent.event_mode === "internal" && newEvent.linked_event_id
            ? newEvent.linked_event_id
            : null,
        ticket_url:
          newEvent.event_mode === "external" && newEvent.ticket_url.trim()
            ? newEvent.ticket_url.trim()
            : null,
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
          event_mode: "external",
          linked_event_id: "",
          ticket_url: "",
          image_url: ""
        });
        setShowAddEventForm(false);
        await fetchTourEvents();
      }
    } catch (error) {
      console.error("Update event error:", error);
      alert("Etkinlik güncellenemedi!");
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
        await fetchTourEvents();
      }
    } catch (error) {
      console.error("Delete event error:", error);
      alert("Etkinlik silinemedi!");
    }
  }

  async function handleUpdateArtist() {
    if (!artist) return;

    try {
      const parsed = parseArtistBio(artist.bio);
      const rebuiltBio = buildArtistBio(
        parsed.content,
        parsed.gallery,
        parsed.socials,
        {
          text: parsed.cardText,
          lines: parsed.cardLines,
        },
        {
          urls: parsed.videoUrls,
        },
        {
          infoTitle: turneProfile.info_title,
          infoText: turneProfile.info_text,
          bannerUrl: turneProfile.banner_url,
          externalUrl: turneProfile.external_url,
        }
      );

      const { data, error } = await supabase
        .from("artists")
        .update({
          ...editedArtist,
          price_from: editedArtist.price_from ? parseFloat(editedArtist.price_from) : null,
          tour_start_date: editedArtist.tour_start_date ? new Date(editedArtist.tour_start_date).toISOString() : null,
          tour_end_date: editedArtist.tour_end_date ? new Date(editedArtist.tour_end_date).toISOString() : null,
          bio: rebuiltBio,
        })
        .eq("id", artist.id)
        .select()
        .single();

      if (error) {
        console.error("Artist update error:", error);
        alert("Sanatçı güncellenemedi: " + error.message);
      } else {
        alert("Sanatçı başarıyla güncellendi!");
        setArtist(data);
        setEditingArtist(false);
      }
    } catch (error) {
      console.error("Update artist error:", error);
      alert("Sanatçı güncellenemedi!");
    }
  }

  function startEditEvent(event: TourEvent) {
    setEditingEvent(event);
    setNewEvent({
      city: event.city || "",
      venue: event.venue || "",
      event_date: event.event_date ? new Date(event.event_date).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16),
      price: event.price?.toString() || "",
      event_mode: event.event_id ? "internal" : "external",
      linked_event_id: event.event_id || "",
      ticket_url: event.ticket_url || "",
      image_url: event.image_url || ""
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
      event_mode: "external",
      linked_event_id: "",
      ticket_url: "",
      image_url: ""
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!artist) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-4">Sanatçı Bulunamadı</h1>
          <button
            onClick={() => router.push("/yonetim/turneler")}
            className="text-primary-600 hover:text-primary-700 underline"
          >
            Turneler Sayfasına Dön
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/yonetim/turneler")}
              className="flex items-center gap-2 text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft className="h-5 w-5" />
              Turnelere Dön
            </button>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">{artist.name}</h1>
              <p className="text-slate-600">{artist.tour_name}</p>
            </div>
          </div>
          <button
            onClick={() => setEditingArtist(!editingArtist)}
            className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg font-medium"
          >
            <Edit2 className="h-4 w-4" />
            {editingArtist ? "İptal" : "Sanatçıyı Düzenle"}
          </button>
        </div>

        {/* Sanatçı Bilgileri */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-8">
          <h2 className="text-xl font-bold text-slate-900 mb-6">Sanatçı Bilgileri</h2>
          
          {editingArtist ? (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <input
                  type="text"
                  placeholder="Sanatçı Adı"
                  value={editedArtist.name}
                  onChange={(e) => setEditedArtist({ ...editedArtist, name: e.target.value })}
                  className="rounded-lg border border-slate-300 px-3 py-2"
                />
                <input
                  type="text"
                  placeholder="Slug (URL)"
                  value={editedArtist.slug}
                  onChange={(e) => setEditedArtist({ ...editedArtist, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                  className="rounded-lg border border-slate-300 px-3 py-2"
                />
                <input
                  type="text"
                  placeholder="Turne Adı"
                  value={editedArtist.tour_name}
                  onChange={(e) => setEditedArtist({ ...editedArtist, tour_name: e.target.value })}
                  className="rounded-lg border border-slate-300 px-3 py-2"
                />
                <input
                  type="number"
                  placeholder="Başlangıç Fiyatı"
                  value={editedArtist.price_from}
                  onChange={(e) => setEditedArtist({ ...editedArtist, price_from: e.target.value })}
                  className="rounded-lg border border-slate-300 px-3 py-2"
                />
                <input
                  type="datetime-local"
                  placeholder="Turne Başlangıç"
                  value={editedArtist.tour_start_date}
                  onChange={(e) => setEditedArtist({ ...editedArtist, tour_start_date: e.target.value })}
                  className="rounded-lg border border-slate-300 px-3 py-2"
                />
                <input
                  type="datetime-local"
                  placeholder="Turne Bitiş"
                  value={editedArtist.tour_end_date}
                  onChange={(e) => setEditedArtist({ ...editedArtist, tour_end_date: e.target.value })}
                  className="rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>
              <div className="rounded-lg border border-slate-200 p-4 space-y-4">
                <h3 className="text-sm font-semibold text-slate-900">Turne Sayfası İçeriği</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <input
                    type="text"
                    placeholder="Artist Info başlığı"
                    value={turneProfile.info_title}
                    onChange={(e) =>
                      setTurneProfile({ ...turneProfile, info_title: e.target.value })
                    }
                    className="rounded-lg border border-slate-300 px-3 py-2"
                  />
                  <input
                    type="url"
                    placeholder="Harici bağlantı (opsiyonel)"
                    value={turneProfile.external_url}
                    onChange={(e) =>
                      setTurneProfile({ ...turneProfile, external_url: e.target.value })
                    }
                    className="rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
                <textarea
                  placeholder="Artist Info içerik metni"
                  value={turneProfile.info_text}
                  onChange={(e) =>
                    setTurneProfile({ ...turneProfile, info_text: e.target.value })
                  }
                  rows={5}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Turne üst banner görseli
                  </label>
                  <AdminImageUploadFixed
                    value={turneProfile.banner_url}
                    onChange={(url) =>
                      setTurneProfile({ ...turneProfile, banner_url: url })
                    }
                    folder="turne-banners"
                  />
                  <p className="mt-2 text-xs text-slate-500">
                    Banner görselinde kesim gerekirse üst taraf esas alınır, alt kısım kesilir.
                  </p>
                </div>
              </div>
              <p className="text-sm text-slate-600">
                Bu sayfa yalnızca turne bilgilerinin düzenlenmesi içindir.
                Sanatçı biyografisi, sosyal bağlantılar ve görseller için{" "}
                <a href="/yonetim/sanatcilar" className="text-primary-600 hover:text-primary-700 underline">
                  Sanatçılar
                </a>{" "}
                sayfasını kullanın.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleUpdateArtist}
                  className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg font-medium"
                >
                  Güncelle
                </button>
                <button
                  onClick={() => setEditingArtist(false)}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-lg font-medium"
                >
                  İptal
                </button>
              </div>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <div className="space-y-3">
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
                </div>
              </div>
              
              <div>
                <h3 className="font-medium text-slate-900 mb-4">İstatistikler</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-slate-900">{tourEvents.length}</div>
                    <div className="text-sm text-slate-600">Toplam Etkinlik</div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-slate-900">
                      {tourEvents.filter(e => new Date(e.event_date) >= new Date()).length}
                    </div>
                    <div className="text-sm text-slate-600">Gelecek Etkinlik</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Etkinlik Ekleme Formu */}
        {showAddEventForm && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 mb-8">
            <h2 className="text-xl font-bold text-slate-900 mb-6">
              {editingEvent ? "Etkinlik Düzenle" : "Yeni Etkinlik Ekle"}
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              <input
                type="text"
                placeholder="Şehir"
                value={newEvent.city}
                onChange={(e) => setNewEvent({ ...newEvent, city: e.target.value })}
                className="rounded-lg border border-slate-300 px-3 py-2"
              />
              <input
                type="text"
                placeholder="Mekan"
                value={newEvent.venue}
                onChange={(e) => setNewEvent({ ...newEvent, venue: e.target.value })}
                className="rounded-lg border border-slate-300 px-3 py-2"
              />
              <input
                type="datetime-local"
                placeholder="Etkinlik Tarihi"
                value={newEvent.event_date}
                onChange={(e) => setNewEvent({ ...newEvent, event_date: e.target.value })}
                className="rounded-lg border border-slate-300 px-3 py-2"
              />
              <input
                type="number"
                placeholder="Fiyat"
                value={newEvent.price}
                onChange={(e) => setNewEvent({ ...newEvent, price: e.target.value })}
                className="rounded-lg border border-slate-300 px-3 py-2"
              />
              <select
                value={newEvent.event_mode}
                onChange={(e) =>
                  setNewEvent({
                    ...newEvent,
                    event_mode: e.target.value as "external" | "internal",
                    linked_event_id: e.target.value === "internal" ? newEvent.linked_event_id : "",
                    ticket_url: e.target.value === "external" ? newEvent.ticket_url : "",
                  })
                }
                className="rounded-lg border border-slate-300 px-3 py-2"
              >
                <option value="external">Harici bilet linki</option>
                <option value="internal">Dahili etkinlik (bizim satış)</option>
              </select>
              {newEvent.event_mode === "external" ? (
                <input
                  type="url"
                  placeholder="Bilet URL"
                  value={newEvent.ticket_url}
                  onChange={(e) => setNewEvent({ ...newEvent, ticket_url: e.target.value })}
                  className="rounded-lg border border-slate-300 px-3 py-2 md:col-span-2"
                />
              ) : (
                <select
                  value={newEvent.linked_event_id}
                  onChange={(e) =>
                    setNewEvent({ ...newEvent, linked_event_id: e.target.value })
                  }
                  className="rounded-lg border border-slate-300 px-3 py-2 md:col-span-2"
                >
                  <option value="">Dahili etkinlik seçin</option>
                  {availableEvents
                    .filter((evt) => evt.is_active)
                    .map((evt) => (
                      <option key={evt.id} value={evt.id}>
                        {evt.title} - {evt.venue} ({new Date(evt.date).toLocaleDateString("tr-TR")})
                      </option>
                    ))}
                </select>
              )}
              <AdminImageUploadFixed
                value={newEvent.image_url}
                onChange={(url) => setNewEvent({ ...newEvent, image_url: url })}
                folder="event-images"
              />
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={editingEvent ? handleUpdateEvent : handleAddEvent}
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
        )}

        {/* Etkinlik Listesi */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-slate-900 flex items-center">
              <Music2 className="h-5 w-5 mr-2" />
              Turne Etkinlikleri
            </h2>
            <button
              onClick={() => setShowAddEventForm(true)}
              className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg font-medium"
            >
              <Plus className="h-4 w-4" />
              Yeni Etkinlik
            </button>
          </div>
          
          {tourEvents.length === 0 ? (
            <div className="text-center py-8">
              <Music2 className="h-12 w-12 mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500 mb-4">Henüz etkinlik eklenmemiş.</p>
              <button
                onClick={() => setShowAddEventForm(true)}
                className="text-primary-600 hover:text-primary-700 underline"
              >
                İlk Etkinliği Ekle
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {tourEvents.map((event) => (
                <div key={event.id} className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 flex gap-4">
                      {event.image_url && (
                        <img 
                          src={event.image_url} 
                          alt={`${event.city} etkinliği`}
                          className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
                        />
                      )}
                      <div className="flex-1">
                        <div className="flex items-center text-slate-900 font-medium mb-2">
                          <MapPin className="h-4 w-4 mr-2" />
                          {event.city} - {event.venue}
                        </div>
                        <div className="flex items-center text-slate-600 text-sm mb-2">
                          <Calendar className="h-4 w-4 mr-2" />
                          {new Date(event.event_date).toLocaleDateString("tr-TR")} {new Date(event.event_date).toLocaleTimeString("tr-TR", { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-lg font-semibold text-slate-900">€{event.price}</span>
                          {event.ticket_url ? (
                            <a
                              href={event.ticket_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-primary-600 hover:text-primary-700 text-sm"
                            >
                              <ExternalLink className="h-3 w-3" />
                              Harici Bilet
                            </a>
                          ) : event.event_id ? (
                            <span className="inline-flex items-center gap-1 text-green-700 text-sm font-medium">
                              Dahili Bilet
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => startEditEvent(event)}
                        className="text-blue-600 hover:text-blue-900 p-2 rounded hover:bg-blue-50"
                        title="Etkinliği Düzenle"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteEvent(event.id)}
                        className="text-red-600 hover:text-red-900 p-2 rounded hover:bg-red-50"
                        title="Etkinliği Sil"
                      >
                        <Trash2 className="h-4 w-4" />
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
  );
}
