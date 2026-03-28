import type { Seat, SeatingPlanRow, SeatingPlanSection } from "@/types/database";

export type SalonPresetId =
  | "single_center"
  | "dual_center"
  | "center_side_parallels"
  | "multi_flank_musensaal"
  | "sides_only"
  | "center_balcony"
  | "two_blocks"
  | "three_blocks";

export interface SalonPresetMeta {
  id: SalonPresetId;
  label: string;
  description: string;
}

export const SALON_PRESET_OPTIONS: SalonPresetMeta[] = [
  {
    id: "single_center",
    label: "Tek orta parket (CD-Kaserne Halle 16 tarzı)",
    description: "Tek blok: tam genişlikte parket.",
  },
  {
    id: "dual_center",
    label: "İki orta parket (Halle 10 tarzı)",
    description: "Parket Sol + Parket Sağ (iki ana blok).",
  },
  {
    id: "center_side_parallels",
    label: "Orta parket + yan paralel şeritler",
    description: "Sol şerit, orta parket, sağ şerit.",
  },
  {
    id: "multi_flank_musensaal",
    label: "Orta parket + yan çoklu şerit (Musensaal tarzı)",
    description: "Her yanda 2–4 paralel şerit + orta parket.",
  },
  {
    id: "sides_only",
    label: "Sadece yan bloklar (Sol + Sağ)",
    description: "Orta yok; iki yan parket.",
  },
  {
    id: "center_balcony",
    label: "Parket + balkon",
    description: "Ana parket ve üstte balkon bölümü.",
  },
  {
    id: "two_blocks",
    label: "İki blok (yan yana, nötr)",
    description: "Blok A + Blok B (sol/sağ anahtar kelimesi yok; önizlemede ortada üst üste).",
  },
  {
    id: "three_blocks",
    label: "Üç blok (yan yana, nötr)",
    description: "Blok A, B, C.",
  },
];

export type SalonPresetCorridorMode = "none" | "horizontal" | "vertical";

export interface SalonPresetParams {
  rowCount: number;
  seatsPerRow: number;
  /** Yan şeritlerde farklıysa (varsayılan: rowCount / seatsPerRow) */
  sideRowCount?: number;
  sideSeatsPerRow?: number;
  /** multi_flank_musensaal: her yanda şerit sayısı */
  flankSegmentsPerSide?: 2 | 3 | 4;
  /** Tüm yeni bölümlere yazılır; boş bırakılabilir */
  defaultTicketLabel?: string | null;
  /** Oluşturulan her bölüme aynı koridor ayarı (önizleme) */
  corridorMode?: SalonPresetCorridorMode;
  /** corridorMode === vertical iken koltuk etiketi (örn. "10") */
  corridorAfterSeatLabel?: string | null;
}

function applyCorridorToAllSections(draft: SalonPresetDraft, raw: SalonPresetParams): SalonPresetDraft {
  const mode: SalonPresetCorridorMode = raw.corridorMode ?? "none";
  const after = (raw.corridorAfterSeatLabel ?? "").trim();
  const label = mode === "vertical" && after ? after : null;
  return {
    ...draft,
    sections: draft.sections.map((s) => ({
      ...s,
      corridor_mode: mode,
      corridor_gap_px: 0,
      corridor_after_seat_label: label,
    })),
  };
}

export interface SalonPresetDraft {
  sections: SeatingPlanSection[];
  rowsBySection: Record<string, SeatingPlanRow[]>;
  seatsByRow: Record<string, Seat[]>;
}

