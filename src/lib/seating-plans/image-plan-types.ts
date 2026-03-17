/**
 * Görsel (fotoğraf/PDF export) üzerinde tıklanabilir koltuk planı.
 * Her koltuk için (x, y) normalize koordinat (0–1) ile overlay çizilir.
 */

export interface ImagePlanSectionGrid {
  /** Bölüm adı (eşleşme için; normalize edilerek karşılaştırılabilir) */
  name: string;
  /** Sol üst köşe x (0–1) */
  x: number;
  /** Sol üst köşe y (0–1, üst = 0) */
  y: number;
  width: number;
  height: number;
  /** Sıra sayısı */
  rows: number;
  /** Her sıradaki koltuk sayısı (sabit veya sıra indeksine göre) */
  seatsPerRow: number | ((rowIndex: number) => number);
}

export interface ImageSeatPlanConfig {
  id: string;
  name: string;
  /** public/ altındaki görsel yolu (örn. /seatplans/theaterduisburg.png) */
  imageUrl: string;
  sections: ImagePlanSectionGrid[];
}

/** (sectionName, rowLabel, seatLabel) -> { x, y } döndüren fonksiyon */
export type GetSeatCoordFn = (
  sectionName: string,
  rowLabel: string,
  seatLabel: string
) => { x: number; y: number } | null;

function normalizeSectionName(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Grid tanımlarından (section, row, seat) -> (x, y) üretir.
 * rowLabel ve seatLabel sayıya çevrilebilirse 1-based indeks kullanılır.
 */
export function buildImagePlanCoordGetter(
  config: ImageSeatPlanConfig
): GetSeatCoordFn {
  const nameToSection = new Map<string, ImagePlanSectionGrid>();
  for (const sec of config.sections) {
    nameToSection.set(normalizeSectionName(sec.name), sec);
  }

  return (sectionName: string, rowLabel: string, seatLabel: string) => {
    const sec = nameToSection.get(normalizeSectionName(sectionName));
    if (!sec) return null;

    const rowIndex =
      /^\d+$/.test(String(rowLabel).trim()) ? Number(rowLabel) - 1 : 0;
    const seatIndex =
      /^\d+$/.test(String(seatLabel).trim()) ? Number(seatLabel) - 1 : 0;

    if (rowIndex < 0 || rowIndex >= sec.rows) return null;
    const seatsInRow =
      typeof sec.seatsPerRow === "function"
        ? sec.seatsPerRow(rowIndex)
        : sec.seatsPerRow;
    if (seatIndex < 0 || seatIndex >= seatsInRow) return null;

    const x =
      sec.x + ((seatIndex + 0.5) / seatsInRow) * sec.width;
    const y =
      sec.y + ((rowIndex + 0.5) / sec.rows) * sec.height;
    return { x, y };
  };
}
