"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase-client";
import Header from "@/components/Header";
import AmedSporStockDisplay from "@/components/AmedSporStockDisplay";
import type { Event, Ticket } from "@/types/database";
import type { Locale } from "@/lib/i18n-content";
import { Link } from "@/i18n/navigation";
import { formatPrice } from "@/lib/formatPrice";
import { formatEventDateDMY } from "@/lib/date-utils";
import { useCart } from "@/context/CartContext";
import { Music2 } from "lucide-react";

/**
 * Amed Spor form metinleri — 5 dilde (tr, de, en, ku, ckb).
 * `locale` prop'u ile seçilir; bilinmeyen değerde TR'ye düşer.
 */
const STRINGS: Record<string, Record<Locale, string>> = {
  fullNameRequired: {
    tr: "Ad Soyad zorunludur",
    de: "Vor- und Nachname sind erforderlich",
    en: "Full Name is required",
    ku: "Nav û paşnav pêdivî ye",
    ckb: "ناو و نازناو پێویستە",
  },
  emailRequired: {
    tr: "E-posta zorunludur",
    de: "E-Mail ist erforderlich",
    en: "Email is required",
    ku: "E-name pêdivî ye",
    ckb: "ئیمەیڵ پێویستە",
  },
  emailInvalid: {
    tr: "Geçerli e-posta adresi girin",
    de: "Geben Sie eine gültige E-Mail-Adresse ein",
    en: "Please enter a valid email",
    ku: "Ji kerema xwe e-nameyek derbasdar binivîse",
    ckb: "تکایە ئیمەیڵێکی دروست بنووسە",
  },
  phoneRequired: {
    tr: "Telefon numarası zorunludur",
    de: "Telefonnummer ist erforderlich",
    en: "Phone number is required",
    ku: "Hejmara telefonê pêdivî ye",
    ckb: "ژمارەی تەلەفۆن پێویستە",
  },
  langRequired: {
    tr: "Dil tercihi zorunludur",
    de: "Sprachpräferenz ist erforderlich",
    en: "Language preference is required",
    ku: "Vebijarka ziman pêdivî ye",
    ckb: "هەڵبژاردەی زمان پێویستە",
  },
  submitFailedError: {
    tr: "Form gönderilemedi",
    de: "Das Formular konnte nicht gesendet werden",
    en: "Form submit failed",
    ku: "Form nehat şandin",
    ckb: "فۆرمەکە نەنێردرا",
  },
  submitError: {
    tr: "Form gönderilemedi: {msg}. Lütfen tekrar deneyin.",
    de: "Das Formular konnte nicht gesendet werden: {msg}. Bitte versuchen Sie es erneut.",
    en: "Failed to submit form: {msg}. Please try again.",
    ku: "Form nehat şandin: {msg}. Ji kerema xwe cardin biceribîne.",
    ckb: "فۆرمەکە نەنێردرا: {msg}. تکایە دووبارە هەوڵبدەوە.",
  },
  serverTimeout: {
    tr: "Sunucu yanıt vermedi, lütfen tekrar deneyin",
    de: "Der Server hat nicht geantwortet. Bitte versuchen Sie es erneut.",
    en: "The server did not respond. Please try again.",
    ku: "Server bersiv neda, ji kerema xwe cardin biceribîne",
    ckb: "سێرڤەر وەڵامی نەدا، تکایە دووبارە هەوڵبدەوە",
  },
  serverConnError: {
    tr: "Sunucuya bağlanılamadı. İnternet bağlantınızı kontrol edin ve tekrar deneyin.",
    de: "Verbindung zum Server fehlgeschlagen. Bitte prüfen Sie Ihre Internetverbindung und versuchen Sie es erneut.",
    en: "Could not reach the server. Please check your connection and try again.",
    ku: "Nikarîbû girêdana bi serverê. Ji kerema xwe tora xwe kontrol bike û cardin biceribîne.",
    ckb: "پەیوەندی بە سێرڤەرەوە نەبوو. تکایە ئینتەرنێتەکەت بپشکنە و دووبارە هەوڵبدەوە.",
  },
  formSubmittedTitle: {
    tr: "Form Gönderildi",
    de: "Formular gesendet",
    en: "Form Submitted",
    ku: "Form hat şandin",
    ckb: "فۆرم نێردرا",
  },
  redirectingPayment: {
    tr: "Formunuz kaydedildi. Ödeme için sepete yönlendiriliyorsunuz...",
    de: "Ihr Formular wurde gespeichert. Sie werden zur Zahlung (Warenkorb) weitergeleitet...",
    en: "Your form was saved. Redirecting to the cart for payment...",
    ku: "Forma we hat tomarkirin. Ji bo dayînê tê rêvebirina we ber bi selikê...",
    ckb: "فۆرمەکەت پاشەکەوت کرا. بۆ پارەدان دەڕوانرێیت بۆ سەبەتەکە...",
  },
  completedThankyou: {
    tr: "Formunuz başarıyla tamamlandı. Teşekkürler.",
    de: "Ihr Formular wurde erfolgreich abgeschlossen. Vielen Dank.",
    en: "Your form has been completed successfully. Thank you.",
    ku: "Forma we bi serketî temam bû. Spas.",
    ckb: "فۆرمەکەت بە سەرکەوتوویی تەواو بوو. سوپاس.",
  },
  goToCart: {
    tr: "Sepete Git",
    de: "Zum Warenkorb",
    en: "Go to Cart",
    ku: "Biçe Selikê",
    ckb: "بڕۆ بۆ سەبەتە",
  },
  backToEvent: {
    tr: "Etkinliğe Dön",
    de: "Zurück zur Veranstaltung",
    en: "Back to Event",
    ku: "Vegere çalakiyê",
    ckb: "بگەڕێوە بۆ چالاکییەکە",
  },
  // Form alanları ve sidebar metinleri
  pleaseFillForm: {
    tr: "Lütfen formu doldurun",
    de: "Bitte füllen Sie das Formular aus",
    en: "Please fill out the form",
    ku: "Ji kerema xwe formê tijî bike",
    ckb: "تکایە فۆرمەکە پڕبکەرەوە",
  },
  formFirstNotice: {
    tr: "Önce bu formu tamamlayın. Bilet fiyatı tanımlıysa ardından ödeme (sepet) adımına geçersiniz.",
    de: "Bitte vervollständigen Sie zuerst dieses Formular. Wenn ein Ticketpreis festgelegt ist, gelangen Sie anschließend zur Zahlung (Warenkorb).",
    en: "Please complete this form first. If a ticket price is set, you will continue to payment (cart).",
    ku: "Ji kerema xwe pêşî vê formê temam bike. Ger bihayê bilêtê hatibe danîn, piştre derbasê gava dayînê (selik) dibî.",
    ckb: "تکایە یەکەم جار ئەم فۆرمە تەواو بکە. ئەگەر نرخی بلیت دیاری کرابێت، دواتر دەچیتە قۆناغی پارەدان (سەبەتە).",
  },
  peopleTicketCount: {
    tr: "Kişi / Bilet Sayısı",
    de: "Anzahl der Personen / Tickets",
    en: "Number of People / Tickets",
    ku: "Hejmara Kes / Bilêtan",
    ckb: "ژمارەی کەس / بلیت",
  },
  personInfo: {
    tr: "{n}. Kişi Bilgileri",
    de: "Person {n} Informationen",
    en: "Person {n} Information",
    ku: "Agahiyên Kes {n}",
    ckb: "زانیاری کەس {n}",
  },
  fullName: {
    tr: "Ad Soyad *",
    de: "Vor- und Nachname *",
    en: "Full Name *",
    ku: "Nav û Paşnav *",
    ckb: "ناو و نازناو *",
  },
  email: {
    tr: "E-posta *",
    de: "E-Mail *",
    en: "Email *",
    ku: "E-name *",
    ckb: "ئیمەیڵ *",
  },
  phone: {
    tr: "Telefon *",
    de: "Telefon *",
    en: "Phone *",
    ku: "Telefon *",
    ckb: "تەلەفۆن *",
  },
  organization: {
    tr: "Kuruluş (Opsiyonel)",
    de: "Organisation (optional)",
    en: "Organization (Optional)",
    ku: "Rêxistin (Vebijarkî)",
    ckb: "ڕێکخراو (بژاردەیی)",
  },
  organizationPlaceholder: {
    tr: "Varsa kuruluş adı",
    de: "Name der Organisation, falls vorhanden",
    en: "Organization name if applicable",
    ku: "Navê rêxistinê heger hebe",
    ckb: "ناوی ڕێکخراو ئەگەر هەیە",
  },
  langContactTitle: {
    tr: "Dil ve İletişim Tercihi",
    de: "Sprach- und Kontaktpräferenz",
    en: "Language & Contact Preference",
    ku: "Ziman û Vebijarka Têkiliyê",
    ckb: "زمان و هەڵبژاردەی پەیوەندی",
  },
  phoneCallLanguage: {
    tr: "Telefon görüşmesi dili *",
    de: "Sprache für Telefonkontakt *",
    en: "Phone call language *",
    ku: "Zimanê têlefonê *",
    ckb: "زمانی پەیوەندی تەلەفۆنی *",
  },
  acceptPhoneContact: {
    tr: "Etkinlik rezervasyonu için aranmayı kabul ediyorum.",
    de: "Ich akzeptiere, für die Veranstaltungsreservierung angerufen zu werden.",
    en: "I accept to be called for event reservation.",
    ku: "Ez qebûl dikim ji bo veqetandina çalakiyê bêm telefonkirin.",
    ckb: "قبوڵ دەکەم بۆ ئاگربەندی چالاکییەکە پەیوەندیم پێوە بکرێت.",
  },
  additionalNotes: {
    tr: "Ek Notlar (Opsiyonel)",
    de: "Zusätzliche Notizen (optional)",
    en: "Additional Notes (Optional)",
    ku: "Nîşanên Zêde (Vebijarkî)",
    ckb: "تێبینیی زیادە (بژاردەیی)",
  },
  additionalNotesPlaceholder: {
    tr: "Ek bilgileriniz varsa buraya yazabilirsiniz",
    de: "Falls Sie zusätzliche Informationen haben, schreiben Sie diese hier",
    en: "If you have additional information, please write here",
    ku: "Heger agahiyên zêde hebin, li vir binivîse",
    ckb: "ئەگەر زانیاریی زیادت هەیە، لێرە بنووسە",
  },
  submitting: {
    tr: "Gönderiliyor...",
    de: "Wird gesendet...",
    en: "Submitting...",
    ku: "Tê şandin...",
    ckb: "دەنێردرێت...",
  },
  submitForm: {
    tr: "Formu Gönder",
    de: "Formular senden",
    en: "Submit Form",
    ku: "Formê Bişîne",
    ckb: "فۆرم بنێرە",
  },
  amedEvents: {
    tr: "Amedspor Etkinlikleri",
    de: "Amedspor Veranstaltungen",
    en: "Amedspor Events",
    ku: "Çalakiyên Amedspor",
    ckb: "چالاکییەکانی ئامەدسپۆر",
  },
  noAmedEvents: {
    tr: "Amedspor etkinliği bulunamadı",
    de: "Keine Amedspor-Veranstaltungen gefunden",
    en: "No Amedspor events found",
    ku: "Çalakiyên Amedspor nehatin dîtin",
    ckb: "چالاکیی ئامەدسپۆر نەدۆزرایەوە",
  },
  free: {
    tr: "Ücretsiz",
    de: "Kostenlos",
    en: "Free",
    ku: "Belaş",
    ckb: "بەخۆڕایی",
  },
  // Banner
  amedBannerBadge: {
    tr: "AMED SPOR — Resmi Kayıt",
    de: "AMED SPOR — Offizielle Anmeldung",
    en: "AMED SPOR — Official Registration",
    ku: "AMED SPOR — Tomarkirina Fermî",
    ckb: "ئامەدسپۆر — تۆمارکردنی فەرمی",
  },
  amedBannerTagline: {
    tr: "Formu doldurun, biletinizi alın, yerinizi ayırtın.",
    de: "Formular ausfüllen, Ticket sichern, Platz reservieren.",
    en: "Fill the form, get your ticket, reserve your seat.",
    ku: "Formê tijî bike, bilêta xwe bigire, cihê xwe vegire.",
    ckb: "فۆرم پڕبکەرەوە، بلیتەکەت بەدەستبهێنە، شوێنی خۆت زەمینە بکە.",
  },
};