function tempId(prefix: string): string {
  return `tmp_${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

function buildSectionBlock(
  planId: string,
  name: string,
  sortOrder: number,
  rowCount: number,
  seatsPerRow: number,
  ticketLabel: string | null
): { section: SeatingPlanSection; rows: SeatingPlanRow[]; seatsByRow: Record<string, Seat[]> } {
  const sectionId = tempId("section");
  const section: SeatingPlanSection = {
    id: sectionId,
    seating_plan_id: planId,
    name,
    sort_order: sortOrder,
    created_at: nowIso(),
    ticket_type_label: ticketLabel,
    corridor_mode: "none",
    corridor_gap_px: 0,
    corridor_after_seat_label: null,
    section_align: null,
  };
  const rows: SeatingPlanRow[] = [];
  const seatsByRow: Record<string, Seat[]> = {};
  const rc = clampInt(rowCount, 1, 200);
  const sc = clampInt(seatsPerRow, 1, 200);
  for (let r = 0; r < rc; r++) {
    const rowId = tempId("row");
    const row: SeatingPlanRow = {
      id: rowId,
      section_id: sectionId,
      row_label: String(r + 1),
      sort_order: r,
      created_at: nowIso(),
      ticket_type_label: null,
    };
    rows.push(row);
    const seats: Seat[] = [];
    for (let s = 1; s <= sc; s++) {
      seats.push({
        id: tempId("seat"),
        row_id: rowId,
        seat_label: String(s),
        created_at: nowIso(),
      });
    }
    seatsByRow[rowId] = seats;
  }
  return { section, rows, seatsByRow };
}

function mergeBlocks(
  blocks: Array<{ section: SeatingPlanSection; rows: SeatingPlanRow[]; seatsByRow: Record<string, Seat[]> }>
): SalonPresetDraft {
  const sections: SeatingPlanSection[] = [];
  const rowsBySection: Record<string, SeatingPlanRow[]> = {};
  const seatsByRow: Record<string, Seat[]> = {};
  for (const b of blocks) {
    sections.push(b.section);
    rowsBySection[b.section.id] = b.rows;
    Object.assign(seatsByRow, b.seatsByRow);
  }
  return { sections, rowsBySection, seatsByRow };
}

/**
 * Seçilen şablon için taslak bölüm/sıra/koltuk üretir (henüz veritabanına yazılmaz).
 */
export function buildSalonPresetDraft(
  planId: string,
  presetId: SalonPresetId,
  raw: SalonPresetParams
): SalonPresetDraft {
  const rowCount = clampInt(raw.rowCount, 1, 200);
  const seatsPerRow = clampInt(raw.seatsPerRow, 1, 200);
  const sideRowCount = clampInt(raw.sideRowCount ?? rowCount, 1, 200);
  const sideSeatsPerRow = clampInt(raw.sideSeatsPerRow ?? seatsPerRow, 1, 200);
  const ticket = (raw.defaultTicketLabel ?? "").trim() || null;
  let sort = 0;

  let draft: SalonPresetDraft;
  switch (presetId) {
    case "single_center": {
      const b = buildSectionBlock(planId, "Parket", sort++, rowCount, seatsPerRow, ticket);
      draft = mergeBlocks([b]);
      break;
    }
    case "dual_center": {
      const left = buildSectionBlock(planId, "Parket Sol", sort++, rowCount, seatsPerRow, ticket);
      const right = buildSectionBlock(planId, "Parket Sağ", sort++, rowCount, seatsPerRow, ticket);
      draft = mergeBlocks([left, right]);
      break;
    }
    case "sides_only": {
      const left = buildSectionBlock(planId, "Parket Sol", sort++, rowCount, seatsPerRow, ticket);
      const right = buildSectionBlock(planId, "Parket Sağ", sort++, rowCount, seatsPerRow, ticket);
      draft = mergeBlocks([left, right]);
      break;
    }
    case "center_side_parallels": {
      const left = buildSectionBlock(planId, "Parket Sol", sort++, sideRowCount, sideSeatsPerRow, ticket);
      const center = buildSectionBlock(planId, "Parket Orta", sort++, rowCount, seatsPerRow, ticket);
      const right = buildSectionBlock(planId, "Parket Sağ", sort++, sideRowCount, sideSeatsPerRow, ticket);
      draft = mergeBlocks([left, center, right]);
      break;
    }
    case "multi_flank_musensaal": {
      const n = raw.flankSegmentsPerSide ?? 3;
      const seg = n === 2 || n === 3 || n === 4 ? n : 3;
      const blocks: ReturnType<typeof buildSectionBlock>[] = [];
      for (let i = 1; i <= seg; i++) {
        blocks.push(
          buildSectionBlock(planId, `Sol Şerit ${i}`, sort++, sideRowCount, sideSeatsPerRow, ticket)
        );
      }
      blocks.push(buildSectionBlock(planId, "Parket Orta", sort++, rowCount, seatsPerRow, ticket));
      for (let i = 1; i <= seg; i++) {
        blocks.push(
          buildSectionBlock(planId, `Sağ Şerit ${i}`, sort++, sideRowCount, sideSeatsPerRow, ticket)
        );
      }
      draft = mergeBlocks(blocks);
      break;
    }
    case "center_balcony": {
      const main = buildSectionBlock(planId, "Parket", sort++, rowCount, seatsPerRow, ticket);
      const balcony = buildSectionBlock(planId, "Balkon Arka", sort++, Math.min(rowCount, 24), seatsPerRow, ticket);
      draft = mergeBlocks([main, balcony]);
      break;
    }
    case "two_blocks": {
      const a = buildSectionBlock(planId, "Blok A", sort++, rowCount, seatsPerRow, ticket);
      const b = buildSectionBlock(planId, "Blok B", sort++, rowCount, seatsPerRow, ticket);
      draft = mergeBlocks([a, b]);
      break;
    }
    case "three_blocks": {
      const a = buildSectionBlock(planId, "Blok A", sort++, rowCount, seatsPerRow, ticket);
      const b = buildSectionBlock(planId, "Blok B", sort++, rowCount, seatsPerRow, ticket);
      const c = buildSectionBlock(planId, "Blok C", sort++, rowCount, seatsPerRow, ticket);
      draft = mergeBlocks([a, b, c]);
      break;
    }
    default: {
      const b = buildSectionBlock(planId, "Parket", 0, rowCount, seatsPerRow, ticket);
      draft = mergeBlocks([b]);
    }
  }
  return applyCorridorToAllSections(draft, raw);
}

export function presetUsesSideDimensions(presetId: SalonPresetId): boolean {
  return presetId === "center_side_parallels" || presetId === "multi_flank_musensaal";
}

export function presetUsesFlankCount(presetId: SalonPresetId): boolean {
  return presetId === "multi_flank_musensaal";
}
