/**
 * Theater Duisburg — sıra içi sahne numarası (Platznummer).
 * Ana parkett / mitte: ortada 1, solda tekler (25,23,…,3), sağda çiftler (2,4,…,2k).
 * Küçük loge / yan rang (≤6 koltuk): soldan sağa 1…n (basit sıra).
 */

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Sıra içi soldan sağa 0-based indeks → salondaki koltuk numarası */
export function duisburgVenuePlateFromLeftIndex(leftIndex: number, seatsInRow: number): number {
  if (seatsInRow <= 0 || leftIndex < 0 || leftIndex >= seatsInRow) {
    return Math.min(seatsInRow, Math.max(1, leftIndex + 1));
  }
  if (seatsInRow % 2 === 1) {
    const k = (seatsInRow - 1) / 2;
    if (leftIndex < k) return 2 * k + 1 - 2 * leftIndex;
    if (leftIndex === k) return 1;
    const j = leftIndex - k - 1;
    return 2 + 2 * j;
  }
  const k = seatsInRow / 2;
  if (leftIndex < k) return 2 * k - 1 - 2 * leftIndex;
  const j = leftIndex - k;
  return 2 + 2 * j;
}

function useSimpleSequentialNumbering(sectionName: string, seatsInRow: number): boolean {
  const n = norm(sectionName);
  if (seatsInRow > 6) return false;
  return /\blogen\b|\brang\b/.test(n);
}

/**
 * Bölüm + soldan sağa sıra içi indeks (sıralı koltuk listesindeki 0-based) → plaka numarası
 */
export function duisburgVenuePlate(
  sectionName: string,
  leftIndexInRow: number,
  seatsInRow: number
): number {
  if (useSimpleSequentialNumbering(sectionName, seatsInRow)) {
    return leftIndexInRow + 1;
  }
  return duisburgVenuePlateFromLeftIndex(leftIndexInRow, seatsInRow);
}

export function formatDuisburgSeatCaption(
  sectionName: string,
  rowLabel: string,
  venuePlate: number,
  locale: "tr" | "de" | "en" = "tr"
): string {
  if (locale === "de") {
    return `${sectionName} · Reihe ${rowLabel} · Platz ${venuePlate}`;
  }
  if (locale === "en") {
    return `${sectionName} · Row ${rowLabel} · Seat ${venuePlate}`;
  }
  return `${sectionName} · Sıra ${rowLabel} · Nr ${venuePlate}`;
}
