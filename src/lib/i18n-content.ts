/**
 * Veritabanından gelen çok dilli içeriği locale'e göre seçer.
 * Fallback: _tr -> _de -> _en -> orijinal alan
 */
export type Locale = "tr" | "de" | "en" | "ku" | "ckb";

const FALLBACK_ORDER: Record<Locale, Locale[]> = {
  tr: ["tr", "de", "en", "ku", "ckb"],
  de: ["de", "en", "tr", "ku", "ckb"],
  en: ["en", "de", "tr", "ku", "ckb"],
  ku: ["ku", "tr", "de", "en", "ckb"],
  ckb: ["ckb", "ku", "tr", "de", "en"],
};

export function getLocalizedText(
  data: Record<string, unknown> | null | undefined,
  field: string,
  locale: Locale
): string {
  if (!data) return "";

  for (const candidateLocale of FALLBACK_ORDER[locale]) {
    const candidate = data[`${field}_${candidateLocale}`];
    if (candidate != null && String(candidate).trim() !== "") {
      return String(candidate);
    }
  }

  const original = data[field];
  return original != null ? String(original) : "";
}

export function getLocalizedEvent(
  event: Record<string, unknown>,
  locale: Locale
): { title: string; description: string; venue: string } {
  return {
    title: getLocalizedText(event, "title", locale),
    description: getLocalizedText(event, "description", locale),
    venue: getLocalizedText(event, "venue", locale),
  };
}

export function getLocalizedVenue(
  venue: Record<string, unknown>,
  locale: Locale
): {
  name: string;
  address: string;
  city: string;
  seating_layout_description: string;
  transport_info: string;
  entrance_info: string;
  rules: string;
} {
  return {
    name: getLocalizedText(venue, "name", locale),
    address: getLocalizedText(venue, "address", locale),
    city: getLocalizedText(venue, "city", locale),
    seating_layout_description: getLocalizedText(venue, "seating_layout_description", locale),
    transport_info: getLocalizedText(venue, "transport_info", locale),
    entrance_info: getLocalizedText(venue, "entrance_info", locale),
    rules: getLocalizedText(venue, "rules", locale),
  };
}

export function getLocalizedArtist(
  artist: Record<string, unknown>,
  locale: Locale
): { name: string; bio: string } {
  return {
    name: getLocalizedText(artist, "name", locale),
    bio: getLocalizedText(artist, "bio", locale),
  };
}

export function getLocalizedNews(
  news: Record<string, unknown>,
  locale: Locale
): { title: string; content: string; excerpt: string } {
  return {
    title: getLocalizedText(news, "title", locale),
    content: getLocalizedText(news, "content", locale),
    excerpt: getLocalizedText(news, "excerpt", locale),
  };
}

export function getLocalizedCity(
  city: Record<string, unknown>,
  locale: Locale
): { name: string; description: string } {
  return {
    name: getLocalizedText(city, "name", locale),
    description: getLocalizedText(city, "description", locale),
  };
}
