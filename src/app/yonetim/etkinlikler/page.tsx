"use client";

import { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, Copy, Calendar, MapPin, Music2, X, CheckCircle } from "lucide-react";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";
import { supabase } from "@/lib/supabase-client";
import type { Event, EventCategory, EventCurrency } from "@/types/database";
import { CATEGORY_LABELS, CURRENCY_SYMBOLS, DISPLAY_CATEGORIES } from "@/types/database";
import AdminImageUpload from "@/components/AdminImageUpload";
import { buildEventDescription, parseEventDescription } from "@/lib/eventMeta";
import { formatPrice } from "@/lib/formatPrice";
import { logAudit } from "@/lib/audit";
import { useTranslations } from "next-intl";

const PRESET_TICKET_TYPES = [
  { key: "standart", name: "Standart Bilet", type: "normal", multiplier: 1 },
  { key: "vip", name: "VIP Bilet", type: "vip", multiplier: 1 },
  { key: "kategori1", name: "Kategori 1", type: "normal", multiplier: 1 },
  { key: "kategori2", name: "Kategori 2", type: "normal", multiplier: 1 },
  { key: "kategori3", name: "Kategori 3", type: "normal", multiplier: 1 },
  { key: "kategori4", name: "Kategori 4", type: "normal", multiplier: 1 },
  { key: "kategori5", name: "Kategori 5", type: "normal", multiplier: 1 },
  { key: "kategori6", name: "Kategori 6", type: "normal", multiplier: 1 },
  { key: "kategori7", name: "Kategori 7", type: "normal", multiplier: 1 },
  { key: "kategori8", name: "Kategori 8", type: "normal", multiplier: 1 },
  { key: "kategori9", name: "Kategori 9", type: "normal", multiplier: 1 },
  { key: "kategori10", name: "Kategori 10", type: "normal", multiplier: 1 },
] as const;

const EMPTY_TICKET_QUANTITIES: Record<string, number> = Object.fromEntries(
  PRESET_TICKET_TYPES.map((ticket) => [ticket.key, 0])
);
const EMPTY_TICKET_PRICES: Record<string, number> = Object.fromEntries(
  PRESET_TICKET_TYPES.map((ticket) => [ticket.key, 0])
);

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
  return <EtkinliklerContent />;
}

