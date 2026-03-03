"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Calendar, MapPin, Clock, Ticket, Share2, Heart, ChevronRight, Star, Users, Car, DoorOpen, HelpCircle, ChevronDown, ChevronUp } from "lucide-react";
import Header from "@/components/Header";
import type { Event, Ticket as EventTicket, Venue } from "@/types/database";
import TicketPrint from "@/components/TicketPrint";
import { parseEventDescription } from "@/lib/eventMeta";
import { extractMapEmbedUrl } from "@/lib/mapEmbed";
import Link from "next/link";

interface EventDetailClientProps {
  event: Event;
  tickets: EventTicket[];
  venue?: Venue | null;
}

export default function EventDetailClient({ event, tickets, venue = null }: EventDetailClientProps) {
  const [ticketState, setTicketState] = useState<EventTicket[]>(tickets);
  const availableTickets = ticketState.filter((ticket) => Number(ticket.available || 0) > 0);
  const parsedDescription = useMemo(() => parseEventDescription(event.description), [event.description]);
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
  const selectedTicket = availableTickets.find((t) => t.id === selectedTicketType);
  const totalPrice = selectedTicket ? selectedTicket.price * ticketCount : 0;
  const eventDateTime = new Date(`${event.date} ${event.time || "23:59"}`);
  const isPastEvent = eventDateTime < new Date();

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("favorite_events");
      const favorites = stored ? (JSON.parse(stored) as string[]) : [];
      setIsFavorite(favorites.includes(event.id));
    } catch {
      setIsFavorite(false);
    }
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
      setActionMessage(alreadyFavorite ? "Favorilerden cikarildi." : "Favorilere eklendi.");
      window.setTimeout(() => setActionMessage(null), 2200);
    } catch {
      setActionMessage("Islem tamamlanamadi.");
      window.setTimeout(() => setActionMessage(null), 2200);
    }
  }

  async function handleShare() {
    const shareUrl = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({
          title: event.title,
          text: `${event.title} etkinligini inceleyin.`,
          url: shareUrl,
        });
        setActionMessage("Paylasim penceresi acildi.");
        window.setTimeout(() => setActionMessage(null), 2200);
        return;
      }

      await navigator.clipboard.writeText(shareUrl);
      setActionMessage("Etkinlik linki kopyalandi.");
      window.setTimeout(() => setActionMessage(null), 2200);
    } catch {
      setActionMessage("Paylasim tamamlanamadi.");
      window.setTimeout(() => setActionMessage(null), 2200);
    }
  }

  async function handlePurchase() {
    if (!selectedTicket) {
      setResult({ success: false, message: "Lütfen bir bilet türü seçin." });
      return;
    }

    if (!buyerName.trim() || !buyerEmail.trim()) {
      setResult({ success: false, message: "Ad soyad ve e-posta zorunludur." });
      return;
    }

    setIsPending(true);
    try {
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
        message: "Bilet satın alınırken bir hata oluştu. Lütfen tekrar deneyin.",
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
            {event.category}
          </p>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
            <div>
              <h1 className="text-3xl lg:text-4xl font-extrabold text-slate-900">{event.title}</h1>
              <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-700">
                <span className="inline-flex items-center gap-2 rounded-md bg-slate-100 px-3 py-1.5">
                  <Calendar className="h-4 w-4" />
                  {new Date(event.date).toLocaleDateString("tr-TR", {
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
                  {event.venue}
                </span>
                <span className="inline-flex items-center gap-2 rounded-md bg-slate-100 px-3 py-1.5">
                  <MapPin className="h-4 w-4" />
                  {event.location || event.venue}
                </span>
              </div>
              <div className="mt-5">
                <p className="text-sm text-slate-600">Biletler</p>
                <p className="text-2xl font-bold text-primary-700">
                  {availableTickets.length > 0
                    ? `ab €${Math.min(...availableTickets.map((t) => Number(t.price || 0))).toFixed(2)}`
                    : isExternalOnlyEvent
                      ? `ab €${Number(event.price_from || 0).toFixed(2)}`
                      : "Yakında"}
                </p>
              </div>
            </div>

            <div>
              <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                {event.image_url ? (
                  <Image
                    src={event.image_url}
                    alt={event.title}
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
                  {isFavorite ? "Favoride" : "Favori"}
                </button>
                <button
                  onClick={handleShare}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Share2 className="h-4 w-4" />
                  Paylaş
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
                {isExternalOnlyEvent ? "Bilet Bilgisi" : "Bilet Seçimi"}
              </h2>

              {isExternalOnlyEvent && (
                <div className="mb-8 rounded-xl border border-blue-200 bg-blue-50 p-5">
                  <p className="text-sm text-blue-900 mb-4">
                    Bu etkinliğin bilet satışı harici bir platform üzerinden yapılmaktadır.
                    Başlangıç fiyatı: <strong>€{Number(event.price_from || 0).toFixed(2)}</strong>
                  </p>
                  <p className="text-sm text-blue-800 mb-3">
                    Bu etkinlik ile ilgili bilgi ve fotograflar tanitim amaciyla sitemize konulmustur.
                  </p>
                  <p className="text-sm text-blue-800 mb-4">
                    Harici sitede gerçekleşen ödeme, iade, iptal ve bilet teslimat süreçlerinden platformumuz sorumlu değildir.
                    Tüm destek taleplerinizi ilgili satış kanalıyla iletmeniz gerekir.
                  </p>
                  <a
                        href={externalTicketUrl || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    Harici Siteden Bilet Al
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
                    eventTitle={event.title}
                    eventDate={event.date}
                    eventTime={event.time}
                    venue={event.venue}
                    location={event.location}
                  />

                  {result.emailSent === false && (
                    <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                      Biletiniz başarıyla oluşturuldu ve yukarıda görüntüleniyor. 
                      Ancak e-posta gönderiminde geçici bir sorun yaşandı; bu, sistemin test modunda olmasından kaynaklanıyor olabilir.
                      Lütfen bu sayfadaki bileti kaydedin; e-posta altyapısı tamamlandığında biletler otomatik olarak e-posta ile de iletilecektir.
                    </p>
                  )}
                </div>
              )}
              
              {/* Bilet Türleri - Eventim Benzeri Liste */}
              {!isExternalOnlyEvent && (availableTickets.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-slate-600">
                  Bu etkinlik için satışa açık bilet bulunmuyor.
                </div>
              ) : (
                <div className="mb-8 overflow-hidden rounded-xl border border-slate-200">
                  <div className="hidden bg-slate-100 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600 md:grid md:grid-cols-[minmax(0,1fr)_120px_170px]">
                    <span>Bilet Türü</span>
                    <span>Fiyat</span>
                    <span className="text-right">Adet</span>
                  </div>
                  <div className="divide-y divide-slate-200">
                    {availableTickets.map((ticketType) => {
                      const isSelected = selectedTicketType === ticketType.id;
                      const availableAmount = Number(ticketType.available || 0);
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
                              return Math.min(Math.max(1, current), availableAmount || 1);
                            });
                          }}
                        >
                          <div className="grid items-center gap-4 md:grid-cols-[minmax(0,1fr)_120px_170px]">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{ticketType.name}</p>
                              <p className="text-xs text-slate-500">Kalan bilet: {availableAmount}</p>
                            </div>

                            <p className="text-lg font-bold text-primary-700">€{ticketType.price.toFixed(2)}</p>

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
                                    return Math.min(availableAmount || 1, current + 1);
                                  });
                                }}
                                disabled={availableAmount <= 0 || isPastEvent}
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
                  <label className="block text-sm font-medium text-slate-700 mb-2">Ad Soyad</label>
                  <input
                    type="text"
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    disabled={isPastEvent}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                    placeholder="Adınız Soyadınız"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">E-posta</label>
                  <input
                    type="email"
                    value={buyerEmail}
                    onChange={(e) => setBuyerEmail(e.target.value)}
                    disabled={isPastEvent}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                    placeholder="ornek@mail.com"
                  />
                </div>
              </div>}

              {/* Toplam Fiyat ve Satın Al */}
              {!isExternalOnlyEvent && <div className="border-t pt-6">
                <div className="flex items-center justify-between mb-6">
                  <span className="text-lg font-semibold text-slate-900">Toplam Fiyat</span>
                  <span className="text-3xl font-bold text-blue-600">€{totalPrice.toFixed(2)}</span>
                </div>

                {result && !result.success && (
                  <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {result.message}
                  </p>
                )}

                {isPastEvent && (
                  <p className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
                    Bu etkinlik tamamlanmıştır. Bilet satışı kapalıdır.
                  </p>
                )}

                <button
                  type="button"
                  onClick={handlePurchase}
                  disabled={isPending || !selectedTicket || isPastEvent}
                  className="w-full rounded-lg bg-primary-600 px-8 py-4 text-lg font-semibold text-white transition-colors hover:bg-primary-700 disabled:bg-slate-300 disabled:text-slate-500"
                >
                  {isPending ? "İşleniyor..." : "BİLET SATIN AL"}
                </button>
              </div>}
            </div>

            {/* Etkinlik Detayları */}
            <div className="bg-white rounded-xl border border-slate-200 p-8 mt-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-6">Etkinlik Hakkında</h2>
              <div className="prose prose-slate max-w-none">
                <p className="text-slate-700 leading-relaxed">
                  {parsedDescription.content || "Etkinlik hakkında detaylı bilgi yakında eklenecek."}
                </p>
              </div>
            </div>

            {/* Mekan Bilgisi - SSS, Ulaşım, Giriş */}
            {venue && (
              <div className="bg-white rounded-xl border border-slate-200 p-8 mt-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-slate-900">Mekan Bilgisi</h2>
                  <Link
                    href="/mekanlar"
                    className="text-sm font-medium text-primary-600 hover:text-primary-700"
                  >
                    Tüm mekanlar →
                  </Link>
                </div>
                <div className="space-y-6">
                  {venue.seating_layout_description && (
                    <div>
                      <h3 className="font-semibold text-slate-800 mb-2">Oturma Düzeni</h3>
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
                        <h3 className="font-semibold text-slate-800 mb-1">Ulaşım</h3>
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
                        <h3 className="font-semibold text-slate-800 mb-2">Harita</h3>
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
                        <h3 className="font-semibold text-slate-800 mb-1">Giriş Bilgileri</h3>
                        <p className="text-slate-600">{venue.entrance_info}</p>
                      </div>
                    </div>
                  )}
                  {venue.rules && (
                    <div>
                      <h3 className="font-semibold text-slate-800 mb-1">Giriş Kuralları</h3>
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
                        Sıkça Sorulan Sorular
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
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Etkinlik Bilgileri</h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <Calendar className="h-5 w-5 text-blue-500 mt-0.5" />
                    <div>
                      <p className="font-medium text-slate-900">Tarih</p>
                      <p className="text-sm text-slate-600">
                        {new Date(event.date).toLocaleDateString('tr-TR', { 
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
                      <p className="font-medium text-slate-900">Saat</p>
                      <p className="text-sm text-slate-600">{event.time}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-blue-500 mt-0.5" />
                    <div>
                      <p className="font-medium text-slate-900">Mekan</p>
                      <p className="text-sm text-slate-600">{event.venue}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-blue-500 mt-0.5" />
                    <div>
                      <p className="font-medium text-slate-900">Konum</p>
                      <p className="text-sm text-slate-600">{event.location || event.venue}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <Users className="h-5 w-5 text-blue-500 mt-0.5" />
                    <div>
                      <p className="font-medium text-slate-900">Kategori</p>
                      <p className="text-sm text-slate-600">{event.category}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Güvenli Alışveriş */}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Güvenli Alışveriş</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                      <Star className="h-4 w-4 text-white" />
                    </div>
                    <span className="text-sm text-slate-700">100% Orijinal Bilet</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                      <Star className="h-4 w-4 text-white" />
                    </div>
                    <span className="text-sm text-slate-700">Güvenli Ödeme</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                      <Star className="h-4 w-4 text-white" />
                    </div>
                    <span className="text-sm text-slate-700">Anında Teslimat</span>
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
