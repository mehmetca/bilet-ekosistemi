import type { Event } from "@/types/database";

/**
 * Etkinlik kartı / detay: mekan adı, tam adres, şehir (bu sırayla).
 * Yapısal alanlar boşsa `location` (eski tek alan) kullanılır.
 */
export function formatEventVenueAddressCityLine(event: Event, localizedVenue: string): string {
  const venue = (localizedVenue || event.venue || "").trim();
  const address = (event.address ?? "").trim();
  const city = (event.city ?? "").trim();
  const structured = [venue, address, city].filter(Boolean).join(", ");
  if (structured) return structured;
  return (event.location ?? "").trim();
}

/** Eski etkinlik sayfasından kalan sabit uyarılar (artık üstteki rezervasyon alanında anlaşılıyor); DB’de kopyalanmış olabilir. */
const LEGACY_VENUE_RESERVATION_AREA_NOTE: RegExp[] = [
  /\*{0,2}Not\*{0,2}:\s*Koltuk seçimi ve bilet kategorileri sayfanın üstündeki rezervasyon alanındadır\.?\s*/gi,
  /\*{0,2}Hinweis\*{0,2}:\s*(?:Die )?Sitzplatz(?:aus)?wahl und Ticketkategorien befinden sich im Buchungsbereich oben auf der Seite\.?\s*/gi,
  /\*{0,2}Note\*{0,2}:\s*Seat selection and ticket categories (?:can be found in|are located in|are in) the reservation area at the top of the page\.?\s*/gi,
];

export function stripLegacyVenueReservationAreaNote(raw: string | null | undefined): string {
  if (raw == null) return "";
  let s = String(raw);
  for (const re of LEGACY_VENUE_RESERVATION_AREA_NOTE) {
    s = s.replace(re, "");
  }
  return s.replace(/\s+$/gm, "").replace(/^\s+$/gm, "").replace(/\n{3,}/g, "\n\n").trim();
}
