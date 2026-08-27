/**
 * Amed Spor etkinliklerini tespit etmek için yardımcı fonksiyonlar
 */

const AMED_SPOR_SHOW_SLUGS = ['amed-spor', 'amedspor', 'amed_spor'];

export function isAmedSporEvent(showSlug: string | null | undefined): boolean {
  if (!showSlug) return false;
  const normalizedSlug = showSlug.toLowerCase().trim();
  return AMED_SPOR_SHOW_SLUGS.includes(normalizedSlug);
}
