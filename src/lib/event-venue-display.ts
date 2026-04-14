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
