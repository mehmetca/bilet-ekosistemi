/**
 * Rosengarten Musensaal şablonunun bölüm adları (getMusensaalTemplateCopy ile aynı sıra).
 * Etkinlik sayfasında SalonPlanViewer yalnızca bu yapıda kullanılmalı; aksi halde DB’deki gerçek düzen SeatMapSvg ile gösterilir.
 */
export const MUSENSAAL_TEMPLATE_SECTION_NAMES = [
  "Parkett",
  "Empore Mitte Sol",
  "Empore Mitte Sağ",
  "Seitensempore Links",
  "Seitensempore Rechts",
  "Empore Hinten",
] as const;

export function planSectionsMatchMusensaalTemplate(sections: { name: string }[]): boolean {
  if (sections.length !== MUSENSAAL_TEMPLATE_SECTION_NAMES.length) return false;
  return sections.every((s, i) => s.name === MUSENSAAL_TEMPLATE_SECTION_NAMES[i]);
}
