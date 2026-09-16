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
import CoverImage from "@/components/CoverImage";

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
  idCountry: {
    tr: "Hangi ülkenin kimliğini / pasaportunu taşıyorsunuz? *",
    de: "Welche Staatsangehörigkeit / welchen Ausweis besitzen Sie? *",
    en: "Which country's ID / passport do you hold? *",
    ku: "Hûn nasnameya / pasaporta kîjan welatî hildigirin? *",
    ckb: "ناسنامەی / پاسپۆرتی کام وڵاتت پێیە؟ *",
  },
  idCountryPlaceholder: {
    tr: "Örn. Türkiye, Almanya, İsviçre...",
    de: "z. B. Deutschland, Türkei, Schweiz...",
    en: "e.g. Turkey, Germany, Switzerland...",
    ku: "B.m. Tirkiye, Almanya, Swîsre...",
    ckb: "بۆ نموونە تورکیا، ئەڵمانیا، سویسرا...",
  },
  idCountryRequired: {
    tr: "Kimlik / pasaport ülkesi zorunludur",
    de: "Ausweis- / Passland ist erforderlich",
    en: "ID / passport country is required",
    ku: "Welatê nasnameyê / pasaportê pêdivî ye",
    ckb: "وڵاتی ناسنامە / پاسپۆرت پێویستە",
  },
  idCountrySelect: {
    tr: "Ülke seçiniz",
    de: "Land wählen",
    en: "Select country",
    ku: "Welat hilbijêre",
    ckb: "وڵات هەڵبژێرە",
  },
  idCountryOther: {
    tr: "Diğer (Listede yok)",
    de: "Anderes (nicht in der Liste)",
    en: "Other (not in list)",
    ku: "Din (di lîsteyê de tune)",
    ckb: "هیتر (لە لیستەکەدا نییە)",
  },
  idCountryOtherPlaceholder: {
    tr: "Ülke adını yazınız",
    de: "Ländernamen eingeben",
    en: "Enter the country name",
    ku: "Navê welat binivîse",
    ckb: "ناوی وڵات بنووسە",
  },
  passoNumber: {
    tr: "Passo Numarası *",
    de: "Passo-Nummer *",
    en: "Passo Number *",
    ku: "Hejmara Passo *",
    ckb: "ژمارەی پاسۆ *",
  },
  passoNumberPlaceholder: {
    tr: "Passo Kart No veya Passo kayıtlı TC / Pasaport No",
    de: "Passo-Kartennr. oder registrierte Pass-/ID-Nr.",
    en: "Passo Card No or registered ID / Passport No",
    ku: "Hejmara qerta Passo an nasnameya qeydkirî",
    ckb: "ژمارەی کارتی پاسۆ یان ناسنامەی تۆمارکراو",
  },
  passoNumberRequired: {
    tr: "Passo numarası zorunludur",
    de: "Passo-Nummer ist erforderlich",
    en: "Passo number is required",
    ku: "Hejmara Passo pêdivî ye",
    ckb: "ژمارەی پاسۆ پێویستە",
  },
  passoNumberHelp: {
    tr: "Maç biletinizin Passo hesabınıza aktarılması için lütfen Passo kart numaranızı veya Passo hesabınıza kayıtlı TC / Pasaport numaranızı yazınız.",
    de: "Bitte geben Sie Ihre Passo-Kartennummer oder die in Ihrem Passo-Konto registrierte Ausweisnummer ein.",
    en: "Please enter your Passo card number or the ID / Passport number registered to your Passo account.",
    ku: "Ji bo ku bilêta maçê derbasî hesabê we yê Passo bibe, ji kerema xwe hejmara qerta xwe ya Passo an hejmara nasnameya qeydkirî binivîsin.",
    ckb: "تکایە ژمارەی کارتی پاسۆکەت یان ئەو ناسنامەیەی لەسەر پاسۆ تۆمارکراوە بنووسە بۆ ئەوەی بلیتەکەت بخرێتە سەری.",
  },
  seatingAreaTitle: {
    tr: "Tribün & Maç İzleme Alanı Tercihi *",
    de: "Tribünen- & Sitzplatzpräferenz *",
    en: "Tribune & Seating Preference *",
    ku: "Vebijarka Cihê Temaşekirinê *",
    ckb: "هەڵبژاردەی شوێنی بینینی یاری *",
  },
  seatingAreaDesc: {
    tr: "Maçı takip etmek istediğiniz ayrıcalıklı alanı seçiniz.",
    de: "Wählen Sie Ihren bevorzugten Zuschauerbereich aus.",
    en: "Please select your preferred exclusive viewing area for the match.",
    ku: "Ji kerema xwe qada taybet a ku hûn dixwazin lê temaşe bikin hilbijêrin.",
    ckb: "تکایە ئەو شوێنە تایبەتە هەڵبژێرە کە دەتەوێت یارییەکەی لێوە ببینیت.",
  },
  seatingVip: {
    tr: "VIP Tribünü (Protokol & Özel VIP Alanı)",
    de: "VIP-Tribüne (Protokoll & VIP-Bereich)",
    en: "VIP Tribune (Protocol & VIP Area)",
    ku: "Tribûna VIP (Protokol & Qada Taybet a VIP)",
    ckb: "تریبۆنی VIP (پڕۆتۆکۆڵ و شوێنی تایبەتی VIP)",
  },
  seatingLoca: {
    tr: "Özel Loca (VIP Lounge / Loca Alanı)",
    de: "Private Loge (VIP-Lounge & Logenbereich)",
    en: "Private Box (VIP Lounge & Box Area)",
    ku: "Loja Taybet (VIP Lounge / Qada Lojê)",
    ckb: "لۆژی تایبەت (VIP Lounge / شوێنی لۆژ)",
  },
  additionalServicesTitle: {
    tr: "Ek Hizmet Seçenekleri",
    de: "Zusätzliche Optionen",
    en: "Additional Options",
    ku: "Vebijarkên Zêde yên Xizmetê",
    ckb: "بژاردەی خزمەتگوزارییە زیادەکان",
  },
  includeAccommodation: {
    tr: "Konaklama Dahil Edilsin (+{price} / kişi başı)",
    de: "Unterkunft hinzufügen (+{price} / pro Person)",
    en: "Include Accommodation (+{price} / per person)",
    ku: "Cihê mayînê lê zêde bike (+{price} / ji bo her kesî)",
    ckb: "شوێنی مانەوە زیاد بکرێت (+{price} / بۆ هەر کەسێک)",
  },
  includeFlight: {
    tr: "Gidiş-Dönüş Uçak Bileti Dahil Edilsin (+{price} / kişi başı)",
    de: "Flugticket hinzufügen (+{price} / pro Person)",
    en: "Include Flight Ticket (+{price} / per person)",
    ku: "Bilêta balafirê lê zêde bike (+{price} / ji bo her kesî)",
    ckb: "بلیتی فڕۆکە زیاد بکرێت (+{price} / بۆ هەر کەسێک)",
  },
  orderSummaryTitle: {
    tr: "Fiyat & Tutar Özeti",
    de: "Preis- & Bestellübersicht",
    en: "Price & Order Summary",
    ku: "Kurteya Buhayê",
    ckb: "کورتەی نرخ و داواکاری",
  },
  matchTicket: {
    tr: "Maç Bileti",
    de: "Spielticket",
    en: "Match Ticket",
    ku: "Bilêta Maçê",
    ckb: "بلیتی یاری",
  },
  accommodationService: {
    tr: "Konaklama",
    de: "Unterkunft",
    en: "Accommodation",
    ku: "Cihê mayînê",
    ckb: "شوێنی مانەوە",
  },
  flightService: {
    tr: "Uçak Bileti",
    de: "Flugticket",
    en: "Flight Ticket",
    ku: "Bilêta Balafirê",
    ckb: "بلیتی فڕۆکە",
  },
  totalAmount: {
    tr: "Toplam Tutar",
    de: "Gesamtbetrag",
    en: "Total Amount",
    ku: "Buhayê Giştî",
    ckb: "کۆی گشتی",
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
    tr: "Sepete eklendi. Ödemeyi tamamladığınızda formunuz kaydedilecek...",
    de: "In den Warenkorb gelegt. Nach Abschluss der Zahlung wird Ihr Formular gespeichert...",
    en: "Added to cart. Your form will be saved after payment is completed...",
    ku: "Têxe selikê. Piştî temamkirina dayînê forma we dê were tomarkirin...",
    ckb: "خرا ناو سەبەتە. دوای تەواوکردنی پارەدان فۆرمەکەت پاشەکەوت دەکرێت...",
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
  fullNameWarning: {
    tr: "Ad ve soyad bilgileriniz uçuş işlemlerinde ve Amedspor Passo biletlerinin alımında kullanılacağı için lütfen kimliğinizde yazıldığı gibi yazınız.",
    de: "Ihr Vor- und Nachname wird für Flugbuchungen und den Kauf von Amedspor-Passo-Tickets verwendet. Bitte geben Sie ihn genau so ein, wie er in Ihrem Ausweis steht.",
    en: "Your first and last name will be used for flight procedures and Amedspor Passo ticket purchases. Please write them exactly as shown on your ID.",
    ku: "Nav û paşnavê we dê di pêvajoyên firînê û kirîna bilêtên Amedspor Passo de were bikaranîn. Ji kerema xwe tam wekî di nasnameya we de hatiye nivîsandin binivîsin.",
    ckb: "ناو و نازناوی ئێوە لە کاروباری فڕین و کڕینی بلیتی ئامەدسپۆر پاسۆدا بەکار دەهێنرێت. تکایە هەر وەک لە ناسنامەکەتاندا نووسراوە بینووسن.",
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
  accommodation: {
    tr: "Konaklama tercihi",
    de: "Unterkunftswunsch",
    en: "Accommodation preference",
    ku: "Hilbijartina cîhê mayînê",
    ckb: "هەڵبژاردەی جێی مانەوە",
  },
  accommodationHotel: {
    tr: "Otel",
    de: "Hotel",
    en: "Hotel",
    ku: "Otel",
    ckb: "هۆتێل",
  },
  accommodationOther: {
    tr: "Diğer",
    de: "Andere",
    en: "Other",
    ku: "Yên din",
    ckb: "هی تر",
  },
  accommodationOwn: {
    tr: "Kendi imkânlarım",
    de: "Eigene Unterkunft",
    en: "My own accommodation",
    ku: "Cîhê xwe",
    ckb: "جێی مانەوەی خۆم",
  },
  meal: {
    tr: "Yemek tercihi",
    de: "Essenspräferenz",
    en: "Meal preference",
    ku: "Hilbijartina xwarinê",
    ckb: "هەڵبژاردەی خواردن",
  },
  mealNone: {
    tr: "Yok",
    de: "Keine",
    en: "None",
    ku: "Tune",
    ckb: "نییە",
  },
  mealVegetarian: {
    tr: "Vejetaryen",
    de: "Vegetarisch",
    en: "Vegetarian",
    ku: "Vegetarî",
    ckb: "ڕووەکخۆر",
  },
  mealVegan: {
    tr: "Vegan",
    de: "Vegan",
    en: "Vegan",
    ku: "Vegan",
    ckb: "ڤیگان",
  },
  mealHalal: {
    tr: "Helal",
    de: "Halal",
    en: "Halal",
    ku: "Helal",
    ckb: "حەلال",
  },
  mealGlutenFree: {
    tr: "Glutensiz",
    de: "Glutenfrei",
    en: "Gluten-free",
    ku: "Bê gluten",
    ckb: "بێ گلوتین",
  },
  mealOther: {
    tr: "Diğer",
    de: "Andere",
    en: "Other",
    ku: "Yên din",
    ckb: "هی تر",
  },
  mealOtherPlaceholder: {
    tr: "Yemek tercihinizi yazın",
    de: "Bitte beschreiben Sie Ihre Präferenz",
    en: "Describe your meal preference",
    ku: "Hilbijartina xwe binivîse",
    ckb: "هەڵبژاردەی خواردنەکەت بنووسە",
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
  addToCart: {
    tr: "Sepete Ekle",
    de: "In den Warenkorb",
    en: "Add to Cart",
    ku: "Têxe Selikê",
    ckb: "زیاد بکە بۆ سەبەتە",
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

const COUNTRIES = [
  "Türkiye",
  "Almanya (Deutschland)",
  "İsviçre (Schweiz)",
  "Avusturya (Österreich)",
  "Hollanda (Nederland)",
  "Fransa (France)",
  "Belçika (België)",
  "İsveç (Sverige)",
  "İngiltere (United Kingdom)",
  "Danimarka (Danmark)",
  "Norveç (Norge)",
  "Irak (Iraq)",
];

interface Attendee {
  full_name: string;
  email: string;
  phone: string;
  id_country: string;
  passo_number: string;
}

export default function AmedSporFormClient({
  event,
  locale,
  localized,
}: AmedSporFormClientProps) {
  const maxAttendees = Math.max(1, Math.min(10, event.custom_form_max_attendees || 3));
  const hasAnyPrice =
    Number(event.price_from) > 0 ||
    Number(event.accommodation_price) > 0 ||
    Number(event.flight_price) > 0;
  const [ticketCount, setTicketCount] = useState<number>(1);
  const [attendees, setAttendees] = useState<Attendee[]>([
    { full_name: "", email: "", phone: "", id_country: "", passo_number: "" },
  ]);

  const [seatingPreference, setSeatingPreference] = useState<"vip" | "loca">("vip");
  const [hasAccommodation, setHasAccommodation] = useState(false);
  const [hasFlight, setHasFlight] = useState(false);
  /** "Diğer" seçilen katılımcı indeksleri (kimlik ülkesi listesinde olmayanlar için serbest giriş) */
  const [countryOther, setCountryOther] = useState<Set<number>>(new Set());

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
        // Geçmiş etkinlikleri listeleme: ana sayfa /api/events ile aynı davranış.
        const today = new Date().toISOString().slice(0, 10);
        const { data, error } = await supabase
          .from("events")
          .select("*")
          .eq("is_active", true)
          .eq("is_approved", true)
          .eq("is_draft", false)
          .gte("date", today)
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

      if (!attendee.id_country.trim()) {
        newErrors[`id_country_${index}`] = t("idCountryRequired");
      }

      if (!attendee.passo_number.trim()) {
        newErrors[`passo_number_${index}`] = t("passoNumberRequired");
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
            seating_preference: seatingPreference,
            has_accommodation: hasAccommodation,
            has_flight: hasFlight,
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
            formPayload: data.formPayload || null,
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
          next.push({ full_name: "", email: "", phone: "", id_country: "", passo_number: "" });
        }
      } else if (count < prev.length) {
        next.splice(count);
      }
      return next;
    });
  };

  const amedBanner = (
    <div className="bg-gradient-to-r from-green-800 via-green-700 to-green-800 text-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/amedspor-logo.png"
            alt="Amed Spor"
            className="h-24 w-24 shrink-0 object-contain sm:h-32 sm:w-32"
          />
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.14em] text-yellow-300 sm:text-sm">
              {t("amedBannerBadge")}
            </div>
            <div className="mt-1 text-xl font-extrabold leading-tight sm:text-2xl lg:text-3xl">{localized.title}</div>
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
                <div className="relative aspect-[3/4] bg-gradient-to-br from-primary-100 to-primary-50 flex items-center justify-center overflow-hidden">
                  <CoverImage
                    src={amedEvent.image_url}
                    alt={amedEvent.title}
                    sizes="(max-width: 1024px) 100vw, 360px"
                    zoomOnHover
                    fallback={<Music2 className="h-12 w-12 text-primary-400" />}
                  />
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
                      {Array.from({ length: maxAttendees }, (_, i) => i + 1).map((num) => (
                        <option key={num} value={num}>
                          {num}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Tribün / İzleme Alanı Seçimi (VIP Tribünü veya Özel Loca) */}
                  <div className="space-y-3 p-4 border border-gray-200 rounded-lg bg-gray-50/50">
                    <div>
                      <h3 className="font-semibold text-lg">{t("seatingAreaTitle")}</h3>
                      <p className="text-xs text-slate-600 mt-0.5">{t("seatingAreaDesc")}</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <label
                        className={`relative flex items-center gap-3 p-3.5 border-2 rounded-xl cursor-pointer transition-all ${
                          seatingPreference === "vip"
                            ? "border-primary-600 bg-primary-50/50 shadow-sm"
                            : "border-gray-200 hover:border-gray-300 bg-white"
                        }`}
                      >
                        <input
                          type="radio"
                          name="seatingPreference"
                          value="vip"
                          checked={seatingPreference === "vip"}
                          onChange={() => setSeatingPreference("vip")}
                          className="h-4 w-4 text-primary-600 focus:ring-primary-500"
                        />
                        <span className="font-semibold text-sm text-slate-900">{t("seatingVip")}</span>
                      </label>
                      <label
                        className={`relative flex items-center gap-3 p-3.5 border-2 rounded-xl cursor-pointer transition-all ${
                          seatingPreference === "loca"
                            ? "border-primary-600 bg-primary-50/50 shadow-sm"
                            : "border-gray-200 hover:border-gray-300 bg-white"
                        }`}
                      >
                        <input
                          type="radio"
                          name="seatingPreference"
                          value="loca"
                          checked={seatingPreference === "loca"}
                          onChange={() => setSeatingPreference("loca")}
                          className="h-4 w-4 text-primary-600 focus:ring-primary-500"
                        />
                        <span className="font-semibold text-sm text-slate-900">{t("seatingLoca")}</span>
                      </label>
                    </div>
                  </div>

                  {/* Katılımcı Bilgileri */}
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
                          <div className="mb-2 rounded-lg border border-primary-100 bg-primary-50 px-4 py-3 text-sm leading-6 text-primary-800">
                            {t("fullNameWarning")}
                          </div>
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

                        {/* Kimlik / Pasaport Ülkesi & Passo Numarası */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium mb-2">
                              {t("idCountry")}
                            </label>
                            <select
                              value={
                                countryOther.has(index)
                                  ? "other"
                                  : COUNTRIES.includes(attendee.id_country)
                                    ? attendee.id_country
                                    : ""
                              }
                              onChange={(e) => {
                                const value = e.target.value;
                                setCountryOther((prev) => {
                                  const next = new Set(prev);
                                  if (value === "other") next.add(index);
                                  else next.delete(index);
                                  return next;
                                });
                                handleAttendeeChange(index, "id_country", value === "other" ? "" : value);
                              }}
                              className={`w-full px-4 py-2 border rounded-lg bg-white ${
                                errors[`id_country_${index}`] ? "border-red-500" : "border-gray-300"
                              }`}
                              required
                            >
                              <option value="" disabled>
                                {t("idCountrySelect")}
                              </option>
                              {COUNTRIES.map((country) => (
                                <option key={country} value={country}>
                                  {country}
                                </option>
                              ))}
                              <option value="other">{t("idCountryOther")}</option>
                            </select>
                            {countryOther.has(index) && (
                              <input
                                type="text"
                                value={attendee.id_country}
                                onChange={(e) =>
                                  handleAttendeeChange(index, "id_country", e.target.value)
                                }
                                placeholder={t("idCountryOtherPlaceholder")}
                                className={`w-full px-4 py-2 border rounded-lg mt-2 ${
                                  errors[`id_country_${index}`] ? "border-red-500" : "border-gray-300"
                                }`}
                                required
                              />
                            )}
                            {errors[`id_country_${index}`] ? (
                              <p className="text-red-500 text-sm mt-1">{errors[`id_country_${index}`]}</p>
                            ) : null}
                          </div>

                          <div>
                            <label className="block text-sm font-medium mb-2">
                              {t("passoNumber")}
                            </label>
                            <input
                              type="text"
                              value={attendee.passo_number}
                              onChange={(e) =>
                                handleAttendeeChange(index, "passo_number", e.target.value)
                              }
                              placeholder={t("passoNumberPlaceholder")}
                              className={`w-full px-4 py-2 border rounded-lg ${
                                errors[`passo_number_${index}`] ? "border-red-500" : "border-gray-300"
                              }`}
                              required
                            />
                            {errors[`passo_number_${index}`] ? (
                              <p className="text-red-500 text-sm mt-1">{errors[`passo_number_${index}`]}</p>
                            ) : null}
                            <p className="text-xs text-slate-500 mt-1">{t("passoNumberHelp")}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Ek Hizmet Seçenekleri (Konaklama & Uçak Bileti) - Yalnızca fiyat tanımlıysa gösterilir */}
                  {(Number(event.accommodation_price) > 0 || Number(event.flight_price) > 0) && (
                    <div className="space-y-3 p-4 border border-gray-200 rounded-lg bg-gray-50/50">
                      <h3 className="font-semibold text-lg">{t("additionalServicesTitle")}</h3>
                      <div className="space-y-2 pt-1">
                        {Number(event.accommodation_price) > 0 && (
                          <label className="flex items-center gap-3 p-3 border rounded-lg bg-white cursor-pointer hover:bg-slate-50 transition-colors">
                            <input
                              type="checkbox"
                              checked={hasAccommodation}
                              onChange={(e) => setHasAccommodation(e.target.checked)}
                              className="h-4 w-4 text-primary-600 rounded focus:ring-primary-500"
                            />
                            <span className="text-sm font-medium text-slate-800">
                              {t("includeAccommodation").replace(
                                "{price}",
                                formatPrice(Number(event.accommodation_price), event.currency)
                              )}
                            </span>
                          </label>
                        )}
                        {Number(event.flight_price) > 0 && (
                          <label className="flex items-center gap-3 p-3 border rounded-lg bg-white cursor-pointer hover:bg-slate-50 transition-colors">
                            <input
                              type="checkbox"
                              checked={hasFlight}
                              onChange={(e) => setHasFlight(e.target.checked)}
                              className="h-4 w-4 text-primary-600 rounded focus:ring-primary-500"
                            />
                            <span className="text-sm font-medium text-slate-800">
                              {t("includeFlight").replace(
                                "{price}",
                                formatPrice(Number(event.flight_price), event.currency)
                              )}
                            </span>
                          </label>
                        )}
                      </div>
                    </div>
                  )}

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

                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      id="accept_phone_contact"
                      checked={formData.accept_phone_contact}
                      onChange={(e) => handleChange("accept_phone_contact", e.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0"
                    />
                    <label htmlFor="accept_phone_contact" className="text-sm text-slate-700">
                      {t("acceptPhoneContact")}
                    </label>
                  </div>

                  {/* Sipariş ve Fiyat Özeti Kutusu */}
                  {(Number(event.price_from) > 0 ||
                    (hasAccommodation && Number(event.accommodation_price) > 0) ||
                    (hasFlight && Number(event.flight_price) > 0)) && (
                    <div className="p-4 bg-slate-900 text-white rounded-xl space-y-2">
                      <h4 className="font-semibold text-xs tracking-wider text-slate-300 uppercase">
                        {t("orderSummaryTitle")}
                      </h4>
                      <div className="text-sm space-y-1.5 text-slate-200">
                        {Number(event.price_from) > 0 && (
                          <div className="flex justify-between">
                            <span>
                              {t("matchTicket")} ({ticketCount} kişi ×{" "}
                              {formatPrice(Number(event.price_from), event.currency)})
                            </span>
                            <span className="font-medium">
                              {formatPrice(Number(event.price_from) * ticketCount, event.currency)}
                            </span>
                          </div>
                        )}
                        {hasAccommodation && Number(event.accommodation_price) > 0 && (
                          <div className="flex justify-between">
                            <span>
                              {t("accommodationService")} ({ticketCount} kişi ×{" "}
                              {formatPrice(Number(event.accommodation_price), event.currency)})
                            </span>
                            <span className="font-medium">
                              {formatPrice(Number(event.accommodation_price) * ticketCount, event.currency)}
                            </span>
                          </div>
                        )}
                        {hasFlight && Number(event.flight_price) > 0 && (
                          <div className="flex justify-between">
                            <span>
                              {t("flightService")} ({ticketCount} kişi ×{" "}
                              {formatPrice(Number(event.flight_price), event.currency)})
                            </span>
                            <span className="font-medium">
                              {formatPrice(Number(event.flight_price) * ticketCount, event.currency)}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="border-t border-slate-700 pt-2 flex justify-between items-center text-lg font-bold text-yellow-400">
                        <span>{t("totalAmount")}</span>
                        <span>
                          {formatPrice(
                            ((Number(event.price_from) || 0) +
                              (hasAccommodation ? Number(event.accommodation_price) || 0 : 0) +
                              (hasFlight ? Number(event.flight_price) || 0 : 0)) *
                              ticketCount,
                            event.currency
                          )}
                        </span>
                      </div>
                    </div>
                  )}

                  {errors.submit ? (
                    <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-lg">
                      {errors.submit}
                    </div>
                  ) : null}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:min-w-[180px]"
                  >
                    {isSubmitting ? t("submitting") : hasAnyPrice ? t("addToCart") : t("submitForm")}
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
