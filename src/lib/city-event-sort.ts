/**
 * Şehir–etkinlik eşlemesi ve yaklaşan etkinlik sayısına göre sıralama.
 * Sokak adı (ör. Hanoverstraße) ile şehir adı (Hanover) karışmasını önlemek için
 * virgül/boşluk ile ayrılmış token eşitliği kullanılır; geniş substring araması yok.
 */
import { isEventPastByLocalDateTime } from "@/lib/date-utils";

/** Türkçe İ/i ve Almanca ü/ö/ä için tutarlı küçük harf + ASCII sadeleştirme */
function normalizeForMatch(s: string): string {
  return s
    .toLocaleLowerCase("tr-TR")
    .trim()
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/ä/g, "a")
    .replace(/ß/g, "ss");
}

function slugTermsLower(slug: string): string[] {
  const slugLower = slug.toLowerCase().trim();
  const parts = slugLower.split(/-+/).filter(Boolean);
  const arr: string[] = [slugLower];
  parts.forEach((p) => {
    if (p && arr.indexOf(p) === -1) arr.push(p);
  });
  return arr;
}

export function getMatchTerms(
  slug: string,
  city?: { name_tr?: string | null; name_de?: string | null; name_en?: string | null } | null
): string[] {
  const arr = slugTermsLower(slug);
  if (city) {
    [city.name_tr, city.name_de, city.name_en].filter(Boolean).forEach((n) => {
      if (n) {
        const t = n.toLocaleLowerCase("tr-TR").trim();
        if (t && arr.indexOf(t) === -1) arr.push(t);
        const norm = normalizeForMatch(t);
        if (norm && arr.indexOf(norm) === -1) arr.push(norm);
      }
    });
  }
  return arr;
}

function getVenueCityFromEvent(e: Record<string, unknown>): string {
  const v = e.venues;
  if (v == null) return "";
  if (Array.isArray(v)) {
    const first = v[0] as { city?: string } | undefined;
    return (first?.city || "").trim();
  }
  if (typeof v === "object" && v !== null && "city" in v) {
    return String((v as { city?: string }).city || "").trim();
  }
  return "";
}

/** Adres satırından olası şehir / yer adı parçaları (sokak–şehir karışmasını azaltır) */
function tokensFromAddress(s: string): string[] {
  const raw = s.trim();
  if (!raw) return [];
  const chunks = raw.split(/[,\/;]+/).flatMap((seg) => seg.trim().split(/\s+/));
  const out: string[] = [];
  for (const ch of chunks) {
    if (!ch.trim()) continue;
    const n = normalizeForMatch(ch);
    if (n) out.push(n);
    ch.split(/-+/).forEach((hyp) => {
      const hn = normalizeForMatch(hyp);
      if (hn) out.push(hn);
    });
  }
  return [...new Set(out)];
}

function textMatchesCityTerm(text: string, termNorm: string): boolean {
  if (!termNorm) return false;
  const full = normalizeForMatch(text);
  if (full === termNorm) return true;
  return tokensFromAddress(text).some((t) => t === termNorm);
}

export type CityNamesForMatch = {
  name_tr?: string | null;
  name_de?: string | null;
  name_en?: string | null;
};

export type CityRowForSort = CityNamesForMatch & {
  slug: string;
  sort_order?: number | null;
};

/**
 * getEventsForCity ile aynı mantık: event.city, venue.city, location tokenları.
 */
export function eventMatchesCityRow(
  e: Record<string, unknown>,
  citySlug: string,
  city?: CityNamesForMatch | null
): boolean {
  const matchTerms = getMatchTerms(citySlug, city);
  const loc = ((e.location as string) || "").trim();
  const cityField = ((e.city as string) || "").trim();
  const vc = getVenueCityFromEvent(e);
  return matchTerms.some((term) => {
    const termNorm = normalizeForMatch(term);
    if (!termNorm) return false;
    return (
      textMatchesCityTerm(loc, termNorm) ||
      textMatchesCityTerm(vc, termNorm) ||
      textMatchesCityTerm(cityField, termNorm)
    );
  });
}

function filterUpcomingEvents(
  eventsWithVenues: Record<string, unknown>[],
  now: Date
): Record<string, unknown>[] {
  return eventsWithVenues.filter(
    (e) => !isEventPastByLocalDateTime(String(e.date ?? ""), String(e.time ?? ""), now)
  );
}

function countUpcomingEventsForCity<T extends CityRowForSort>(
  city: T,
  upcomingWithVenues: Record<string, unknown>[]
): number {
  return upcomingWithVenues.filter((ev) => eventMatchesCityRow(ev, city.slug, city)).length;
}

/**
 * Sadece yaklaşan (tarihi geçmemiş) etkinlik sayısına göre çoktan aza sıralar.
 * Eşitlikte sort_order, sonra slug.
 */
export function sortCitiesByUpcomingEventCount<T extends CityRowForSort>(
  cities: T[],
  eventsWithVenues: Record<string, unknown>[],
  now: Date = new Date()
): T[] {
  const upcoming = filterUpcomingEvents(eventsWithVenues, now);
  const scored = cities.map((c) => ({
    city: c,
    n: countUpcomingEventsForCity(c, upcoming),
  }));
  scored.sort((a, b) => {
    if (b.n !== a.n) return b.n - a.n;
    const soA = a.city.sort_order ?? 9999;
    const soB = b.city.sort_order ?? 9999;
    if (soA !== soB) return soA - soB;
    return (a.city.slug || "").localeCompare(b.city.slug || "", "tr");
  });
  return scored.map((s) => s.city);
}
