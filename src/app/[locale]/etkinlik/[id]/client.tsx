"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Calendar, MapPin, Clock, Ticket, Share2, Heart, ChevronRight, Star, Users, Car, DoorOpen, HelpCircle, ChevronDown, ChevronUp, Bell } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import Header from "@/components/Header";
import type { Event, Ticket as EventTicket, Venue } from "@/types/database";
import TicketPrint from "@/components/TicketPrint";
import { parseEventDescription } from "@/lib/eventMeta";
import { formatPrice } from "@/lib/formatPrice";
import { getLocalizedEvent } from "@/lib/i18n-content";
import { extractMapEmbedUrl } from "@/lib/mapEmbed";
import Link from "next/link";

interface EventDetailClientProps {
  event: Event;
  tickets: EventTicket[];
  venue?: Venue | null;
  locale?: "tr" | "de" | "en";
}

const dateLocaleMap = { tr: "tr-TR", de: "de-DE", en: "en-US" } as const;
/** Sipariş başına en fazla kaç bilet seçilebilir */
const MAX_TICKETS_PER_ORDER = 10;

export default function EventDetailClient({ event, tickets, venue = null, locale: localeProp = "tr" }: EventDetailClientProps) {
  const t = useTranslations("eventDetail");
  const tCat = useTranslations("categories");
  const locale = (useLocale() as "tr" | "de" | "en") || localeProp;
  const dateLocale = dateLocaleMap[locale] || "tr-TR";

  const [ticketState, setTicketState] = useState<EventTicket[]>(tickets);
  const availableTickets = ticketState.filter((ticket) => Number(ticket.available || 0) > 0);
  const localized = useMemo(() => getLocalizedEvent(event as unknown as Record<string, unknown>, locale), [event, locale]);
  const parsedDescription = useMemo(() => parseEventDescription(localized.description || event.description), [localized.description, event.description]);
  const externalTicketUrl = parsedDescription.externalTicketUrl;
  const isExternalOnlyEvent = Boolean(externalTicketUrl) && availableTickets.length === 0;
  const [selectedTicketType, setSelectedTicketType] = useState<string>(
    availableTickets[0]?.id || ""
  );
  const [ticketCount, setTicketCount] = useState<number>(1);
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    ticketCode?: string;
    emailSent?: boolean;
    emailError?: string;
    orderDetails?: {
      buyerName: string;
      quantity: number;
      ticketType: string;
      price: number;
    };
  } | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [venueFaqOpen, setVenueFaqOpen] = useState(false);
  const [reminderEmail, setReminderEmail] = useState("");
  const [reminderPending, setReminderPending] = useState(false);
  const [reminderResult, setReminderResult] = useState<{ success: boolean; message: string } | null>(null);
  const selectedTicket = availableTickets.find((t) => t.id === selectedTicketType);
  const totalPrice = selectedTicket ? selectedTicket.price * ticketCount : 0;
  const eventDateTime = new Date(`${event.date} ${event.time || "23:59"}`);
  const isPastEvent = eventDateTime < new Date();

  async function handleReminderSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reminderEmail.trim()) return;
    setReminderPending(true);
    setReminderResult(null);
    try {
      const res = await fetch("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: reminderEmail.trim(), event_id: event.id }),
      });
      const data = await res.json();
      setReminderResult({ success: data.success, message: data.message || t("actionFailed") });
      if (data.success) setReminderEmail("");
    } catch {
      setReminderResult({ success: false, message: t("actionFailed") });
    } finally {
      setReminderPending(false);
    }
  }

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("favorite_events");
      const favorites = stored ? (JSON.parse(stored) as string[]) : [];
      setIsFavorite(favorites.includes(event.id));
    } catch {
      setIsFavorite(false);
    }
  }, [event.id]);

  // Huni analitiği: etkinlik görüntüleme
  useEffect(() => {
    let sid = "";
    let heroVariant: string | undefined;
    try {
      sid = sessionStorage.getItem("analytics_session") || "";
      if (!sid) {
        sid = `s_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
        sessionStorage.setItem("analytics_session", sid);
      }
      const hv = sessionStorage.getItem("hero_ab_variant");
      if (hv) {
        const parsed = JSON.parse(hv) as { variant?: string };
        heroVariant = parsed?.variant;
      }
    } catch {
      /* ignore */
    }
    fetch("/api/analytics/funnel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "view",
        event_id: event.id,
        session_id: sid || undefined,
        hero_variant: heroVariant,
      }),
    }).catch(() => {});
  }, [event.id]);

  function toggleFavorite() {
    try {
      const stored = window.localStorage.getItem("favorite_events");
      const favorites = stored ? (JSON.parse(stored) as string[]) : [];
      const alreadyFavorite = favorites.includes(event.id);
      const next = alreadyFavorite
        ? favorites.filter((id) => id !== event.id)
        : [...favorites, event.id];
      window.localStorage.setItem("favorite_events", JSON.stringify(next));
      setIsFavorite(!alreadyFavorite);
      setActionMessage(alreadyFavorite ? t("removedFromFavorites") : t("addedToFavorites"));
      window.setTimeout(() => setActionMessage(null), 2200);
    } catch {
      setActionMessage(t("actionFailed"));
      window.setTimeout(() => setActionMessage(null), 2200);
    }
  }

  async function handleShare() {
    const shareUrl = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({
          title: localized.title,
          text: t("shareEventText", { title: localized.title }),
          url: shareUrl,
        });
        setActionMessage(t("shareOpened"));
        window.setTimeout(() => setActionMessage(null), 2200);
        return;
      }

      await navigator.clipboard.writeText(shareUrl);
      setActionMessage(t("linkCopied"));
      window.setTimeout(() => setActionMessage(null), 2200);
    } catch {
      setActionMessage(t("shareFailed"));
      window.setTimeout(() => setActionMessage(null), 2200);
    }
  }

  async function handlePurchase() {
    if (!selectedTicket) {
      setResult({ success: false, message: t("pleaseSelectTicket") });
      return;
    }

    if (!buyerName.trim() || !buyerEmail.trim()) {
      setResult({ success: false, message: t("nameEmailRequired") });
      return;
    }

    setIsPending(true);
    try {
      // Huni analitiği: ödeme başlatma
      let sid = "";
      let heroVariant: string | undefined;
      try {
        sid = sessionStorage.getItem("analytics_session") || "";
        const hv = sessionStorage.getItem("hero_ab_variant");
        if (hv) {
          const parsed = JSON.parse(hv) as { variant?: string };
          heroVariant = parsed?.variant;
        }
      } catch {
        /* ignore */
      }
      fetch("/api/analytics/funnel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "purchase_intent",
          event_id: event.id,
          ticket_id: selectedTicket.id,
          session_id: sid || undefined,
          hero_variant: heroVariant,
        }),
      }).catch(() => {});

      const formData = new FormData();
      formData.append("ticket_id", selectedTicket.id);
      formData.append("quantity", String(ticketCount));
      formData.append("buyer_name", buyerName.trim());
      formData.append("buyer_email", buyerEmail.trim());

      const response = await fetch("/api/purchase", {
        method: "POST",
        body: formData,
      });

      const purchaseResult = await response.json();
      setResult(purchaseResult);

      if (purchaseResult?.success) {
        setBuyerName("");
        setBuyerEmail("");
        setTicketState((prev) =>
          prev.map((ticket) =>
            ticket.id === selectedTicket.id
              ? { ...ticket, available: Math.max(0, Number(ticket.available || 0) - ticketCount) }
              : ticket
          )
        );
      }
    } catch {
      setResult({
        success: false,
        message: t("purchaseError"),
      });
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f6f8]">
      <Header />
      
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto w-full max-w-7xl px-4 py-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">
            {tCat((event.category || "diger").toLowerCase())}
          </p>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
            <div>
              <h1 className="text-3xl lg:text-4xl font-extrabold text-slate-900">{localized.title}</h1>
              <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-700">
                <span className="inline-flex items-center gap-2 rounded-md bg-slate-100 px-3 py-1.5">
                  <Calendar className="h-4 w-4" />
                  {new Date(event.date).toLocaleDateString(dateLocale, {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
                <span className="inline-flex items-center gap-2 rounded-md bg-slate-100 px-3 py-1.5">
                  <Clock className="h-4 w-4" />
                  {event.time}
                </span>
                <span className="inline-flex items-center gap-2 rounded-md bg-slate-100 px-3 py-1.5">
                  <MapPin className="h-4 w-4" />
                  {localized.venue || event.venue}
                </span>
                <span className="inline-flex items-center gap-2 rounded-md bg-slate-100 px-3 py-1.5">
                  <MapPin className="h-4 w-4" />
                  {event.location || localized.venue || event.venue}
                </span>
              </div>
              <div className="mt-5">
                <p className="text-sm text-slate-600">{t("tickets")}</p>
                <p className="text-2xl font-bold text-primary-700">
                  {availableTickets.length > 0
                    ? `${t("from")} ${formatPrice(Math.min(...availableTickets.map((t) => Number(t.price || 0))), event.currency)}`
                    : isExternalOnlyEvent
                      ? `${t("from")} ${formatPrice(Number(event.price_from || 0), event.currency)}`
                      : t("comingSoon")}
                </p>
              </div>
            </div>

            <div>
              <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                {event.image_url ? (
                  <Image
                    src={event.image_url}
                    alt={localized.title}
                    fill
                    priority
                    className="object-cover"
                    sizes="(max-width: 1024px) 100vw, 360px"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Ticket className="h-16 w-16 text-slate-400" />
                  </div>
                )}
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={toggleFavorite}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Heart className="h-4 w-4" />
                  {isFavorite ? t("favorited") : t("favorite")}
                </button>
                <button
                  onClick={handleShare}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Share2 className="h-4 w-4" />
                  {t("share")}
                </button>
              </div>
              {actionMessage && <p className="mt-2 text-xs text-slate-500">{actionMessage}</p>}
            </div>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="mx-auto w-full max-w-7xl px-4 py-10">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Sol Taraf - Bilet Seçimi */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl border border-slate-200 p-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-6">
                {isExternalOnlyEvent ? t("ticketInfo") : t("ticketSelection")}
              </h2>

              {isExternalOnlyEvent && (
                <div className="mb-8 rounded-xl border border-blue-200 bg-blue-50 p-5">
                  <p className="text-sm text-blue-900 mb-4">
                    {t("externalTicketInfo")}{" "}
                    {t("priceFrom")}: <strong>{formatPrice(Number(event.price_from || 0), event.currency)}</strong>
                  </p>
                  <p className="text-sm text-blue-800 mb-3">
                    {t("externalTicketDisclaimer")}
                  </p>
                  <p className="text-sm text-blue-800 mb-4">
                    {t("externalTicketDisclaimer2")} {t("externalTicketSupport")}
                  </p>
                  <a
                        href={externalTicketUrl || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    {t("buyExternal")}
                    <ChevronRight className="h-4 w-4" />
                  </a>
                </div>
              )}

              {result?.success && result.ticketCode && (
                <div className="mb-8 rounded-xl border border-green-200 bg-green-50 p-4">
                  <p className="mb-3 text-sm font-medium text-green-800">
                    {result.message}
                  </p>
                  <TicketPrint
                    ticketCode={result.ticketCode}
                    buyerName={result.orderDetails?.buyerName || buyerName}
                    quantity={result.orderDetails?.quantity || ticketCount}
                    ticketType={result.orderDetails?.ticketType || selectedTicket?.name || ""}
                    price={result.orderDetails?.price || totalPrice}
                    currency={event.currency}
                    eventTitle={localized.title}
                    eventDate={event.date}
                    eventTime={event.time}
                    venue={localized.venue || event.venue}
                    location={event.location}
                  />

                  {result.emailSent === false && (
                    <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                      {t("emailNotSent")}
                    </p>
                  )}
                </div>
              )}
              
              {/* Bilet Türleri - Eventim Benzeri Liste */}
              {!isExternalOnlyEvent && (availableTickets.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-slate-600">
                  {t("noTicketsAvailable")}
                </div>
              ) : (
                <div className="mb-8 overflow-hidden rounded-xl border border-slate-200">
                  <div className="hidden bg-slate-100 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600 md:grid md:grid-cols-[minmax(0,1fr)_120px_170px]">
                    <span>{t("ticketType")}</span>
                    <span>{t("price")}</span>
                    <span className="text-right">{t("quantity")}</span>
                  </div>
                  <div className="divide-y divide-slate-200">
                    {availableTickets.map((ticketType) => {
                      const isSelected = selectedTicketType === ticketType.id;
                      const availableAmount = Number(ticketType.available || 0);
                      const maxSelectable = Math.min(availableAmount, MAX_TICKETS_PER_ORDER);
                      const rowCount = isSelected ? ticketCount : 0;

                      return (
                        <div
                          key={ticketType.id}
                          className={`cursor-pointer px-5 py-4 transition-colors ${
                            isSelected ? "bg-blue-50" : "bg-white hover:bg-slate-50"
                          }`}
                          onClick={() => {
                            setSelectedTicketType(ticketType.id);
                            setTicketCount((current) => {
                              if (!isSelected) return 1;
                              return Math.min(Math.max(1, current), maxSelectable || 1);
                            });
                          }}
                        >
                          <div className="grid items-center gap-4 md:grid-cols-[minmax(0,1fr)_120px_170px]">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{ticketType.name}</p>
                              <p className="text-xs text-slate-500">{t("remaining")}: {availableAmount}</p>
                            </div>

                            <p className="text-lg font-bold text-primary-700">{formatPrice(ticketType.price, event.currency)}</p>

                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedTicketType(ticketType.id);
                                  setTicketCount((current) => {
                                    if (!isSelected) return 1;
                                    return Math.max(1, current - 1);
                                  });
                                }}
                                disabled={availableAmount <= 0 || isPastEvent}
                                className="h-9 w-9 rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                -
                              </button>
                              <span className="w-8 text-center text-sm font-semibold text-slate-900">{rowCount}</span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedTicketType(ticketType.id);
                                  setTicketCount((current) => {
                                    if (!isSelected) return 1;
                                    return Math.min(maxSelectable || 1, current + 1);
                                  });
                                }}
                                disabled={availableAmount <= 0 || isPastEvent || rowCount >= maxSelectable}
                                className="h-9 w-9 rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {!isExternalOnlyEvent && <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">{t("fullName")}</label>
                  <input
                    type="text"
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    disabled={isPastEvent}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                    placeholder={t("fullNamePlaceholder")}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">{t("email")}</label>
                  <input
                    type="email"
                    value={buyerEmail}
                    onChange={(e) => setBuyerEmail(e.target.value)}
                    disabled={isPastEvent}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                    placeholder={t("reminderPlaceholder")}
                  />
                </div>
              </div>}

              {/* Toplam Fiyat ve Satın Al */}
              {!isExternalOnlyEvent && <div className="border-t pt-6">
                <div className="flex items-center justify-between mb-6">
                  <span className="text-lg font-semibold text-slate-900">{t("totalPrice")}</span>
                  <span className="text-3xl font-bold text-blue-600">€{totalPrice.toFixed(2)}</span>
                </div>

                {result && !result.success && (
                  <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {result.message}
                  </p>
                )}

                {isPastEvent && (
                  <p className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
                    {t("eventEnded")}
                  </p>
                )}

                <button
                  type="button"
                  onClick={handlePurchase}
                  disabled={isPending || !selectedTicket || isPastEvent}
                  className="w-full rounded-lg bg-primary-600 px-8 py-4 text-lg font-semibold text-white transition-colors hover:bg-primary-700 disabled:bg-slate-300 disabled:text-slate-500"
                >
                  {isPending ? t("processing") : t("buyTicket")}
                </button>
              </div>}
            </div>

            {/* Etkinlik Detayları */}
            <div className="bg-white rounded-xl border border-slate-200 p-8 mt-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-6">{t("aboutEvent")}</h2>
              <div className="prose prose-slate max-w-none">
                <p className="text-slate-700 leading-relaxed">
                  {parsedDescription.content || t("aboutPlaceholder")}
                </p>
              </div>
            </div>

            {/* Mekan Bilgisi - SSS, Ulaşım, Giriş */}
            {venue && (
              <div className="bg-white rounded-xl border border-slate-200 p-8 mt-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-slate-900">{t("venueInfo")}</h2>
                  <Link
                    href={`/${locale}/mekanlar`}
                    className="text-sm font-medium text-primary-600 hover:text-primary-700"
                  >
                    {t("allVenues")} →
                  </Link>
                </div>
                <div className="space-y-6">
                  {(venue.image_url_1 || venue.image_url_2) && (
                    <div className="flex gap-2">
                      {venue.image_url_1 && (
                        <img
                          src={venue.image_url_1}
                          alt={`${venue.name} - Fotoğraf 1`}
                          className="rounded-lg border border-slate-200 object-cover h-32 w-full max-w-[200px]"
                        />
                      )}
                      {venue.image_url_2 && (
                        <img
                          src={venue.image_url_2}
                          alt={`${venue.name} - Fotoğraf 2`}
                          className="rounded-lg border border-slate-200 object-cover h-32 w-full max-w-[200px]"
                        />
                      )}
                    </div>
                  )}
                  {venue.seating_layout_description && (
                    <div>
                      <h3 className="font-semibold text-slate-800 mb-2">{t("seatingPlan")}</h3>
                      <p className="text-slate-600">{venue.seating_layout_description}</p>
                      {venue.seating_layout_image_url && (
                        <img
                          src={venue.seating_layout_image_url}
                          alt={`${venue.name} oturma planı`}
                          className="mt-3 rounded-lg border border-slate-200 max-w-md"
                        />
                      )}
                    </div>
                  )}
                  {venue.transport_info && (
                    <div className="flex items-start gap-3">
                      <Car className="h-5 w-5 text-primary-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-slate-800 mb-1">{t("transport")}</h3>
                        <div
                          className="text-slate-600 prose prose-sm max-w-none [&_p]:my-1 [&_ul]:my-2"
                          dangerouslySetInnerHTML={{ __html: venue.transport_info }}
                        />
                      </div>
                    </div>
                  )}
                  {(() => {
                    const mapUrl = extractMapEmbedUrl(venue.map_embed_url);
                    return mapUrl ? (
                      <div>
                        <h3 className="font-semibold text-slate-800 mb-2">{t("map")}</h3>
                        <div className="aspect-video w-full max-w-2xl overflow-hidden rounded-lg border border-slate-200">
                          <iframe
                            src={mapUrl}
                            width="100%"
                            height="100%"
                            style={{ border: 0 }}
                            allowFullScreen
                            loading="lazy"
                            referrerPolicy="no-referrer-when-downgrade"
                            title={`${venue.name} harita`}
                            className="h-full w-full"
                          />
                        </div>
                      </div>
                    ) : null;
                  })()}
                  {venue.entrance_info && (
                    <div className="flex items-start gap-3">
                      <DoorOpen className="h-5 w-5 text-primary-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <h3 className="font-semibold text-slate-800 mb-1">{t("entranceInfo")}</h3>
                        <p className="text-slate-600">{venue.entrance_info}</p>
                      </div>
                    </div>
                  )}
                  {venue.rules && (
                    <div>
                      <h3 className="font-semibold text-slate-800 mb-1">{t("entranceRules")}</h3>
                      <p className="text-slate-600">{venue.rules}</p>
                    </div>
                  )}
                  {venue.faq.length > 0 && (
                    <div>
                      <button
                        onClick={() => setVenueFaqOpen((o) => !o)}
                        className="flex items-center gap-2 text-slate-800 font-semibold hover:text-primary-600"
                      >
                        <HelpCircle className="h-5 w-5" />
                        {t("faq")}
                        {venueFaqOpen ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </button>
                      {venueFaqOpen && (
                        <div className="mt-4 space-y-4 border-l-2 border-primary-200 pl-4">
                          {venue.faq.map((item, i) => (
                            <div key={i}>
                              <p className="font-medium text-slate-800">{item.soru}</p>
                              <p className="mt-1 text-slate-600">{item.cevap}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Sağ Taraf - Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-6 space-y-6">
              {/* Hızlı Bilgiler */}
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">{t("eventInfo")}</h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <Calendar className="h-5 w-5 text-blue-500 mt-0.5" />
                    <div>
                      <p className="font-medium text-slate-900">{t("date")}</p>
                      <p className="text-sm text-slate-600">
                        {new Date(event.date).toLocaleDateString(dateLocale, { 
                          weekday: 'long',
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <Clock className="h-5 w-5 text-blue-500 mt-0.5" />
                    <div>
                      <p className="font-medium text-slate-900">{t("time")}</p>
                      <p className="text-sm text-slate-600">{event.time}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-blue-500 mt-0.5" />
                    <div>
                      <p className="font-medium text-slate-900">{t("venue")}</p>
                      <p className="text-sm text-slate-600">{localized.venue || event.venue}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-blue-500 mt-0.5" />
                    <div>
                      <p className="font-medium text-slate-900">{t("location")}</p>
                      <p className="text-sm text-slate-600">{event.location || localized.venue || event.venue}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <Users className="h-5 w-5 text-blue-500 mt-0.5" />
                    <div>
                      <p className="font-medium text-slate-900">{t("category")}</p>
                      <p className="text-sm text-slate-600">{tCat((event.category || "diger").toLowerCase())}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bilet Uyarısı */}
              {!isPastEvent && (
                <div className="bg-amber-50 rounded-xl border border-amber-200 p-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-2 flex items-center gap-2">
                    <Bell className="h-5 w-5 text-amber-600" />
                    {t("ticketReminder")}
                  </h3>
                  <p className="text-sm text-slate-600 mb-4">
                    {t("reminderDesc")}
                  </p>
                  <form onSubmit={handleReminderSubmit} className="space-y-3">
                    <input
                      type="email"
                      value={reminderEmail}
                      onChange={(e) => setReminderEmail(e.target.value)}
                      placeholder={t("reminderPlaceholder")}
                      required
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                    />
                    <button
                      type="submit"
                      disabled={reminderPending}
                      className="w-full rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                    >
                      {reminderPending ? t("saving") : t("getReminder")}
                    </button>
                  </form>
                  {reminderResult && (
                    <p className={`mt-3 text-sm ${reminderResult.success ? "text-green-700" : "text-red-700"}`}>
                      {reminderResult.message}
                    </p>
                  )}
                </div>
              )}

              {/* Güvenli Alışveriş */}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">{t("secureShopping")}</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                      <Star className="h-4 w-4 text-white" />
                    </div>
                    <span className="text-sm text-slate-700">{t("originalTicket")}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                      <Star className="h-4 w-4 text-white" />
                    </div>
                    <span className="text-sm text-slate-700">{t("securePayment")}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                      <Star className="h-4 w-4 text-white" />
                    </div>
                    <span className="text-sm text-slate-700">{t("instantDelivery")}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
