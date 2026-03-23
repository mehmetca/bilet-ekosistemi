/**
 * Theater Duisburg — SVG viewBox 1207.56×858.9 üzerinde 0–1 normalize dikdörtgenler.
 * `public/seatplans/theaterduisburg.svg` — viewBox 1207.56×858.9; koltuk transform(tx,ty) dağılımına göre kalibre
 * (clip/legacy dönüşümü kaldırıldı; önceki sürüm yanlış dikey kaydırma yapıyordu).
 *
 * Gerçek piksel hizası: `theaterduisburg-svg-coords.generated.ts` — SVG güncellenince
 * `npm run seatplan:build-duisburg-coords` çalıştırın.
 *
 * İnce ayar: etkinlik URL’sine `?seatDebug=1` → kırmızı grid.
 *
 * SVG istatistik: `npm run seatplan:analyze-duisburg`
 * Tüm SVG bölümleri plaka metni: `public/seatplans/theaterduisburg-seat-display-labels.json` →
 * `npm run seatplan:duisburg-section-labels` (coords’tan sonra).
 * SVG + coords + etiketleri birlikte: `npm run seatplan:refresh-duisburg-visual`.
 */

import type { ImageSeatPlanConfig, ImagePlanSectionGrid } from "./image-plan-types";
import { buildImagePlanCoordGetter } from "./image-plan-types";
import type { GetSeatCoordFn } from "./image-plan-types";
import { THEATER_DUISBURG_SVG_COORDS_BY_SECTION } from "./theaterduisburg-svg-coords.generated";
import { THEATER_DUISBURG_SVG_LABELS_BY_SECTION } from "./theaterduisburg-svg-section-labels.generated";
import { duisburgVenuePlate, formatDuisburgSeatCaption } from "./theaterduisburg-venue-numbering";

/** SVG width/height (viewBox) — ImageSeatPlanViewer ile aynı en-boy oranı için */
export const THEATER_DUISBURG_VIEWBOX_W = 1207.56;
export const THEATER_DUISBURG_VIEWBOX_H = 858.9;
export const THEATER_DUISBURG_IMAGE_ASPECT = THEATER_DUISBURG_VIEWBOX_W / THEATER_DUISBURG_VIEWBOX_H;

