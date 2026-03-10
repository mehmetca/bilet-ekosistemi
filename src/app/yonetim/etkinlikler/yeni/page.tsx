"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Calendar,
  MapPin,
  Building2,
  Ticket,
  Music2,
  ExternalLink,
  X,
} from "lucide-react";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";
import { supabase } from "@/lib/supabase-client";
import type { EventCategory, EventCurrency } from "@/types/database";
import {
  CATEGORY_LABELS,
  CURRENCY_SYMBOLS,
  DISPLAY_CATEGORIES,
} from "@/types/database";
import { buildEventDescription, parseEventDescription } from "@/lib/eventMeta";
import AdminImageUpload from "@/components/AdminImageUpload";
import { formatPrice } from "@/lib/formatPrice";

const STEPS = [
  { id: 1, label: "Temel bilgiler" },
  { id: 2, label: "Tarih & mekan" },
  { id: 3, label: "Biletler" },
  { id: 4, label: "Önizleme & gönder" },
];

/** a. Normal/Standart (tek seçenek), b. VIP, c–d. Kategori 1–10, e. İndirimli (öğrenci), f. İndirimli (grup), g. Özel (düzenlemede mevcut ad) */
const BILET_TURU_SECENEKLERI = [
  { value: "normal_standart", label: "Normal / Standart Bilet", type: "normal" as const },
  { value: "vip", label: "VIP Bilet", type: "vip" as const },
  ...Array.from({ length: 10 }, (_, i) => ({
    value: `kategori${i + 1}`,
    label: `Kategori ${i + 1}`,
    type: "normal" as const,
  })),
  { value: "ogrenci", label: "İndirimli bilet (öğrenci bileti)", type: "normal" as const },
  { value: "grup", label: "İndirimli bilet (grup indirimli bilet)", type: "normal" as const },
  { value: "custom", label: "Özel (mevcut ad)", type: "normal" as const },
];

type WizardTicket = {
  id: string;
  presetKey: string;
  name: string;
  type: "normal" | "vip";
  price: number;
  quantity: number;
  description: string;
  /** Sadece grup indirimli için: "10 bilet %10, 20 bilet %20" gibi */
  discountRules?: string;
  /** Grup indirimli bilet için minimum adet (örn. 10); seçim bu adetin altına inemez */
  groupMinQuantity?: number;
};

type VenueOption = { id: string; name: string; address: string | null; city: string | null };
type SeatingPlanOption = { id: string; name: string; is_default: boolean };