interface AmedSporFormClientProps {
  event: Event;
  locale: string;
  localized: { title?: string };
  tickets: Ticket[];
}

interface Attendee {
  full_name: string;
  email: string;
  phone: string;
}

export default function AmedSporFormClient({
  event,
  locale,
  localized,
}: AmedSporFormClientProps) {
  const [ticketCount, setTicketCount] = useState<number>(1);
  const [attendees, setAttendees] = useState<Attendee[]>([
    { full_name: "", email: "", phone: "" },
  ]);

  const [formData, setFormData] = useState({
    organization: "",
    language_preference: "türkçe",
    accept_phone_contact: true,
    additional_notes: "",
  });

  const { addItemsBatch } = useCart();

  /** 5 dilde form metni seçer; desteklenmeyen locale'de TR fallback. */
  const t = (key: string): string => {
    const entry = STRINGS[key];
    if (!entry) return key;
    const row = (locale as Locale) in entry ? entry[locale as Locale] : null;
    return row ?? entry.tr;
  };

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [requiresPayment, setRequiresPayment] = useState(false);
  const [amedSporEvents, setAmedSporEvents] = useState<Event[]>([]);

  useEffect(() => {
    async function fetchAmedSporEvents() {
      try {
        const { data, error } = await supabase
          .from("events")
          .select("*")
          .eq("is_active", true)
          .eq("is_approved", true)
          .eq("is_draft", false)
          .ilike("title", "%amed%")
          .not("title", "ilike", "%koma%")
          .order("date", { ascending: true })
          .limit(5);

        if (error) {
          console.error("Amedspor etkinlikleri çekme hatası:", error);
          return;
        }

        setAmedSporEvents((data || []) as Event[]);
      } catch (err) {
        console.error("Amedspor etkinlikleri hatası:", err);
      }
    }

    fetchAmedSporEvents();
  }, []);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    attendees.forEach((attendee, index) => {
      if (!attendee.full_name.trim()) {
        newErrors[`full_name_${index}`] = t("fullNameRequired");
      }

      if (!attendee.email.trim()) {
        newErrors[`email_${index}`] = t("emailRequired");
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(attendee.email)) {
        newErrors[`email_${index}`] = t("emailInvalid");
      }

      if (!attendee.phone.trim()) {
        newErrors[`phone_${index}`] = t("phoneRequired");
      }
    });

    if (!formData.language_preference) {
      newErrors.language_preference = t("langRequired");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    // 25 sn içinde yanıt gelmezse isteği iptal ederek "Failed to fetch" yerine
    // net bir hata göster (sunucunun yanıtlanmaması durumuna karşı koruma).
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 25_000);

    try {
      let res: Response;
      try {
        res = await fetch("/api/amed-spor-form", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            eventId: event.id,
            ticketCount,
            attendees,
            organization: formData.organization || null,
            language_preference: formData.language_preference,
            accept_phone_contact: formData.accept_phone_contact,
            additional_notes: formData.additional_notes || null,
          }),
        });
      } catch (fetchError) {
        // Ağ bağlantı hatası (sunucuya ulaşılamadı / istek zaman aşımına uğradı)
        const aborted = fetchError instanceof DOMException && fetchError.name === "AbortError";
        throw new Error(aborted ? t("serverTimeout") : t("serverConnError"));
      }

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        throw new Error(data?.message || t("submitFailedError"));
      }

      const paid = Boolean(data.requiresPayment);
      setRequiresPayment(paid);

      try {
        localStorage.setItem(
          "amedSporFormData",
          JSON.stringify({
            eventId: event.id,
            formData: { ...formData, attendees },
            submittedAt: new Date().toISOString(),
            requiresPayment: paid,
            // Sepete yeniden ekleme için gerekli bilet + adet bilgisi.
            // `ticketCount` formda tahsil edilen kişi sayısıdır; rezervasyon süresi
            // dolup sepet boşalsa bile "Sepete Git" bu adet kadar bilet ekler.
            ticket: paid && data.ticket?.id
              ? {
                  ticketId: data.ticket.id,
                  quantity: ticketCount,
                  ticketName: data.ticket.name,
                  price: Number(data.ticket.price || 0),
                  currency: data.event?.currency || event.currency || "EUR",
                  available: Number(data.ticket.available ?? data.ticket.quantity ?? 0),
                  eventTitle: data.event?.title || event.title,
                  eventDate: String(data.event?.date || event.date),
                  eventTime: String(data.event?.time || event.time || "00:00"),
                  venue: String(data.event?.venue || event.venue || "Amedspor"),
                  location: String(data.event?.location || event.location || ""),
                }
              : null,
          })
        );
      } catch (storageError) {
        console.warn("LocalStorage kaydetme hatası:", storageError);
      }

      if (paid && data.ticket?.id) {
        addItemsBatch([
          {
            ticketId: data.ticket.id,
            eventId: event.id,
            eventTitle: data.event?.title || event.title,
            eventDate: String(data.event?.date || event.date),
            eventTime: String(data.event?.time || event.time || "00:00"),
            venue: String(data.event?.venue || event.venue || "Amedspor"),
            location: String(data.event?.location || event.location || ""),
            ticketName: data.ticket.name,
            price: Number(data.ticket.price || 0),
            currency: data.event?.currency || event.currency || "EUR",
            quantity: ticketCount,
            available: Number(data.ticket.available ?? data.ticket.quantity ?? 0),
          },
        ]);
      }

      setSubmitted(true);

      if (paid) {
        setTimeout(() => {
          window.location.href = `/${locale}/sepet`;
        }, 1200);
      }
    } catch (error) {
      console.error("Form gönderme hatası:", error);
      const errorMessage = error instanceof Error ? error.message : "Bilinmeyen hata";
      setErrors({
        submit: t("submitError").replace("{msg}", errorMessage),
      });
    } finally {
      window.clearTimeout(timeoutId);
      setIsSubmitting(false);
    }
  };

  const handleChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleAttendeeChange = (index: number, field: keyof Attendee, value: string) => {
    setAttendees((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });

    if (errors[`${field}_${index}`]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[`${field}_${index}`];
        return next;
      });
    }
  };

  const handleTicketCountChange = (count: number) => {
    setTicketCount(count);
    setAttendees((prev) => {
      const next = [...prev];
      if (count > prev.length) {
        for (let i = prev.length; i < count; i++) {
          next.push({ full_name: "", email: "", phone: "" });
        }
      } else if (count < prev.length) {
        next.splice(count);
      }
      return next;
    });
  };

  const amedBanner = (
    <div className="bg-gradient-to-r from-green-800 via-green-700 to-green-800 text-white">
      <div className="max-w-7xl mx-auto px-6 py-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/amedspor-logo.png"
            alt="Amed Spor"
            className="h-20 w-20 object-contain bg-white rounded-full p-2 shrink-0 shadow"
          />
          <div>
            <div className="text-xs uppercase tracking-wider font-bold text-yellow-300">
              {t("amedBannerBadge")}
            </div>
            <div className="text-xl font-bold leading-tight">{localized.title}</div>
          </div>
        </div>
        <div className="text-sm text-green-100 sm:max-w-xs">
          <span className="mr-2 inline-block h-2 w-2 rounded-full bg-red-500 align-middle" />
          {t("amedBannerTagline")}
        </div>
      </div>
    </div>
  );

  const eventsSidebar = (
    <div className="lg:col-span-1">
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-bold mb-4">{t("amedEvents")}</h3>
        <div className="space-y-4">
          {amedSporEvents.length > 0 ? (
            amedSporEvents.map((amedEvent) => (
              <Link
                key={amedEvent.id}
                href={`/etkinlik/${amedEvent.id}`}
                className="block border border-slate-200 rounded-xl overflow-hidden hover:border-primary-500 hover:shadow-md transition-all bg-white group"
              >
                <div className="aspect-video bg-gradient-to-br from-primary-100 to-primary-50 flex items-center justify-center overflow-hidden">
                  {amedEvent.image_url ? (
                    <img
                      src={amedEvent.image_url}
                      alt={amedEvent.title}
                      className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                      onError={(e) => {
                        if (e.currentTarget.dataset.fallbackApplied === "1") return;
                        e.currentTarget.dataset.fallbackApplied = "1";
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  ) : (
                    <Music2 className="h-12 w-12 text-primary-400" />
                  )}
                </div>
                <div className="p-4">
                  <h4 className="font-semibold text-sm mb-2 line-clamp-2 group-hover:text-primary-700">
                    {amedEvent.title}
                  </h4>
                  <div className="text-xs text-slate-600 mb-2">
                    {formatEventDateDMY(amedEvent.date)}
                  </div>
                  {Number(amedEvent.price_from) > 0 && (
                    <div className="text-sm font-bold text-primary-600">
                      {formatPrice(Number(amedEvent.price_from), amedEvent.currency)}
                    </div>
                  )}
                </div>
              </Link>
            ))
          ) : (
            <p className="text-sm text-slate-500">{t("noAmedEvents")}</p>
          )}
        </div>
      </div>
    </div>
  );

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        {amedBanner}
        <div className="p-8">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                <div className="bg-white rounded-lg shadow p-8">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">{t("formSubmittedTitle")}</h1>
                    <p className="text-gray-600 mb-4">
                      {requiresPayment ? t("redirectingPayment") : t("completedThankyou")}
                    </p>
                    {requiresPayment ? (
                      <button
                        type="button"
                        onClick={() => {
                          window.location.href = `/${locale}/sepet`;
                        }}
                        className="mt-4 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                      >
                        {t("goToCart")}
                      </button>
                    ) : (
                      <Link
                        href={`/etkinlik/${event.id}`}
                        className="inline-block mt-4 px-6 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors"
                      >
                        {t("backToEvent")}
                      </Link>
                    )}
                  </div>
                </div>
              </div>
              {eventsSidebar}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      {amedBanner}
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg shadow p-8">
                <h1 className="text-2xl font-bold mb-2">{localized.title}</h1>
                <p className="text-gray-600 mb-4">{t("pleaseFillForm")}</p>

                {event.max_tickets ? (
                  <div className="mb-6">
                    <AmedSporStockDisplay eventId={event.id} locale={locale} />
                  </div>
                ) : null}

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-4 mb-6">
                    <h3 className="font-semibold text-lg">{t("peopleTicketCount")}</h3>
                    <select
                      value={ticketCount}
                      onChange={(e) => handleTicketCountChange(Number(e.target.value))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value={1}>1</option>
                      <option value={2}>2</option>
                      <option value={3}>3</option>
                    </select>
                  </div>

                  <div className="space-y-6">
                    {attendees.map((attendee, index) => (
                      <div
                        key={index}
                        className="p-4 border border-gray-200 rounded-lg bg-gray-50/50 space-y-4"
                      >
                        <h3 className="font-semibold text-lg">
                          {t("personInfo").replace("{n}", String(index + 1))}
                        </h3>

                        <div>
                          <label className="block text-sm font-medium mb-2">
                            {t("fullName")}
                          </label>
                          <input
                            type="text"
                            value={attendee.full_name}
                            onChange={(e) =>
                              handleAttendeeChange(index, "full_name", e.target.value)
                            }
                            className={`w-full px-4 py-2 border rounded-lg ${
                              errors[`full_name_${index}`] ? "border-red-500" : "border-gray-300"
                            }`}
                            required
                          />
                          {errors[`full_name_${index}`] ? (
                            <p className="text-red-500 text-sm mt-1">{errors[`full_name_${index}`]}</p>
                          ) : null}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium mb-2">
                              {t("email")}
                            </label>
                            <input
                              type="email"
                              value={attendee.email}
                              onChange={(e) =>
                                handleAttendeeChange(index, "email", e.target.value)
                              }
                              className={`w-full px-4 py-2 border rounded-lg ${
                                errors[`email_${index}`] ? "border-red-500" : "border-gray-300"
                              }`}
                              required
                            />
                            {errors[`email_${index}`] ? (
                              <p className="text-red-500 text-sm mt-1">{errors[`email_${index}`]}</p>
                            ) : null}
                          </div>

                          <div>
                            <label className="block text-sm font-medium mb-2">
                              {t("phone")}
                            </label>
                            <input
                              type="tel"
                              value={attendee.phone}
                              onChange={(e) =>
                                handleAttendeeChange(index, "phone", e.target.value)
                              }
                              className={`w-full px-4 py-2 border rounded-lg ${
                                errors[`phone_${index}`] ? "border-red-500" : "border-gray-300"
                              }`}
                              required
                            />
                            {errors[`phone_${index}`] ? (
                              <p className="text-red-500 text-sm mt-1">{errors[`phone_${index}`]}</p>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      {t("organization")}
                    </label>
                    <input
                      type="text"
                      value={formData.organization}
                      onChange={(e) => handleChange("organization", e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      placeholder={t("organizationPlaceholder")}
                    />
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg">{t("langContactTitle")}</h3>

                    <div>
                      <label className="block text-sm font-medium mb-2">
                        {t("phoneCallLanguage")}
                      </label>
                      <select
                        value={formData.language_preference}
                        onChange={(e) => handleChange("language_preference", e.target.value)}
                        className={`w-full px-4 py-2 border rounded-lg ${
                          errors.language_preference ? "border-red-500" : "border-gray-300"
                        }`}
                        required
                      >
                        <option value="kurmanci">Kurmanci</option>
                        <option value="türkçe">Türkçe</option>
                        <option value="ingilizce">İngilizce</option>
                        <option value="deutsch">Deutsch</option>
                      </select>
                      {errors.language_preference ? (
                        <p className="text-red-500 text-sm mt-1">{errors.language_preference}</p>
                      ) : null}
                    </div>

                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="accept_phone_contact"
                        checked={formData.accept_phone_contact}
                        onChange={(e) => handleChange("accept_phone_contact", e.target.checked)}
                        className="w-4 h-4"
                      />
                      <label htmlFor="accept_phone_contact" className="text-sm">
                        {t("acceptPhoneContact")}
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      {t("additionalNotes")}
                    </label>
                    <textarea
                      value={formData.additional_notes}
                      onChange={(e) => handleChange("additional_notes", e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      rows={3}
                      placeholder={t("additionalNotesPlaceholder")}
                    />
                  </div>

                  {errors.submit ? (
                    <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-lg">
                      {errors.submit}
                    </div>
                  ) : null}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? t("submitting") : t("submitForm")}
                  </button>
                </form>
              </div>
            </div>

            {eventsSidebar}
          </div>
        </div>
      </div>
    </div>
  );
}
