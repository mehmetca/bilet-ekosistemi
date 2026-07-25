import type { TemplatePlan } from "@/lib/seating-plans/musensaal-to-db";
import {
  buildSeatLabelsForRow,
  blockedKey,
  rowLabelForIndex,
} from "./numbering";
import {
  categoryForRowIndex,
  composeTicketLabel,
  type SectionZone,
  type Wizard2Draft,
  type Wizard2Section,
} from "./types";

export type Wizard2DbSection = {
  name: string;
  sort_order: number;
  ticket_type_label: string | null;
  section_align: "left" | "center" | "right" | null;
  corridor_mode: "none" | "horizontal" | "vertical";
  corridor_after_seat_label: string | null;
  corridor_gap_px: number;
  rows: {
    row_label: string;
    sort_order: number;
    ticket_type_label: string | null;
    seats: { seat_label: string; sales_blocked: boolean }[];
  }[];
};

export type Wizard2DbPlan = {
  planName: string;
  sections: Wizard2DbSection[];
};

const ZONE_SORT: Record<SectionZone, number> = {
  parkett_left: 10,
  parkett_center: 20,
  parkett_right: 30,
  parkett_rear: 40,
  balcony_left: 50,
  balcony_right: 60,
  balcony_rear: 70,
};

export function zoneToAlign(zone: SectionZone): "left" | "center" | "right" {
  if (zone === "parkett_left" || zone === "balcony_left") return "left";
  if (zone === "parkett_right" || zone === "balcony_right") return "right";
  return "center";
}

export function draftToDbPlan(draft: Wizard2Draft): Wizard2DbPlan {
  const mode = draft.ticketNamingMode || "section_category";
  const sorted = [...draft.sections].sort((a, b) => {
    const z = ZONE_SORT[a.zone] - ZONE_SORT[b.zone];
    if (z !== 0) return z;
    return a.name.localeCompare(b.name, "tr");
  });

  const sections: Wizard2DbSection[] = sorted.map((section, si) => {
    const labels = buildSeatLabelsForRow(
      section.seatsPerRow,
      section.numberingMode,
      section.direction,
      {
        evenUntilNumber: section.evenUntilNumber,
        halfSplitPrefer: section.halfSplitPrefer,
      }
    );

    let corridorAfter: string | null = null;
    let corridorMode: Wizard2DbSection["corridor_mode"] = "none";
    if (
      section.aisleAfterSeatIndex != null &&
      section.aisleAfterSeatIndex >= 1 &&
      section.aisleAfterSeatIndex < section.seatsPerRow
    ) {
      const idx = section.aisleAfterSeatIndex - 1;
      corridorAfter = labels[idx] ?? null;
      corridorMode = corridorAfter ? "vertical" : "none";
    }

    const sectionName = section.name.trim() || `Bölüm ${si + 1}`;

    /**
     * category_only: section.ticket_type_label = "__category_only__" (etkinlik wizard bölüm adı eklemez)
     * section_category: satıra "Parkett VIP" yazılır; section.ticket_type_label boş
     */
    const rows = Array.from({ length: section.rowCount }, (_, ri) => {
      const rowLabel = rowLabelForIndex(section, ri);
      const category = categoryForRowIndex(section, ri);
      const ticketLabel =
        mode === "category_only"
          ? category
          : composeTicketLabel(sectionName, category, "section_category");

      return {
        row_label: rowLabel,
        sort_order: ri,
        ticket_type_label: ticketLabel,
        seats: labels.map((seat_label) => ({
          seat_label,
          sales_blocked: section.salesBlockedKeys.includes(blockedKey(rowLabel, seat_label)),
        })),
      };
    });

    return {
      name: sectionName,
      sort_order: si,
      ticket_type_label: mode === "category_only" ? "__category_only__" : null,
      section_align: zoneToAlign(section.zone),
      corridor_mode: corridorMode,
      corridor_after_seat_label: corridorAfter,
      corridor_gap_px: corridorMode === "vertical" ? 24 : 0,
      rows,
    };
  });

  return {
    planName: draft.planName.trim() || "Salon planı",
    sections,
  };
}

export function draftToTemplatePlan(draft: Wizard2Draft): TemplatePlan {
  const db = draftToDbPlan(draft);
  return {
    planName: db.planName,
    sections: db.sections.map((s) => ({
      name: s.name,
      sort_order: s.sort_order,
      ticket_type_label: s.ticket_type_label,
      rows: s.rows.map((r) => ({
        row_label: r.row_label,
        sort_order: r.sort_order,
        seat_labels: r.seats.map((x) => x.seat_label),
      })),
    })),
  };
}

export function countSeats(section: Wizard2Section): number {
  return Math.max(0, section.rowCount) * Math.max(0, section.seatsPerRow);
}

export function countDraftSeats(draft: Wizard2Draft): {
  total: number;
  blocked: number;
  sellable: number;
} {
  let total = 0;
  let blocked = 0;
  for (const s of draft.sections) {
    total += countSeats(s);
    blocked += s.salesBlockedKeys.length;
  }
  return { total, blocked, sellable: Math.max(0, total - blocked) };
}

/** Etkinlikte görülecek özet: bilet adı → koltuk adedi */
export function aggregateTicketPreview(
  draft: Wizard2Draft
): { label: string; seatCount: number; category: string; sectionNames: string[] }[] {
  const mode = draft.ticketNamingMode || "section_category";
  const map = new Map<
    string,
    { label: string; seatCount: number; category: string; sectionNames: Set<string> }
  >();

  for (const section of draft.sections) {
    const sn = section.name.trim() || "Bölüm";
    for (let ri = 0; ri < section.rowCount; ri++) {
      const category = categoryForRowIndex(section, ri);
      const label = composeTicketLabel(sn, category, mode);
      const key = label.toLocaleLowerCase("tr-TR");
      let entry = map.get(key);
      if (!entry) {
        entry = { label, seatCount: 0, category, sectionNames: new Set() };
        map.set(key, entry);
      }
      entry.seatCount += Math.max(0, section.seatsPerRow);
      entry.sectionNames.add(sn);
    }
  }

  return Array.from(map.values())
    .map((e) => ({
      label: e.label,
      seatCount: e.seatCount,
      category: e.category,
      sectionNames: Array.from(e.sectionNames),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "tr"));
}