function EtkinliklerContent() {
  const { user, isAdmin, isOrganizer } = useSimpleAuth();
  const tCurrency = useTranslations("currency");
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [imageUrl, setImageUrl] = useState<string>("");
  const [imageUploading, setImageUploading] = useState(false);
  const [descriptionText, setDescriptionText] = useState("");
  const [descriptionTextDe, setDescriptionTextDe] = useState("");
  const [descriptionTextEn, setDescriptionTextEn] = useState("");
  const [externalTicketUrl, setExternalTicketUrl] = useState("");
  const [titleTr, setTitleTr] = useState("");
  const [titleDe, setTitleDe] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [venueTr, setVenueTr] = useState("");
  const [venueDe, setVenueDe] = useState("");
  const [venueEn, setVenueEn] = useState("");
  const [ticketQuantities, setTicketQuantities] = useState<Record<string, number>>(EMPTY_TICKET_QUANTITIES);
  const [ticketPrices, setTicketPrices] = useState<Record<string, number>>(EMPTY_TICKET_PRICES);
  const [venues, setVenues] = useState<Array<{ id: string; name: string; address: string | null; city: string | null }>>([]);
  const [selectedVenueId, setSelectedVenueId] = useState<string>("");

  useEffect(() => {
    if (!isAdmin && !isOrganizer) return;
    fetchEvents();
  }, [isAdmin, isOrganizer]);

  useEffect(() => {
    if (showForm) {
      supabase.from("venues").select("id,name,address,city").order("name").then(({ data }) => {
        setVenues(data || []);
      });
    }
  }, [showForm]);

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
      setEvents(data || []);
    } catch (error) {
      console.error("Etkinlikler yüklenemedi:", error);
    } finally {
      setLoading(false);
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

  async function loadTicketQuantities(eventId: string) {
    try {
      const { data, error } = await supabase
        .from("tickets")
        .select("name, quantity, price")
        .eq("event_id", eventId);

      if (error) throw error;

      const nextQty = { ...EMPTY_TICKET_QUANTITIES };
      const nextPrice = { ...EMPTY_TICKET_PRICES };
      for (const preset of PRESET_TICKET_TYPES) {
        const match = (data || []).find((row) => row.name === preset.name);
        nextQty[preset.key] = Number(match?.quantity || 0);
        nextPrice[preset.key] = Number(match?.price || 0);
      }
      setTicketQuantities(nextQty);
      setTicketPrices(nextPrice);
    } catch {
      setTicketQuantities({ ...EMPTY_TICKET_QUANTITIES });
      setTicketPrices({ ...EMPTY_TICKET_PRICES });
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
        description_tr: ev.description_tr ?? null,
        description_de: ev.description_de ?? null,
        description_en: ev.description_en ?? null,
        venue_tr: ev.venue_tr ?? null,
        venue_de: ev.venue_de ?? null,
        venue_en: ev.venue_en ?? null,
        show_slug: ev.show_slug ?? null,
      };
      if (isOrganizer && user?.id) {
        copyPayload.created_by_user_id = user.id;
        copyPayload.is_approved = false;
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
      await handleEdit(newEvent as Event);
      alert("Etkinlik kopyalandı. Tarih, fiyat ve yer bilgilerini düzenleyebilirsiniz.");
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

  async function handleEdit(event: Event) {
    const parsed = parseEventDescription(event.description);
    const parsedDe = parseEventDescription((event as Event & { description_de?: string }).description_de);
    const parsedEn = parseEventDescription((event as Event & { description_en?: string }).description_en);
    setEditingEvent(event);
    setImageUrl(event.image_url || "");
    setDescriptionText(parsed.content || "");
    setDescriptionTextDe(parsedDe.content || "");
    setDescriptionTextEn(parsedEn.content || "");
    setExternalTicketUrl(parsed.externalTicketUrl || "");
    setTitleTr((event as Event & { title_tr?: string }).title_tr || event.title);
    setTitleDe((event as Event & { title_de?: string }).title_de || "");
    setTitleEn((event as Event & { title_en?: string }).title_en || "");
    setVenueTr((event as Event & { venue_tr?: string }).venue_tr || event.venue);
    setVenueDe((event as Event & { venue_de?: string }).venue_de || "");
    setVenueEn((event as Event & { venue_en?: string }).venue_en || "");
    setSelectedVenueId((event as Event & { venue_id?: string }).venue_id || "");
    setShowForm(true);
    await loadTicketQuantities(event.id);
  }

  function handleFormClose() {
    if (submitting) return;
    setShowForm(false);
    setEditingEvent(null);
    setImageUrl("");
    setImageUploading(false);
    setDescriptionText("");
    setDescriptionTextDe("");
    setDescriptionTextEn("");
    setExternalTicketUrl("");
    setTitleTr("");
    setTitleDe("");
    setTitleEn("");
    setVenueTr("");
    setVenueDe("");
    setVenueEn("");
    setTicketQuantities({ ...EMPTY_TICKET_QUANTITIES });
    setTicketPrices({ ...EMPTY_TICKET_PRICES });
    setSelectedVenueId("");
  }

  async function syncPresetTickets(eventId: string, basePrice: number) {
    const { data: existingRows, error: fetchError } = await withTimeout(
      (signal) =>
        supabase
          .from("tickets")
          .select("id, name, quantity, available")
          .eq("event_id", eventId)
          .abortSignal(signal),
      30000,
      "Bilet bilgileri okunurken zaman asimi olustu."
    );

    if (fetchError) throw fetchError;

    for (const preset of PRESET_TICKET_TYPES) {
      const qty = Math.max(0, Number(ticketQuantities[preset.key] || 0));
      const enteredPrice = Math.max(0, Number(ticketPrices[preset.key] || 0));
      const fallbackPrice = Math.max(0, Number(basePrice || 0) * preset.multiplier);
      const price = enteredPrice > 0 ? enteredPrice : fallbackPrice;
      const existing = (existingRows || []).find((row) => row.name === preset.name);

      // Quantity 0 ise bu bilet türünü etkinlikte tutma.
      if (qty <= 0) {
        if (existing) {
          const { error: deleteError } = await supabase
            .from("tickets")
            .delete()
            .eq("id", existing.id);
          if (deleteError) throw deleteError;
        }
        continue;
      }

      if (existing) {
        const sold = Math.max(0, Number(existing.quantity || 0) - Number(existing.available || 0));
        const safeQuantity = Math.max(qty, sold);
        const available = Math.max(0, safeQuantity - sold);
        const { error: updateError } = await withTimeout(
          (signal) =>
            supabase
              .from("tickets")
              .update({
                name: preset.name,
                type: preset.type,
                price,
                quantity: safeQuantity,
                available,
                description: `${preset.name} - otomatik etkinlik bileti`,
              })
              .eq("id", existing.id)
              .abortSignal(signal),
          30000,
          `${preset.name} guncellenirken zaman asimi olustu.`
        );
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await withTimeout(
          (signal) =>
            supabase
              .from("tickets")
              .insert({
                event_id: eventId,
                name: preset.name,
                type: preset.type,
                price,
                quantity: qty,
                available: qty,
                description: `${preset.name} - otomatik etkinlik bileti`,
              })
              .abortSignal(signal),
          30000,
          `${preset.name} eklenirken zaman asimi olustu.`
        );
        if (insertError) throw insertError;
      }
    }
  }

  async function handleFormSubmit(formData: FormData) {
    if (imageUploading) {
      alert("Gorsel yukleniyor, lutfen tamamlanmasini bekleyin.");
      return;
    }

    setSubmitting(true);
    try {
      const fallbackBasePrice = parseFloat(formData.get("price_from") as string) || 0;
      const activePrices = PRESET_TICKET_TYPES.map((ticketType) => {
        const qty = Math.max(0, Number(ticketQuantities[ticketType.key] || 0));
        if (qty <= 0) return 0;
        const entered = Math.max(0, Number(ticketPrices[ticketType.key] || 0));
        return entered > 0 ? entered : fallbackBasePrice;
      }).filter((value) => value > 0);
      const derivedBasePrice =
        activePrices.length > 0 ? Math.min(...activePrices) : fallbackBasePrice;

      const titleTrVal = titleTr || (formData.get("title") as string) || "";
      const venueTrVal = venueTr || (formData.get("venue") as string) || "";
      const eventData = {
        title: titleTrVal,
        description: buildEventDescription(descriptionText, externalTicketUrl),
        date: formData.get("date") as string,
        time: formData.get("time") as string,
        venue: venueTrVal,
        location: formData.get("location") as string,
        category: formData.get("category") as EventCategory,
        price_from: derivedBasePrice,
        currency: (formData.get("currency") as EventCurrency) || "EUR",
        image_url: imageUrl || null,
        venue_id: selectedVenueId || null,
        title_tr: titleTrVal || null,
        title_de: titleDe || null,
        title_en: titleEn || null,
        description_tr: buildEventDescription(descriptionText, externalTicketUrl) || null,
        description_de: descriptionTextDe ? buildEventDescription(descriptionTextDe, externalTicketUrl) : null,
        description_en: descriptionTextEn ? buildEventDescription(descriptionTextEn, externalTicketUrl) : null,
        venue_tr: venueTrVal || null,
        venue_de: venueDe || null,
        venue_en: venueEn || null,
        show_slug: (formData.get("show_slug") as string)?.trim() || null,
      };
      if (isOrganizer && user?.id && !editingEvent) {
        (eventData as Record<string, unknown>).created_by_user_id = user.id;
        (eventData as Record<string, unknown>).is_approved = false;
      }

      if (editingEvent) {
        // Güncelleme
        const { error } = await withTimeout(
          (signal) =>
            supabase
              .from("events")
              .update(eventData)
              .eq("id", editingEvent.id)
              .abortSignal(signal),
          30000,
          "Etkinlik guncellenirken zaman asimi olustu."
        );

        if (error) {
          console.error("Update error:", error);
          throw error;
        }

        await syncPresetTickets(editingEvent.id, eventData.price_from);
      } else {
        // Yeni etkinlik
        const { data: insertedEvent, error } = await withTimeout(
          (signal) =>
            supabase
              .from("events")
              .insert(eventData)
              .select("id")
              .abortSignal(signal)
              .single(),
          30000,
          "Etkinlik olusturulurken zaman asimi olustu."
        );

        if (error) {
          console.error("Insert error:", error);
          throw error;
        }

        if (insertedEvent?.id) {
          await syncPresetTickets(insertedEvent.id, eventData.price_from);
        }
      }

      await fetchEvents();
      handleFormClose();
      alert(editingEvent ? "Etkinlik güncellendi!" : "Etkinlik oluşturuldu!");
    } catch (error) {
      console.error("Form submit error:", error);
      alert("İşlem başarısız oldu: " + (error as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

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
          <button
            onClick={() => {
              setShowForm(true);
              setEditingEvent(null);
              setImageUrl("");
              setDescriptionText("");
              setDescriptionTextDe("");
              setDescriptionTextEn("");
              setExternalTicketUrl("");
              setTitleTr("");
              setTitleDe("");
              setTitleEn("");
              setVenueTr("");
              setVenueDe("");
              setVenueEn("");
              setTicketQuantities({ ...EMPTY_TICKET_QUANTITIES });
              setTicketPrices({ ...EMPTY_TICKET_PRICES });
              setSelectedVenueId("");
            }}
            className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
          >
            <Plus className="h-4 w-4" />
            Yeni Etkinlik
          </button>
        </div>

        {showForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 relative">
              <button
                type="button"
                onClick={handleFormClose}
                className="absolute top-4 right-4 p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                aria-label="Kapat"
              >
                <X className="h-5 w-5" />
              </button>
              <h2 className="text-xl font-bold text-slate-900 mb-6 pr-10">
                {editingEvent ? "Etkinlik Düzenle" : "Yeni Etkinlik"}
              </h2>
              
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleFormSubmit(new FormData(e.currentTarget));
                }}
                className="space-y-4"
              >
                <div className="space-y-4">
                  <h3 className="font-semibold text-slate-800">Çok Dilli İçerik (TR, DE, EN)</h3>
                  <div className="rounded-lg border border-slate-200 p-4 bg-slate-50/50 space-y-3">
                    <h4 className="text-sm font-medium text-slate-700">Türkçe (zorunlu)</h4>
                    <input type="hidden" name="title" value={titleTr} />
                    <input
                      type="text"
                      placeholder="Etkinlik Adı (TR)"
                      required
                      value={titleTr}
                      onChange={(e) => setTitleTr(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-primary-500 focus:ring-primary-500"
                    />
                    <textarea
                      placeholder="Açıklama (TR)"
                      rows={2}
                      value={descriptionText}
                      onChange={(e) => setDescriptionText(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-primary-500 focus:ring-primary-500"
                    />
                    <input
                      type="text"
                      placeholder="Mekan Adı (TR)"
                      value={venueTr}
                      onChange={(e) => setVenueTr(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-primary-500 focus:ring-primary-500"
                    />
                  </div>
                  <div className="rounded-lg border border-slate-200 p-4 bg-slate-50/50 space-y-3">
                    <h4 className="text-sm font-medium text-slate-700">Deutsch (opsiyonel)</h4>
                    <input
                      type="text"
                      placeholder="Etkinlik Adı (DE)"
                      value={titleDe}
                      onChange={(e) => setTitleDe(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-primary-500 focus:ring-primary-500"
                    />
                    <textarea
                      placeholder="Açıklama (DE)"
                      rows={2}
                      value={descriptionTextDe}
                      onChange={(e) => setDescriptionTextDe(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-primary-500 focus:ring-primary-500"
                    />
                    <input
                      type="text"
                      placeholder="Mekan Adı (DE)"
                      value={venueDe}
                      onChange={(e) => setVenueDe(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-primary-500 focus:ring-primary-500"
                    />
                  </div>
                  <div className="rounded-lg border border-slate-200 p-4 bg-slate-50/50 space-y-3">
                    <h4 className="text-sm font-medium text-slate-700">English (opsiyonel)</h4>
                    <input
                      type="text"
                      placeholder="Etkinlik Adı (EN)"
                      value={titleEn}
                      onChange={(e) => setTitleEn(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-primary-500 focus:ring-primary-500"
                    />
                    <textarea
                      placeholder="Açıklama (EN)"
                      rows={2}
                      value={descriptionTextEn}
                      onChange={(e) => setDescriptionTextEn(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-primary-500 focus:ring-primary-500"
                    />
                    <input
                      type="text"
                      placeholder="Mekan Adı (EN)"
                      value={venueEn}
                      onChange={(e) => setVenueEn(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-primary-500 focus:ring-primary-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Tarih
                    </label>
                    <input
                      type="date"
                      name="date"
                      required
                      defaultValue={editingEvent?.date || ""}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-primary-500 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Saat
                    </label>
                    <input
                      type="time"
                      name="time"
                      required
                      defaultValue={editingEvent?.time || ""}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-primary-500 focus:ring-primary-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Mekan (Opsiyonel - SSS/ulaşım için)
                  </label>
                  <select
                    value={selectedVenueId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setSelectedVenueId(id);
                      if (id) {
                        const v = venues.find((x) => x.id === id);
                        if (v) {
                          setVenueTr(v.name);
                          const locationInput = document.querySelector<HTMLInputElement>('input[name="location"]');
                          if (locationInput) locationInput.value = [v.address, v.city].filter(Boolean).join(", ") || v.name;
                        }
                      }
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-primary-500 focus:ring-primary-500"
                  >
                    <option value="">— Mekan seçin veya manuel girin —</option>
                    {venues.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} {v.city ? `(${v.city})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Konum (şehir/adres - tüm dillerde ortak)
                  </label>
                  <input
                    type="text"
                    name="location"
                    required
                    defaultValue={editingEvent?.location || ""}
                    key={editingEvent?.id || "new"}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-primary-500 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Tur/Gösteri Slug (Biletinial tarzı - opsiyonel)
                  </label>
                  <input
                    type="text"
                    name="show_slug"
                    defaultValue={(editingEvent as Event & { show_slug?: string })?.show_slug || ""}
                    placeholder="erdal-kaya-zikopisto"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-primary-500 focus:ring-primary-500"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Aynı slug&apos;a sahip 2+ etkinlik tek sayfada şehir seçerek gösterilir (Biletinial gibi).
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Kategori
                    </label>
                    <select
                      name="category"
                      required
                      defaultValue={editingEvent?.category || "konser"}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-primary-500 focus:ring-primary-500"
                    >
                      {DISPLAY_CATEGORIES.map((key) => (
                        <option key={key} value={key}>
                          {CATEGORY_LABELS[key]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      {tCurrency("label")}
                    </label>
                    <select
                      name="currency"
                      defaultValue={editingEvent?.currency || "EUR"}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-primary-500 focus:ring-primary-500"
                    >
                      <option value="EUR">{tCurrency("EUR") || `${CURRENCY_SYMBOLS.EUR} Euro`}</option>
                      <option value="TL">{tCurrency("TL") || `${CURRENCY_SYMBOLS.TL} Türk Lirası`}</option>
                      <option value="USD">{tCurrency("USD") || `${CURRENCY_SYMBOLS.USD} US Doları`}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Başlangıç Fiyatı
                    </label>
                    <input
                      type="number"
                      name="price_from"
                      min="0"
                      step="0.01"
                      defaultValue={editingEvent?.price_from || ""}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-primary-500 focus:ring-primary-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Harici Bilet Linki (Opsiyonel)
                  </label>
                  <input
                    type="url"
                    value={externalTicketUrl}
                    onChange={(e) => setExternalTicketUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-primary-500 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <AdminImageUpload
                    value={imageUrl}
                    onChange={setImageUrl}
                    onUploadingChange={setImageUploading}
                  />
                </div>

                <div className="rounded-lg border border-slate-200 p-4">
                  <h3 className="font-semibold text-slate-900 mb-3">Bilet Türleri ve Adetleri</h3>
                  <p className="text-xs text-slate-500 mb-3">
                    Standart, VIP ve Kategori 1-10 her etkinlikte hazır olur. Sadece adet girin.
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {PRESET_TICKET_TYPES.map((ticketType) => (
                      <div key={ticketType.key}>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          {ticketType.name}
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="number"
                            min="0"
                            value={ticketQuantities[ticketType.key] ?? 0}
                            onChange={(e) =>
                              setTicketQuantities((prev) => ({
                                ...prev,
                                [ticketType.key]: Math.max(0, Number(e.target.value || 0)),
                              }))
                            }
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-primary-500 focus:ring-primary-500"
                            placeholder="Adet"
                          />
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={ticketPrices[ticketType.key] ?? 0}
                            onChange={(e) =>
                              setTicketPrices((prev) => ({
                                ...prev,
                                [ticketType.key]: Math.max(0, Number(e.target.value || 0)),
                              }))
                            }
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-primary-500 focus:ring-primary-500"
                            placeholder="Fiyat €"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={submitting || imageUploading}
                    className="flex-1 bg-primary-600 text-white py-2 px-4 rounded-lg font-semibold hover:bg-primary-700 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {imageUploading
                      ? "Gorsel Yukleniyor..."
                      : submitting
                        ? "Kaydediliyor..."
                        : editingEvent
                          ? "Güncelle"
                          : "Oluştur"}
                  </button>
                  <button
                    type="button"
                    onClick={handleFormClose}
                    disabled={submitting}
                    className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
                  >
                    İptal
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

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
                        {(event as Event & { is_approved?: boolean }).is_approved === false && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                            Onay Bekliyor
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
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-3 flex-shrink-0 border-t sm:border-t-0 pt-4 sm:pt-0">
                    <span className="font-bold text-primary-600">
                      {Number(event.price_from) > 0
                        ? formatPrice(Number(event.price_from), event.currency)
                        : "Ücretsiz"}
                    </span>
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