function normSectionName(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function resolveDuisburgSectionGrid(
  secName: string,
  byName: Map<string, ImagePlanSectionGrid>
): ImagePlanSectionGrid | undefined {
  return byName.get(normSectionName(secName));
}

/**
 * Bölümler DB şablonu (077_theater_duisburg_plan_seed) ile aynı isimlerde olmalı.
 * x,y,width,height = tam görsel alanına göre 0–1 (viewBox ile aynı oran).
 */
const sections: ImagePlanSectionGrid[] = [
  { name: "1. PARKETT", x: 0.24, y: 0.348, width: 0.334, height: 0.128, rows: 10, seatsPerRow: 16 },
  { name: "2. PARKETT", x: 0.212, y: 0.456, width: 0.364, height: 0.118, rows: 7, seatsPerRow: 20 },
  { name: "3. PARKETT", x: 0.178, y: 0.556, width: 0.4, height: 0.108, rows: 6, seatsPerRow: 24 },
  { name: "PARKETT", x: 0.188, y: 0.642, width: 0.382, height: 0.092, rows: 4, seatsPerRow: 20 },
  { name: "PARKETT LOGEN LINKS", x: 0.054, y: 0.415, width: 0.132, height: 0.285, rows: 8, seatsPerRow: 4 },
  { name: "PARKETT LOGEN RECHTS", x: 0.814, y: 0.415, width: 0.132, height: 0.285, rows: 8, seatsPerRow: 4 },
  { name: "1. RANG LINKS", x: 0.048, y: 0.498, width: 0.112, height: 0.152, rows: 5, seatsPerRow: 6 },
  { name: "1. RANG RECHTS", x: 0.84, y: 0.498, width: 0.112, height: 0.152, rows: 5, seatsPerRow: 6 },
  { name: "2. RANG LINKS", x: 0.05, y: 0.624, width: 0.102, height: 0.118, rows: 3, seatsPerRow: 5 },
  { name: "2. RANG RECHTS", x: 0.848, y: 0.624, width: 0.102, height: 0.118, rows: 3, seatsPerRow: 5 },
  { name: "MITTE LINKS", x: 0.168, y: 0.708, width: 0.304, height: 0.168, rows: 9, seatsPerRow: 14 },
  { name: "MITTE RECHTS", x: 0.528, y: 0.708, width: 0.304, height: 0.168, rows: 9, seatsPerRow: 14 },
];

/**
 * Oturum planı adında Duisburg geçiyorsa görsel SVG planı kullanılır.
 * (Örn. "Theater Duisburg", "Duisburg Saal", "theaterduisburg".)
 */
export function isTheaterDuisburgVisualPlanName(planName: string): boolean {
  const n = planName.trim();
  if (!n) return false;
  return /theater\s*duisburg|theaterduisburg|duisburg\s*theater|\bduisburg\b/i.test(n);
}

/**
 * Bölüm adları Duisburg şablonunun tamamını içeriyorsa görsel plan açılır (plan adı yanlış yazılmış olsa bile).
 */
export function seatingPlanSectionsMatchTheaterDuisburgTemplate(
  data: { name: string }[] | null | undefined
): boolean {
  if (!data?.length) return false;
  const required = new Set(sections.map((x) => normSectionName(x.name)));
  if (data.length < required.size) return false;
  const got = new Set(data.map((x) => normSectionName(x.name)));
  for (const r of required) {
    if (!got.has(r)) return false;
  }
  return true;
}

/**
 * Bölüm adları Alman salon planına benziyor ama görsel plan tetiklenmediyse (ipucu metni için).
 */
export function seatingPlanLooksLikeGermanTheaterButNotImage(
  data: { name: string }[] | null | undefined
): boolean {
  if (!data?.length) return false;
  return data.some((s) => /parkett|rang|logen|mitte/i.test(normSectionName(s.name)));
}

export const theaterduisburgImagePlan: ImageSeatPlanConfig = {
  id: "theaterduisburg",
  name: "Theater Duisburg",
  /** Kaynak SVG; id eklemek için: npm run seatplan:tag-duisburg → .tagged.svg üretir */
  imageUrl: "/seatplans/theaterduisburg.svg?v=3",
  sections,
};

export const getTheaterDuisburgCoord: GetSeatCoordFn = buildImagePlanCoordGetter(
  theaterduisburgImagePlan
);

/** Supabase’ten gelen oturum planı (görsel koltuk listesi için) */
export type TheaterDuisburgPlanSectionInput = {
  name: string;
  rows: Array<{
    row_label: string;
    seats: Array<{ id: string; seat_label: string }>;
  }>;
};

export type TheaterDuisburgImageSeatItem = {
  id: string;
  section_name: string;
  row_label: string;
  seat_label: string;
  x: number;
  y: number;
  /** Salondaki plaka numarası (tek/çift düzeni veya yan blokta 1…n) */
  venue_plate: number;
  /** Bilet / sepet satırı */
  venue_caption: string;
  /** SVG coords eşleşen bölümlerde salon plaka metni (dairede gösterilir) */
  seat_display_label?: string;
};

function sortRowsForPlan(
  rows: TheaterDuisburgPlanSectionInput["rows"]
): TheaterDuisburgPlanSectionInput["rows"] {
  return [...rows].sort((a, b) => {
    const na = parseInt(String(a.row_label).trim(), 10);
    const nb = parseInt(String(b.row_label).trim(), 10);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
    return String(a.row_label).localeCompare(String(b.row_label), "de");
  });
}

function sortSeatsInRow(
  seats: { id: string; seat_label: string }[]
): { id: string; seat_label: string }[] {
  return [...seats].sort((a, b) => {
    const na = parseInt(String(a.seat_label).trim(), 10);
    const nb = parseInt(String(b.seat_label).trim(), 10);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
    return String(a.seat_label).localeCompare(String(b.seat_label), "de", { numeric: true });
  });
}

/** Etiket (row_label / seat_label) grid ile uyuşmazsa sıra içi sıraya göre konum üretir — tüm koltuklar SVG’de görünür. */
function coordOrdinalInSection(
  cfg: ImagePlanSectionGrid,
  rowIdx: number,
  seatIdxInRow: number,
  seatCountInRow: number
): { x: number; y: number } {
  const maxRow = Math.max(1, cfg.rows);
  const ri = Math.min(Math.max(0, rowIdx), maxRow - 1);
  const nominal =
    typeof cfg.seatsPerRow === "function" ? cfg.seatsPerRow(ri) : cfg.seatsPerRow;
  const along = Math.max(1, nominal, seatCountInRow);
  const si = Math.min(Math.max(0, seatIdxInRow), along - 1);
  return {
    x: cfg.x + ((si + 0.5) / along) * cfg.width,
    y: cfg.y + ((ri + 0.5) / maxRow) * cfg.height,
  };
}

/**
 * Görsel plan overlay’i: her DB koltuğu için normalize (x,y).
 * Önce sıra/koltuk numarasına göre grid; olmazsa satır/sütun indeksine göre yerleştirir.
 */
export function buildTheaterDuisburgSeatItemsWithCoords(
  planSections: TheaterDuisburgPlanSectionInput[]
): TheaterDuisburgImageSeatItem[] {
  const getter = getTheaterDuisburgCoord;
  const byName = new Map<string, ImagePlanSectionGrid>();
  for (const s of theaterduisburgImagePlan.sections) {
    byName.set(normSectionName(s.name), s);
  }

  const out: TheaterDuisburgImageSeatItem[] = [];

  for (const sec of planSections) {
    const cfg = resolveDuisburgSectionGrid(sec.name, byName);
    if (!cfg) continue;

    const sortedRows = sortRowsForPlan(sec.rows);
    const prepared = sortedRows.map((row, rowIdx) => ({
      row,
      rowIdx,
      seats: sortSeatsInRow(row.seats),
    }));
    const totalInSection = prepared.reduce((n, pr) => n + pr.seats.length, 0);
    const normSec = normSectionName(sec.name);
    const svgList = THEATER_DUISBURG_SVG_COORDS_BY_SECTION[normSec];
    const useSvg =
      Array.isArray(svgList) && svgList.length === totalInSection && totalInSection > 0;

    const svgLabelsForSection = THEATER_DUISBURG_SVG_LABELS_BY_SECTION[normSec];
    const useSectionSvgLabels =
      Array.isArray(svgLabelsForSection) &&
      svgLabelsForSection.length === totalInSection &&
      totalInSection > 0;

    let svgFlat = 0;
    let sectionSvgLabelIdx = 0;
    prepared.forEach(({ row, rowIdx, seats }) => {
      const nInRow = seats.length;
      seats.forEach((seat, seatIdxInRow) => {
        let coord: { x: number; y: number };
        if (useSvg) {
          const c = svgList![svgFlat++];
          coord = { x: c.nx, y: c.ny };
        } else {
          coord =
            getter(sec.name, row.row_label, seat.seat_label) ??
            coordOrdinalInSection(cfg, rowIdx, seatIdxInRow, seats.length);
        }

        let venue_plate: number;
        let venue_caption: string;
        let seat_display_label: string | undefined;

        if (useSectionSvgLabels) {
          const raw = svgLabelsForSection![sectionSvgLabelIdx++] ?? "";
          seat_display_label = raw;
          const n = parseInt(raw, 10);
          venue_plate = Number.isFinite(n) ? n : 0;
          venue_caption = `${sec.name} · Sıra ${row.row_label} · Nr ${raw || seat.seat_label}`;
        } else {
          venue_plate = duisburgVenuePlate(sec.name, seatIdxInRow, nInRow);
          venue_caption = formatDuisburgSeatCaption(sec.name, row.row_label, venue_plate, "tr");
        }

        out.push({
          id: seat.id,
          section_name: sec.name,
          row_label: row.row_label,
          seat_label: seat.seat_label,
          x: coord.x,
          y: coord.y,
          venue_plate,
          venue_caption,
          ...(seat_display_label ? { seat_display_label } : {}),
        });
      });
    });
  }

  return out;
}
