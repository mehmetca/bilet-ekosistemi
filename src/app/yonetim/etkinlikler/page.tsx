"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Edit2, Trash2, Copy, Calendar, MapPin, Music2, CheckCircle, Heart, Bell, Building2, Shield, ChevronLeft, ChevronRight, History, ArrowLeft, ArrowRight } from "lucide-react";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";
import { supabase } from "@/lib/supabase-client";
import type { Event, EventCategory, EventCurrency } from "@/types/database";
import { CATEGORY_LABELS } from "@/types/database";
import { parseEventDescription } from "@/lib/eventMeta";
import { formatPrice } from "@/lib/formatPrice";
import { logAudit } from "@/lib/audit";

async function withTimeout(
  requestFactory: (signal: AbortSignal) => any,
  timeoutMs = 30000,
  message = "İstek zaman aşımına uğradı."
): Promise<any> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await Promise.resolve(requestFactory(controller.signal));
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(message);
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export default function EtkinliklerPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">Yükleniyor...</div>}>
      <EtkinliklerContent />
    </Suspense>
  );
}

const PAST_EVENTS_PAGE_SIZE = 20;

function EtkinliklerContent() {
  const { user, isAdmin, isOrganizer } = useSimpleAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [eventStats, setEventStats] = useState<Record<string, { favorites: number; reminders: number }>>({});
  const [organizerNames, setOrganizerNames] = useState<Record<string, string>>({});
  const [currentUserOrganizerName, setCurrentUserOrganizerName] = useState<string | null>(null);
  const [pastPage, setPastPage] = useState(1);
  const searchParams = useSearchParams();
  const showingPast = searchParams.get("gecmis") === "1";

  useEffect(() => {
    if (!isAdmin && !isOrganizer) return;
    fetchEvents();
  }, [isAdmin, isOrganizer]);

  /* Sekme degisince sayfayi basa al ve listeyi tazele (duzenleme sonrasi tarih degismisse).*/
  useEffect(() => {
    setPastPage(1);
    if (isAdmin || isOrganizer) {
      fetchEvents();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showingPast]);

  async function fetchEvents() {
    try {
      let query = supabase
        .from("events")
        .select("*")
        .order("created_at", { ascending: false });
      if (isOrganizer && user?.id) {
        query = query.eq("created_by_user_id", user.id);
      }
      const { data, error } = await query;
      if (error) throw error;
      const eventsData = data || [];
      setEvents(eventsData);

      const creatorIds = [...new Set(eventsData.map((e: Event & { created_by_user_id?: string }) => e.created_by_user_id).filter(Boolean))] as string[];
      if (creatorIds.length > 0) {
        const { data: profiles } = await supabase
          .from("organizer_profiles")
          .select("user_id, organization_display_name")
          .in("user_id", creatorIds);
        const map: Record<string, string> = {};
        for (const p of profiles || []) {
          if (p.user_id && p.organization_display_name) map[p.user_id] = p.organization_display_name;
        }
        setOrganizerNames(map);
      } else {
        setOrganizerNames({});
      }

      if (isOrganizer && user?.id) {
        const { data: myProfile } = await supabase
          .from("organizer_profiles")
          .select("organization_display_name")
          .eq("user_id", user.id)
          .single();
        setCurrentUserOrganizerName(myProfile?.organization_display_name?.trim() || null);
      } else {
        setCurrentUserOrganizerName(null);
      }

      if (isAdmin) {
        const [favRes, remRes] = await Promise.all([
          supabase.from("event_favorites").select("event_id"),
          supabase.from("event_reminders").select("event_id"),
        ]);
        const favCounts: Record<string, number> = {};
        for (const r of favRes.data || []) {
          favCounts[r.event_id] = (favCounts[r.event_id] || 0) + 1;
        }
        const remCounts: Record<string, number> = {};
        for (const r of remRes.data || []) {
          remCounts[r.event_id] = (remCounts[r.event_id] || 0) + 1;
        }
        const stats: Record<string, { favorites: number; reminders: number }> = {};
        for (const e of eventsData) {
          stats[e.id] = {
            favorites: favCounts[e.id] || 0,
            reminders: remCounts[e.id] || 0,
          };
        }
        setEventStats(stats);
      }
    } catch (error) {
      console.error("Etkinlikler yüklenemedi:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSetFeaturedOrder(eventId: string, order: number | null) {
    if (!isAdmin) return;
    try {
      if (order === 1 || order === 2) {
        await supabase
          .from("events")
          .update({ homepage_featured_order: null })
          .eq("homepage_featured_order", order)
          .neq("id", eventId);
      }
      const { error } = await supabase
        .from("events")
        .update({ homepage_featured_order: order })
        .eq("id", eventId);
      if (error) throw error;
      await fetchEvents();
    } catch (err) {
      console.error("Öne çıkan ayarı güncellenemedi:", err);
      alert("Öne çıkan ayarı güncellenemedi. " + (err instanceof Error ? err.message : ""));
    }
  }

  async function handleSetDraft(eventId: string, isDraft: boolean) {
    if (!isAdmin) return;
    try {
      const { error } = await supabase
        .from("events")
        .update({ is_draft: isDraft })
        .eq("id", eventId);
      if (error) throw error;
      await fetchEvents();
    } catch (err) {
      console.error("Taslak ayarı güncellenemedi:", err);
      alert("Taslak ayarı güncellenemedi. " + (err instanceof Error ? err.message : ""));
    }
  }

  async function handleApprove(eventId: string) {
    try {
      const { error } = await supabase
        .from("events")
        .update({ is_approved: true })
        .eq("id", eventId);
      if (error) throw error;
      await fetchEvents();
      alert("Etkinlik onaylandı!");
    } catch (error) {
      console.error("Onay hatası:", error);
      alert("Etkinlik onaylanamadı: " + (error instanceof Error ? error.message : "Bilinmeyen hata"));
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Bu etkinliği silmek istediğinizden emin misiniz?")) return;

    const eventToDelete = events.find((e) => e.id === id);
    const title = eventToDelete?.title || id;

    try {
      // FK ilişkileri nedeniyle önce bağlı kayıtları temizle.
      const { error: ordersError } = await supabase
        .from("orders")
        .delete()
        .eq("event_id", id);
      if (ordersError) {
        console.warn("İlişkili siparişler silinemedi:", ordersError);
      }

      const { error: ticketsError } = await supabase
        .from("tickets")
        .delete()
        .eq("event_id", id);
      if (ticketsError) {
        throw new Error(`Bağlı biletler silinemedi: ${ticketsError.message}`);
      }

      const { error: eventError } = await supabase
        .from("events")
        .delete()
        .eq("id", id);
      if (eventError) throw eventError;

      await logAudit({
        action: "delete",
        entity_type: "event",
        entity_id: id,
        details: { title },
      });
      
      setEvents(events.filter(event => event.id !== id));
    } catch (error) {
      console.error("Etkinlik silinemedi:", error);
      const message =
        error instanceof Error
          ? error.message
          : "Etkinlik silinemedi. Lütfen tekrar deneyin.";
      alert(`Etkinlik silinemedi: ${message}`);
    }
  }

  async function handleCopy(event: Event) {
    setSubmitting(true);
    try {
      const ev = event as Event & Record<string, unknown>;
      const copyPayload: Record<string, unknown> = {
        title: ev.title,
        description: ev.description,
        date: ev.date,
        time: ev.time,
        venue: ev.venue,
        location: ev.location,
        category: ev.category,
        price_from: Number(ev.price_from) || 0,
        currency: (ev.currency as EventCurrency) || "EUR",
        image_url: ev.image_url ?? null,
        venue_id: ev.venue_id ?? null,
        is_active: true,
        title_tr: ev.title_tr ?? null,
        title_de: ev.title_de ?? null,
        title_en: ev.title_en ?? null,
        title_ku: ev.title_ku ?? null,
        title_ckb: ev.title_ckb ?? null,
        description_tr: ev.description_tr ?? null,
        description_de: ev.description_de ?? null,
        description_en: ev.description_en ?? null,
        description_ckb: ev.description_ckb ?? null,
        venue_tr: ev.venue_tr ?? null,
        venue_de: ev.venue_de ?? null,
        venue_en: ev.venue_en ?? null,
        show_slug: ev.show_slug ?? null,
        homepage_featured_order: null,
      };
      if (isOrganizer && user?.id) {
        copyPayload.created_by_user_id = user.id;
        copyPayload.is_approved = false;
        if (currentUserOrganizerName) {
          (copyPayload as Record<string, unknown>).organizer_display_name = currentUserOrganizerName;
        }
      }

      const { data: newEvent, error: insertError } = await withTimeout(
        (signal) =>
          supabase
            .from("events")
            .insert(copyPayload)
            .select("*")
            .abortSignal(signal)
            .single(),
        30000,
        "Etkinlik kopyalanırken zaman aşımı oluştu."
      );

      if (insertError || !newEvent) {
        const msg = insertError?.message || (insertError as { details?: string })?.details || "Etkinlik oluşturulamadı.";
        throw new Error(String(msg));
      }

      const { data: tickets, error: ticketsFetchError } = await supabase
        .from("tickets")
        .select("name, type, price, quantity, available")
        .eq("event_id", event.id);

      if (!ticketsFetchError && tickets && tickets.length > 0) {
        const qty = (t: { quantity?: number; available?: number }) =>
          Number(t.quantity ?? t.available ?? 0);
        const newTickets = tickets.map((t) => ({
          event_id: newEvent.id,
          name: t.name,
          type: (t.type || "normal") as "normal" | "vip",
          price: Number(t.price || 0),
          quantity: qty(t),
          available: qty(t),
          description: `${t.name} - otomatik etkinlik bileti`,
        }));
        const { error: ticketsInsertError } = await supabase.from("tickets").insert(newTickets);
        if (ticketsInsertError) {
          console.warn("Biletler kopyalanamadı (etkinlik oluşturuldu):", ticketsInsertError);
        }
      }

      await logAudit({
        action: "copy",
        entity_type: "event",
        entity_id: newEvent.id,
        details: { from_event_id: event.id, title: newEvent.title },
      });

      await fetchEvents();
      alert("Etkinlik kopyalandı. Tarih, fiyat ve yer bilgilerini düzenleyebilirsiniz.");
      handleEdit(newEvent as Event);
    } catch (err) {
      console.error("Etkinlik kopyalanamadı:", err);
      const errMsg =
        err instanceof Error
          ? err.message
          : err && typeof err === "object" && "message" in err
            ? String((err as { message: unknown }).message)
            : err && typeof err === "object" && "details" in err
              ? String((err as { details: unknown }).details)
              : typeof err === "string"
                ? err
                : "Bilinmeyen hata";
      alert("Etkinlik kopyalanamadı: " + (errMsg || "Bilinmeyen hata"));
    } finally {
      setSubmitting(false);
    }
  }

  const router = useRouter();
  function handleEdit(event: Event) {
    router.push("/yonetim/etkinlikler/yeni?id=" + event.id);
  }

  const { activeEvents, pastEvents } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMs = today.getTime();
    const active: Event[] = [];
    const past: Event[] = [];
    for (const e of events) {
      const raw = (e as Event & { date?: string | null }).date;
      const d = raw ? new Date(raw) : null;
      if (d && !Number.isNaN(d.getTime()) && d.getTime() < todayMs) {
        past.push(e);
      } else {
        active.push(e);
      }
    }
    /* Bitenleri en yakin tarihten geriye dogru sirala */
    past.sort((a, b) => {
      const da = new Date((a as Event & { date?: string }).date || 0).getTime();
      const db = new Date((b as Event & { date?: string }).date || 0).getTime();
      return db - da;
    });
    return { activeEvents: active, pastEvents: past };
  }, [events]);

  const pastTotalPages = Math.max(1, Math.ceil(pastEvents.length / PAST_EVENTS_PAGE_SIZE));
  const safePastPage = Math.min(Math.max(1, pastPage), pastTotalPages);
  useEffect(() => {
    if (pastPage !== safePastPage) setPastPage(safePastPage);
  }, [pastPage, safePastPage]);
  const pastPageEvents = useMemo(() => {
    const start = (safePastPage - 1) * PAST_EVENTS_PAGE_SIZE;
    return pastEvents.slice(start, start + PAST_EVENTS_PAGE_SIZE);
  }, [pastEvents, safePastPage]);

  const renderEventCard = (event: Event) => (
    <div
      key={event.id}
      className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
        <div className="flex gap-4 sm:gap-6 flex-1 min-w-0">
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
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium text-primary-600">
                {CATEGORY_LABELS[event.category]}
              </span>
              {isAdmin && ((eventStats[event.id]?.favorites ?? 0) > 0 || (eventStats[event.id]?.reminders ?? 0) > 0) && (
                <span className="flex items-center gap-2 text-xs text-slate-500">
                  {(eventStats[event.id]?.favorites ?? 0) > 0 && (
                    <span title="Favoriye ekleyen kişi sayısı" className="inline-flex items-center gap-1">
                      <Heart className="h-3.5 w-3.5" />
                      {eventStats[event.id].favorites}
                    </span>
                  )}
                  {(eventStats[event.id]?.reminders ?? 0) > 0 && (
                    <span title="Hatırlatma talebinde bulunan kişi sayısı" className="inline-flex items-center gap-1">
                      <Bell className="h-3.5 w-3.5" />
                      {eventStats[event.id].reminders}
                    </span>
                  )}
                </span>
              )}
              {(event as Event & { is_approved?: boolean }).is_approved === false && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                  Onay Bekliyor
                </span>
              )}
              {(event as Event & { is_draft?: boolean }).is_draft && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500 text-white gap-1">
                  <Shield className="h-3 w-3" />
                  Taslak
                </span>
              )}
            </div>
            <h3 className="mt-1 text-lg font-semibold text-slate-900">
              {event.title}
            </h3>
            <p className="mt-2 text-sm text-slate-600 line-clamp-2">
              {parseEventDescription(event.description).content}
            </p>
            <div className="mt-3 space-y-1 text-sm text-slate-500">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 flex-shrink-0" />
                {new Date(event.date).toLocaleDateString("tr-TR")} • {event.time}
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 flex-shrink-0" />
                {event.venue}, {event.location}
              </div>
              {(event as Event & { created_by_user_id?: string }).created_by_user_id &&
                organizerNames[(event as Event & { created_by_user_id?: string }).created_by_user_id!] && (
                <div className="flex items-center gap-2 text-primary-600">
                  <Building2 className="h-4 w-4 flex-shrink-0" />
                  Organizatör: {organizerNames[(event as Event & { created_by_user_id?: string }).created_by_user_id!]}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between sm:justify-end gap-3 flex-shrink-0 border-t sm:border-t-0 pt-4 sm:pt-0 flex-wrap">
          <span className="font-bold text-primary-600">
            {Number(event.price_from) > 0
              ? formatPrice(Number(event.price_from), event.currency)
              : "Ücretsiz"}
          </span>
          {isAdmin && (
            <div className="flex items-center gap-2">
              <select
                value={(event as Event & { homepage_featured_order?: number | null }).homepage_featured_order ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  handleSetFeaturedOrder(event.id, v === "" ? null : parseInt(v, 10));
                }}
                className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 bg-white"
                title="Ana sayfa öne çıkan"
              >
                <option value="">Ana sayfa: —</option>
                <option value="1">1. sıra (sol)</option>
                <option value="2">2. sıra (sağ)</option>
              </select>
              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer px-2 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={(event as Event & { is_draft?: boolean }).is_draft ?? false}
                  onChange={(e) => handleSetDraft(event.id, e.target.checked)}
                  title="Taslak - Sadece admin görebilir"
                  className="h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                />
                <span className="text-amber-600 font-medium">Taslak</span>
              </label>
            </div>
          )}
          <div className="flex gap-2">
            {isAdmin && (event as Event & { is_approved?: boolean }).is_approved === false && (
              <button
                onClick={() => handleApprove(event.id)}
                disabled={submitting}
                title="Etkinliği onayla"
                className="p-2 rounded-lg border border-green-200 text-green-600 hover:bg-green-50 disabled:opacity-50"
              >
                <CheckCircle className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={() => handleCopy(event)}
              disabled={submitting}
              title="Etkinliği kopyala"
              className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              <Copy className="h-4 w-4" />
            </button>
            <button
              onClick={() => handleEdit(event)}
              title="Düzenle"
              className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              <Edit2 className="h-4 w-4" />
            </button>
            <button
              onClick={() => handleDelete(event.id)}
              title="Sil"
              className="p-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center text-slate-500">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Etkinlik Yönetimi</h1>
          <Link
            href="/yonetim/etkinlikler/yeni"
            className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
          >
            <Plus className="h-4 w-4" />
            Yeni Etkinlik
          </Link>
        </div>

        {events.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500">
            <Music2 className="h-16 w-16 mx-auto text-slate-300 mb-4" />
            <p className="text-lg font-medium">Henüz etkinlik yok</p>
            <p className="mt-2 text-sm">İlk etkinliğinizi eklemek için &quot;Yeni Etkinlik&quot; butonuna tıklayın.</p>
          </div>
        ) : !showingPast ? (
          <div className="space-y-8">
            <section>
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h2 className="text-lg font-semibold text-slate-800">Devam eden / Yaklaşan etkinlikler</h2>
                <span className="text-xs text-slate-500">{activeEvents.length} etkinlik</span>
              </div>
              {activeEvents.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
                  Yaklaşan veya devam eden etkinlik bulunmuyor.
                </div>
              ) : (
                <div className="grid gap-4">
                  {activeEvents.map(renderEventCard)}
                </div>
              )}
            </section>

            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center">
              <p className="text-sm text-slate-600">
                Tarihi geçen etkinlikleri ayrı bir sayfada görebilirsin.
              </p>
              <Link
                href="/yonetim/etkinlikler?gecmis=1"
                className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
              >
                <History className="h-4 w-4" />
                Biten Etkinlikler ({pastEvents.length})
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        ) : (
          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-800">
                <History className="h-5 w-5 text-slate-500" />
                Biten Etkinlikler
                <span className="ml-2 text-xs font-normal text-slate-500">({pastEvents.length} etkinlik)</span>
              </h2>
              <Link
                href="/yonetim/etkinlikler"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Devam edenlere dön
              </Link>
            </div>
            {pastEvents.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
                Bitmiş etkinlik bulunmuyor.
              </div>
            ) : (
              <>
                <div className="grid gap-4">
                  {pastPageEvents.map(renderEventCard)}
                </div>
                {pastTotalPages > 1 && (
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-slate-500">
                      Sayfa {safePastPage} / {pastTotalPages} • Toplam {pastEvents.length} biten etkinlik
                    </p>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setPastPage(1)}
                        disabled={safePastPage <= 1}
                        className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        İlk
                      </button>
                      <button
                        type="button"
                        onClick={() => setPastPage((p) => Math.max(1, p - 1))}
                        disabled={safePastPage <= 1}
                        className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                        Önceki
                      </button>
                      <span className="px-2 text-xs font-medium text-slate-700">
                        {safePastPage} / {pastTotalPages}
                      </span>
                      <button
                        type="button"
                        onClick={() => setPastPage((p) => Math.min(pastTotalPages, p + 1))}
                        disabled={safePastPage >= pastTotalPages}
                        className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Sonraki
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPastPage(pastTotalPages)}
                        disabled={safePastPage >= pastTotalPages}
                        className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Son
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