export default function EtkinlikYeniPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("id");
  const { user, isAdmin, isOrganizer } = useSimpleAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const isEditMode = Boolean(editingEventId);

  // Step 1
  const [titleTr, setTitleTr] = useState("");
  const [titleDe, setTitleDe] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [descriptionTr, setDescriptionTr] = useState("");
  const [descriptionDe, setDescriptionDe] = useState("");
  const [descriptionEn, setDescriptionEn] = useState("");
  const [category, setCategory] = useState<EventCategory>("konser");
  const [imageUrl, setImageUrl] = useState("");
  const [organizerDisplayName, setOrganizerDisplayName] = useState("");
  const [currency, setCurrency] = useState<EventCurrency>("EUR");
  /** Başlangıç fiyatı (tüm dillerde aynı rakam); boşsa biletlerden türetilir veya ücretsiz. */
  const [priceFromInput, setPriceFromInput] = useState<number | "">("");
  // Harici bilet linki 3. adımda (biletler bölümünde)
  const [ticketUrl, setTicketUrl] = useState("");

  // Step 2
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [venues, setVenues] = useState<VenueOption[]>([]);
  const [selectedVenueId, setSelectedVenueId] = useState("");
  const [venueManualName, setVenueManualName] = useState("");
  /** Şehir (filtrelemede kısa gösterilir) */
  const [eventCity, setEventCity] = useState("");
  /** Adres (tam adres, ayrı alan) */
  const [eventAddress, setEventAddress] = useState("");
  const [showNewVenueModal, setShowNewVenueModal] = useState(false);
  const [newVenueName, setNewVenueName] = useState("");
  const [newVenueCity, setNewVenueCity] = useState("");
  const [newVenueAddress, setNewVenueAddress] = useState("");
  /** Seçilen mekana ait oturum planları; koltuk seçimi için bir plan seçilebilir */
  const [seatingPlans, setSeatingPlans] = useState<SeatingPlanOption[]>([]);
  const [selectedSeatingPlanId, setSelectedSeatingPlanId] = useState("");

  // Step 3
  const [tickets, setTickets] = useState<WizardTicket[]>([
    { id: crypto.randomUUID(), presetKey: "normal_standart", name: "Normal / Standart Bilet", type: "normal", price: 0, quantity: 100, description: "", discountRules: "", groupMinQuantity: undefined },
  ]);

  const [currentUserOrganizerName, setCurrentUserOrganizerName] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin && !isOrganizer) {
      router.replace("/yonetim");
      return;
    }
    (async () => {
      const { data: venuesData } = await supabase
        .from("venues")
        .select("id, name, address, city")
        .order("name");
      setVenues(venuesData || []);
      if (isOrganizer && user?.id) {
        const { data: profile } = await supabase
          .from("organizer_profiles")
          .select("organization_display_name")
          .eq("user_id", user.id)
          .maybeSingle();
        const name = profile?.organization_display_name?.trim() || null;
        setCurrentUserOrganizerName(name);
        if (!editId) setOrganizerDisplayName(name || "");
      }
    })();
    setLoading(false);
  }, [isAdmin, isOrganizer, user?.id, router, editId]);

  // Düzenleme modu: id ile etkinlik ve biletleri yükle
  useEffect(() => {
    if (!editId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: eventData, error: eventError } = await supabase
        .from("events")
        .select("*")
        .eq("id", editId)
        .single();
      if (eventError || !eventData || cancelled) {
        setLoading(false);
        return;
      }
      const ev = eventData as Record<string, unknown>;
      const parsedTr = parseEventDescription((ev.description as string) ?? null);
      const parsedDe = parseEventDescription((ev.description_de as string) ?? null);
      const parsedEn = parseEventDescription((ev.description_en as string) ?? null);

      setEditingEventId(editId);
      setTitleTr((ev.title_tr as string) || (ev.title as string) || "");
      setTitleDe((ev.title_de as string) || "");
      setTitleEn((ev.title_en as string) || "");
      setDescriptionTr(parsedTr.content || "");
      setDescriptionDe(parsedDe.content || "");
      setDescriptionEn(parsedEn.content || "");
      setCategory((ev.category as EventCategory) || "konser");
      setImageUrl((ev.image_url as string) || "");
      setOrganizerDisplayName((ev.organizer_display_name as string) || "");
      setCurrency((ev.currency as EventCurrency) || "EUR");
      setPriceFromInput(typeof ev.price_from === "number" ? ev.price_from : "");
      setTicketUrl(parsedTr.externalTicketUrl || "");
      setDate((ev.date as string) || "");
      setTime(String(ev.time || "").slice(0, 5));
      setSelectedVenueId((ev.venue_id as string) || "");
      setVenueManualName((ev.venue as string) || "");
      const city = (ev.city as string) || "";
      const address = (ev.address as string) || "";
      setEventCity(city);
      setEventAddress(address);
      setSelectedSeatingPlanId((ev.seating_plan_id as string) || "");

      const { data: ticketsData } = await supabase
        .from("tickets")
        .select("id, name, type, price, quantity, available, description")
        .eq("event_id", editId);
      const rows = (ticketsData || []) as Array<{ name: string; type: string; price: number; quantity: number; available: number; description?: string }>;
      if (rows.length > 0) {
        const mapped: WizardTicket[] = rows.map((r) => {
          const preset = BILET_TURU_SECENEKLERI.find((p) => p.label === r.name);
          return {
            id: crypto.randomUUID(),
            presetKey: preset ? preset.value : "custom",
            name: r.name,
            type: (r.type === "vip" ? "vip" : "normal") as "normal" | "vip",
            price: Number(r.price) || 0,
            quantity: Number(r.quantity ?? r.available ?? 0),
            description: (r.description || "").replace(/^.*? - etkinlik bileti\.?\s*/i, "").trim(),
            discountRules: "",
            groupMinQuantity: undefined,
          };
        });
        setTickets(mapped);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [editId]);

  useEffect(() => {
    if (!selectedVenueId) {
      setSeatingPlans([]);
      setSelectedSeatingPlanId("");
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("seating_plans")
        .select("id, name, is_default")
        .eq("venue_id", selectedVenueId)
        .order("is_default", { ascending: false })
        .order("name");
      const plans = (data || []) as SeatingPlanOption[];
      setSeatingPlans(plans);
      const defaultPlan = plans.find((p) => p.is_default);
      setSelectedSeatingPlanId(defaultPlan?.id || (plans[0]?.id ?? ""));
    })();
  }, [selectedVenueId]);

  const selectedVenue = venues.find((v) => v.id === selectedVenueId);
  const venueDisplayName = selectedVenueId ? selectedVenue?.name ?? "" : venueManualName;
  const displayCity = selectedVenueId ? (selectedVenue?.city ?? eventCity) : eventCity;
  const displayAddress = selectedVenueId ? (selectedVenue?.address ?? eventAddress) : eventAddress;
  const venueDisplayLocation = [displayCity, displayAddress].filter(Boolean).join(", ") || venueDisplayName;

  const derivedFromTickets =
    tickets.length > 0
      ? Math.min(...tickets.filter((t) => t.quantity > 0).map((t) => t.price), Infinity) || 0
      : 0;
  const priceFrom = typeof priceFromInput === "number" && priceFromInput > 0 ? priceFromInput : derivedFromTickets;

  const canProceedStep1 = titleTr.trim().length > 0 && category;
  const canProceedStep2 = date && time && (selectedVenueId || (venueManualName.trim() && eventCity.trim()));
  const hasExternalTicketLink = ticketUrl.trim().length > 0;
  const canProceedStep3 =
    hasExternalTicketLink || tickets.some((t) => t.quantity > 0);

  function addTicket() {
    const preset = BILET_TURU_SECENEKLERI[0];
    setTickets((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        presetKey: preset.value,
        name: preset.label,
        type: preset.type,
        price: 0,
        quantity: 0,
        description: "",
        discountRules: "",
        groupMinQuantity: undefined,
      },
    ]);
  }

  function getTicketDisplayName(t: WizardTicket): string {
    if (t.presetKey === "custom") return t.name || "Bilet";
    const p = BILET_TURU_SECENEKLERI.find((x) => x.value === t.presetKey);
    return p ? p.label : t.name || "Bilet";
  }

  function removeTicket(id: string) {
    setTickets((prev) => (prev.length > 1 ? prev.filter((t) => t.id !== id) : prev));
  }

  function updateTicket(id: string, patch: Partial<WizardTicket>) {
    setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  async function handleCreateVenue() {
    if (!newVenueName.trim()) {
      alert("Mekan adı zorunludur.");
      return;
    }
    const { data: inserted, error } = await supabase
      .from("venues")
      .insert({
        name: newVenueName.trim(),
        city: newVenueCity.trim() || null,
        address: newVenueAddress.trim() || null,
      })
      .select("id, name, address, city")
      .single();
    if (error) {
      alert("Mekan eklenemedi. Sadece yöneticiler mekan ekleyebilir olabilir.");
      return;
    }
    setVenues((prev) => [...prev, inserted]);
    setSelectedVenueId(inserted.id);
    setVenueManualName(inserted.name);
    setEventCity(inserted.city ?? "");
    setEventAddress(inserted.address ?? "");
    setShowNewVenueModal(false);
    setNewVenueName("");
    setNewVenueCity("");
    setNewVenueAddress("");
  }

  async function handleSubmit() {
    if (imageUploading) {
      alert("Kapak görseli yükleniyor, lütfen bekleyin.");
      return;
    }
    if (!canProceedStep2) {
      alert("Lütfen tarih ve mekan bilgilerini doldurun.");
      return;
    }
    if (!canProceedStep3) {
      alert("Harici bilet linki girin veya en az bir bilet türü ekleyin (fiyat ve kapasite ile).");
      return;
    }

    setSubmitting(true);
    try {
      const titleTrVal = titleTr.trim();
      const venueTrVal = selectedVenue?.name ?? venueManualName.trim();
      const cityVal = (selectedVenueId ? selectedVenue?.city ?? eventCity : eventCity).trim();
      const addressVal = (selectedVenueId ? selectedVenue?.address ?? eventAddress : eventAddress).trim();
      const locationVal = [cityVal, addressVal].filter(Boolean).join(", ") || venueTrVal;
      const descTr = buildEventDescription(descriptionTr.trim(), ticketUrl.trim() || undefined);
      const descDe = descriptionDe.trim()
        ? buildEventDescription(descriptionDe.trim(), ticketUrl.trim() || undefined)
        : null;
      const descEn = descriptionEn.trim()
        ? buildEventDescription(descriptionEn.trim(), ticketUrl.trim() || undefined)
        : null;
      const organizerName =
        organizerDisplayName.trim() || currentUserOrganizerName || null;

      const eventData: Record<string, unknown> = {
        title: titleTrVal,
        description: descTr,
        date,
        time,
        venue: venueTrVal,
        location: locationVal,
        city: cityVal || null,
        address: addressVal || null,
        category,
        price_from: priceFrom,
        currency,
        image_url: imageUrl || null,
        venue_id: selectedVenueId || null,
        seating_plan_id: selectedSeatingPlanId || null,
        title_tr: titleTrVal || null,
        title_de: titleDe.trim() || null,
        title_en: titleEn.trim() || null,
        description_tr: descTr || null,
        description_de: descDe,
        description_en: descEn,
        venue_tr: venueTrVal || null,
        venue_de: null,
        venue_en: null,
        organizer_display_name: organizerName,
        is_active: true,
      };
      // Harici link açıklamada zaten gömülü (buildEventDescription); ticket_url sütunu varsa eklenebilir

      const hasExternalLink = (ticketUrl || "").trim().length > 0;
      const eventId = editingEventId;

      if (eventId) {
        // Güncelleme (created_by_user_id değiştirilmez)
        const { error: updateError } = await supabase
          .from("events")
          .update(eventData)
          .eq("id", eventId);
        if (updateError) throw updateError;
        await supabase.from("tickets").delete().eq("event_id", eventId);
        if (!hasExternalLink) {
          const ticketRows = tickets
            .filter((t) => t.quantity > 0)
            .map((t) => {
              const displayName = getTicketDisplayName(t);
              let desc = t.description.trim();
              if (t.presetKey === "grup") {
                const minQ = t.groupMinQuantity != null && t.groupMinQuantity > 0 ? t.groupMinQuantity : 10;
                desc = `Min. ${minQ} adet. ` + (t.discountRules?.trim() ? "Grup indirimi: " + t.discountRules.trim() : "") + (desc ? " " + desc : "");
              }
              if (!desc) desc = `${displayName} - etkinlik bileti`;
              return {
                event_id: eventId,
                name: displayName,
                type: t.type,
                price: Number(t.price) || 0,
                quantity: t.quantity,
                available: t.quantity,
                description: desc.trim(),
              };
            });
          if (ticketRows.length > 0) {
            const { error: ticketsError } = await supabase.from("tickets").insert(ticketRows);
            if (ticketsError) throw ticketsError;
          }
        }
        alert("Etkinlik güncellendi!");
        router.push(`/yonetim/etkinlikler`);
        return;
      }

      if (isOrganizer && user?.id) {
        eventData.created_by_user_id = user.id;
        eventData.is_approved = false;
      }

      const { data: insertedEvent, error: insertError } = await supabase
        .from("events")
        .insert(eventData)
        .select("id")
        .single();

      if (insertError) throw insertError;
      if (!insertedEvent?.id) throw new Error("Etkinlik oluşturulamadı.");

      const ticketRows = hasExternalLink
        ? []
        : tickets
            .filter((t) => t.quantity > 0)
            .map((t) => {
          const displayName = getTicketDisplayName(t);
          let desc = t.description.trim();
          if (t.presetKey === "grup") {
            const minQ = t.groupMinQuantity != null && t.groupMinQuantity > 0 ? t.groupMinQuantity : 10;
            desc = `Min. ${minQ} adet. ` + (t.discountRules?.trim() ? "Grup indirimi: " + t.discountRules.trim() : "") + (desc ? " " + desc : "");
          }
          if (!desc) desc = `${displayName} - etkinlik bileti`;
          return {
            event_id: insertedEvent.id,
            name: displayName,
            type: t.type,
            price: Number(t.price) || 0,
            quantity: t.quantity,
            available: t.quantity,
            description: desc.trim(),
          };
        });

      if (ticketRows.length > 0) {
        const { error: ticketsError } = await supabase.from("tickets").insert(ticketRows);
        if (ticketsError) throw ticketsError;
      }

      const message = isOrganizer
        ? "Etkinliğiniz onaya gönderildi. Yönetici onayından sonra yayına alınacaktır."
        : "Etkinlik oluşturuldu!";
      alert(message);
      router.push(`/tr/etkinlik/${insertedEvent.id}`);
    } catch (err) {
      console.error("Wizard submit error:", err);
      let msg = "Bilinmeyen hata";
      if (err instanceof Error) msg = err.message;
      else if (err && typeof err === "object" && "message" in err) msg = String((err as { message: unknown }).message);
      else if (err && typeof err === "object" && "error_description" in err) msg = String((err as { error_description: unknown }).error_description);
      if (err && typeof err === "object" && "details" in err) msg += " " + String((err as { details: unknown }).details);
      if (err && typeof err === "object" && "hint" in err) msg += " (" + String((err as { hint: unknown }).hint) + ")";
      alert("Kayıt başarısız: " + msg);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex justify-center">
        <span className="text-slate-500">Yükleniyor...</span>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-900 mb-2">
        {isEditMode ? "Etkinlik Düzenleme Sihirbazı" : "Yeni Etkinlik Sihirbazı"}
      </h1>
      <p className="text-slate-600 mb-8">
        {isEditMode ? "Adım adım etkinliğinizi düzenleyin." : "Adım adım etkinliğinizi oluşturun."}
      </p>

      {/* Stepper */}
      <div className="flex items-center gap-2 mb-8 flex-wrap">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setStep(s.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                step === s.id
                  ? "bg-primary-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {s.id}. {s.label}
            </button>
            {i < STEPS.length - 1 && (
              <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden />
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Sol: form */}
        <div className="lg:col-span-2 space-y-6">
          {step === 1 && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Etkinlik adı (TR) *</label>
                <input
                  type="text"
                  value={titleTr}
                  onChange={(e) => setTitleTr(e.target.value)}
                  placeholder="Örn: Cem Adrian Konseri"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Etkinlik adı (DE)</label>
                  <input
                    type="text"
                    value={titleDe}
                    onChange={(e) => setTitleDe(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Etkinlik adı (EN)</label>
                  <input
                    type="text"
                    value={titleEn}
                    onChange={(e) => setTitleEn(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Kısa açıklama (TR)</label>
                <textarea
                  value={descriptionTr}
                  onChange={(e) => setDescriptionTr(e.target.value)}
                  rows={2}
                  placeholder="Etkinlik hakkında kısa metin"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Açıklama (DE)</label>
                  <textarea
                    value={descriptionDe}
                    onChange={(e) => setDescriptionDe(e.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Açıklama (EN)</label>
                  <textarea
                    value={descriptionEn}
                    onChange={(e) => setDescriptionEn(e.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Kategori *</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as EventCategory)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  {DISPLAY_CATEGORIES.map((key) => (
                    <option key={key} value={key}>
                      {CATEGORY_LABELS[key]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Organizasyon / Organizatör adı</label>
                <input
                  type="text"
                  value={organizerDisplayName}
                  onChange={(e) => setOrganizerDisplayName(e.target.value)}
                  placeholder={currentUserOrganizerName ? currentUserOrganizerName : "Etkinlik kartında görünecek isim"}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-primary-500 focus:border-primary-500"
                />
                <p className="mt-1 text-xs text-slate-500">Bu isim etkinlik kartında ve sayfada görünür.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Para birimi</label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as EventCurrency)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="EUR">{CURRENCY_SYMBOLS.EUR} Euro</option>
                    <option value="TL">{CURRENCY_SYMBOLS.TL} TL</option>
                    <option value="USD">{CURRENCY_SYMBOLS.USD} USD</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Başlangıç fiyatı</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={priceFromInput === "" ? "" : priceFromInput}
                    onChange={(e) => {
                      const v = e.target.value;
                      setPriceFromInput(v === "" ? "" : Math.max(0, Number(v) || 0));
                    }}
                    placeholder="Boş bırakırsanız ücretsiz veya bilet fiyatlarından türetilir"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                  <p className="mt-1 text-xs text-slate-500">Tüm dillerde aynı rakam gösterilir. Boş = Ücretsiz.</p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Kapak görseli</label>
                <AdminImageUpload
                  value={imageUrl}
                  onChange={setImageUrl}
                  onUploadingChange={setImageUploading}
                />
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tarih *</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Başlangıç saati *</label>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Mekan *</label>
                <p className="text-xs text-slate-500 mb-1">Koltuk seçimi için <strong>aşağıdaki listeden</strong> mekan seçin; manuel yazarsanız oturum planı kullanılamaz.</p>
                <select
                  value={selectedVenueId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setSelectedVenueId(id);
                      if (id) {
                        const v = venues.find((x) => x.id === id);
                        if (v) {
                          setVenueManualName(v.name);
                          setEventCity(v.city ?? "");
                          setEventAddress(v.address ?? "");
                        }
                      } else {
                        setVenueManualName("");
                        setEventCity("");
                        setEventAddress("");
                      }
                    }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="">— Mekan seçin veya aşağıda manuel yazın —</option>
                  {venues.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} {v.city ? `(${v.city})` : ""}
                    </option>
                  ))}
                </select>
              </div>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setShowNewVenueModal(true)}
                  className="text-sm text-primary-600 hover:underline flex items-center gap-1"
                >
                  <Plus className="h-4 w-4" /> Yeni mekan ekle
                </button>
              )}
              {!selectedVenueId && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Mekan adı (manuel)</label>
                    <input
                      type="text"
                      value={venueManualName}
                      onChange={(e) => setVenueManualName(e.target.value)}
                      placeholder="Mekan adı"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Şehir *</label>
                    <input
                      type="text"
                      value={eventCity}
                      onChange={(e) => setEventCity(e.target.value)}
                      placeholder="Örn: İstanbul, Essen"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                    <p className="mt-1 text-xs text-slate-500">Filtrelemede kısa gösterilir.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Adres</label>
                    <input
                      type="text"
                      value={eventAddress}
                      onChange={(e) => setEventAddress(e.target.value)}
                      placeholder="Cadde, sokak, bina no vb."
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                </>
              )}
              {selectedVenueId && seatingPlans.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Oturum planı (koltuk seçimi)</label>
                  <select
                    value={selectedSeatingPlanId}
                    onChange={(e) => setSelectedSeatingPlanId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="">— Koltuk seçimi kullanılmasın —</option>
                    {seatingPlans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.is_default ? "(varsayılan)" : ""}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-slate-500">Seçerseniz bilet alan kullanıcılar &quot;Yer seçerek bilet al&quot; ile koltuk seçebilir.</p>
                </div>
              )}
              {selectedVenueId && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Şehir</label>
                    <input
                      type="text"
                      value={displayCity}
                      onChange={(e) => setEventCity(e.target.value)}
                      placeholder="Şehir"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Adres</label>
                    <input
                      type="text"
                      value={displayAddress}
                      onChange={(e) => setEventAddress(e.target.value)}
                      placeholder="Adres"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                </>
              )}
            </>
          )}

          {step === 3 && (
            <>
              <div className="rounded-xl border border-slate-200 bg-blue-50/50 p-5 mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-2">Harici bilet linki (opsiyonel)</label>
                <input
                  type="url"
                  value={ticketUrl}
                  onChange={(e) => setTicketUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:ring-primary-500 focus:border-primary-500"
                />
                <p className="mt-2 text-sm text-slate-600">
                  Bu linki girerseniz biletler sitemiz üzerinden satılmayacak; &quot;Bilet Al&quot; bu linke gider. Bilet türü eklemeniz gerekmez.
                </p>
              </div>
              <p className="text-slate-600 mb-4">
                Biletler sitemizden satılacaksa aşağıdan bilet türü ekleyin: bilet türü veya ismi, fiyat ve kapasite zorunludur.
              </p>
              {tickets.map((t) => (
                <div
                  key={t.id}
                  className="rounded-xl border border-slate-200 bg-slate-50/50 p-5 space-y-4"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <label className="block text-sm font-medium text-slate-700 mb-2">Bilet türü veya ismi</label>
                      <select
                        value={t.presetKey}
                        onChange={(e) => {
                          const val = e.target.value;
                          const preset = BILET_TURU_SECENEKLERI.find((x) => x.value === val);
                          if (preset) {
                            updateTicket(t.id, {
                              presetKey: val,
                              name: preset.label,
                              type: preset.type,
                              ...(val === "grup" ? { groupMinQuantity: 10 } : { groupMinQuantity: undefined }),
                            });
                          }
                        }}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 focus:ring-primary-500 focus:border-primary-500"
                      >
                        {BILET_TURU_SECENEKLERI.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      {t.presetKey === "grup" && (
                        <div className="mt-3 space-y-3">
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Minimum adet</label>
                            <input
                              type="number"
                              min={1}
                              value={t.groupMinQuantity ?? 10}
                              onChange={(e) => updateTicket(t.id, { groupMinQuantity: Math.max(1, Number(e.target.value) || 10) })}
                              placeholder="10"
                              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 focus:ring-primary-500 focus:border-primary-500"
                            />
                            <p className="mt-1 text-xs text-slate-500">Bu bilet türünden en az bu kadar adet seçilebilir (örn. 10 adet alana %10 indirim).</p>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Grup indirimi kuralları (organizatör belirler)</label>
                            <input
                              type="text"
                              value={t.discountRules ?? ""}
                              onChange={(e) => updateTicket(t.id, { discountRules: e.target.value })}
                              placeholder="Örn: 10 bilet alana %10, 20 bilet alana %20"
                              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 focus:ring-primary-500 focus:border-primary-500"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeTicket(t.id)}
                      disabled={tickets.length <= 1}
                      className="mt-8 p-2 rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
                      aria-label="Bilet türünü kaldır"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Fiyat ({currency === "EUR" ? "€" : currency === "TL" ? "₺" : "$"})</label>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={t.price || ""}
                        onChange={(e) => updateTicket(t.id, { price: Number(e.target.value) || 0 })}
                        placeholder="0"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Kapasite (kaç tane)</label>
                      <input
                        type="number"
                        min={0}
                        value={t.quantity || ""}
                        onChange={(e) => updateTicket(t.id, { quantity: Math.max(0, Number(e.target.value) || 0) })}
                        placeholder="Örn: 100"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Açıklama (opsiyonel)</label>
                    <input
                      type="text"
                      value={t.description}
                      onChange={(e) => updateTicket(t.id, { description: e.target.value })}
                      placeholder="Bu bilet türü hakkında kısa açıklama"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={addTicket}
                className="flex items-center gap-2 text-primary-600 hover:underline font-medium mt-4"
              >
                <Plus className="h-4 w-4" /> Bilet türü ekle
              </button>
            </>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <p className="text-slate-600">
                {isEditMode
                  ? "Aşağıdaki önizlemeyi kontrol edin. \"Güncelle\" ile değişiklikler kaydedilir."
                  : "Aşağıdaki önizlemeyi kontrol edin. \"Onaya gönder\" ile etkinlik oluşturulur"
                  + (isOrganizer ? " ve yönetici onayına gönderilir." : ".")}
              </p>
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
                >
                  Geri dön ve düzenle
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting || imageUploading}
                  className="px-6 py-2 rounded-lg bg-primary-600 text-white font-semibold hover:bg-primary-700 disabled:opacity-50"
                >
                  {submitting ? (isEditMode ? "Güncelleniyor..." : "Gönderiliyor...") : (isEditMode ? "Güncelle" : "Onaya gönder")}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Sağ: canlı önizleme (step 1) veya özet (step 4) */}
        <div className="lg:col-span-1">
          {(step === 1 || step === 4) && (
            <div className="sticky top-4">
              <p className="text-sm font-medium text-slate-500 mb-2">
                {step === 1 ? "Etkinlik kartı önizlemesi" : "Önizleme"}
              </p>
              <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                <div className="aspect-video bg-slate-100 flex items-center justify-center">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={titleTr || "Etkinlik"}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Music2 className="h-16 w-16 text-slate-300" />
                  )}
                </div>
                <div className="p-4 space-y-2">
                  <span className="text-xs font-medium text-primary-600">
                    {CATEGORY_LABELS[category]}
                  </span>
                  <h3 className="font-semibold text-slate-900 line-clamp-1">
                    {titleTr || "Etkinlik adı"}
                  </h3>
                  <p className="text-sm text-slate-600 line-clamp-2">
                    {descriptionTr || "Kısa açıklama burada görünecek."}
                  </p>
                  {step === 1 && (
                    <div className="pt-2 border-t border-slate-100">
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <Calendar className="h-4 w-4" />
                        Tarih ve saat
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <MapPin className="h-4 w-4" />
                        Mekan
                      </div>
                      {(organizerDisplayName || currentUserOrganizerName) && (
                        <div className="flex items-center gap-2 text-sm text-primary-600">
                          <Building2 className="h-4 w-4" />
                          {organizerDisplayName || currentUserOrganizerName}
                        </div>
                      )}
                    </div>
                  )}
                  {step === 4 && (
                    <>
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Calendar className="h-4 w-4 flex-shrink-0" />
                        {date && time
                          ? `${new Date(date).toLocaleDateString("tr-TR")} • ${time}`
                          : "—"}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <MapPin className="h-4 w-4 flex-shrink-0" />
                        {venueDisplayName || "—"}, {venueDisplayLocation || "—"}
                      </div>
                      {(organizerDisplayName || currentUserOrganizerName) && (
                        <div className="flex items-center gap-2 text-sm text-primary-600">
                          <Building2 className="h-4 w-4 flex-shrink-0" />
                          {organizerDisplayName || currentUserOrganizerName}
                        </div>
                      )}
                      {ticketUrl && (
                        <div className="flex items-center gap-1 text-xs text-primary-600 mt-2">
                          <ExternalLink className="h-3 w-3" />
                          Harici bilet linki eklendi
                        </div>
                      )}
                    </>
                  )}
                </div>
                <div className="px-4 pb-4">
                  {priceFrom > 0 ? (
                    <span className="font-bold text-primary-600">
                      ab {formatPrice(priceFrom, currency)}
                    </span>
                  ) : (
                    <span className="font-bold text-slate-600">Ücretsiz</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigasyon */}
      <div className="flex justify-between mt-8 pt-6 border-t border-slate-200">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(1, s - 1))}
          disabled={step === 1}
          className="flex items-center gap-1 px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="h-4 w-4" /> Geri
        </button>
        {step < 4 && (
          <button
            type="button"
            onClick={() => setStep((s) => s + 1)}
            disabled={
              (step === 1 && !canProceedStep1) ||
              (step === 2 && !canProceedStep2) ||
              (step === 3 && !canProceedStep3)
            }
            className="flex items-center gap-1 px-4 py-2 rounded-lg bg-primary-600 text-white font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            İleri <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Yeni mekan modal */}
      {showNewVenueModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Yeni mekan ekle</h3>
              <button
                type="button"
                onClick={() => setShowNewVenueModal(false)}
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Mekan adı *</label>
                <input
                  type="text"
                  value={newVenueName}
                  onChange={(e) => setNewVenueName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  placeholder="Örn: Zorlu PSM"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Şehir</label>
                <input
                  type="text"
                  value={newVenueCity}
                  onChange={(e) => setNewVenueCity(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  placeholder="İstanbul"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Adres</label>
                <input
                  type="text"
                  value={newVenueAddress}
                  onChange={(e) => setNewVenueAddress(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  placeholder="Opsiyonel"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowNewVenueModal(false)}
                className="flex-1 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={handleCreateVenue}
                className="flex-1 py-2 rounded-lg bg-primary-600 text-white font-medium hover:bg-primary-700"
              >
                Ekle
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
