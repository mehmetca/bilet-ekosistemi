/**
 * Amed Spor etkinliklerini tespit etmek için yardımcı fonksiyonlar
 */

const AMED_SPOR_SHOW_SLUGS = ['amed-spor', 'amedspor', 'amed_spor'];

export function isAmedSporEvent(showSlug: string | null | undefined): boolean {
  if (!showSlug) return false;
  const normalizedSlug = showSlug.toLowerCase().trim();
  return AMED_SPOR_SHOW_SLUGS.includes(normalizedSlug);
}

/**
 * Etkinlik detay linki döndürür (locale ön eki olmadan: "/etkinlik/...").
 * Amed Spor: aynı show_slug'a sahip maçlar ayrı sayfalarda olmalı → event.id kullan.
 * Diğer tur/gösteri: show_slug varsa tek gruplu sayfaya git.
 */
export function eventDetailPath(showSlug: string | null | undefined, eventId: string, fallbackSlug?: string | null): string {
  if (showSlug && isAmedSporEvent(showSlug)) return `/etkinlik/${eventId}`;
  return `/etkinlik/${showSlug || fallbackSlug || eventId}`;
}
