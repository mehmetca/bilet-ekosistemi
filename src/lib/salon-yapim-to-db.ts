/**
 * Salon Yapım Wizard'da kaydedilen planı (plan2Blocks) veritabanı oturum planına dönüştürür.
 * Her bloktaki segment kategorileri (VIP, Kategori 2 vb.) bölüm (section) olur; etkinlikte bilet türüyle eşleşir.
 */

import type { TemplatePlan, TemplateSection, TemplateSectionRow } from "./seating-plans/musensaal-to-db";

/** Wizard'dan gelen blok/sıra/segment yapısı (API'de JSON olarak gelir) */
export interface WizardBlockRow {
  id: string;
  rowNumber: number;
  totalSeats: number;
  segments: { id: string; fromSeat: number; toSeat: number; category: string }[];
}

export interface WizardBlock {
  id: string;
  name: string;
  blockType?: string;
  zone?: string;
  horizontalFlow?: "ltr" | "rtl";
  verticalFlow?: "topToBottom" | "bottomToTop";
  rows: WizardBlockRow[];
}

function buildSeatLabels(
  lo: number,
  hi: number,
  horizontalFlow: WizardBlock["horizontalFlow"],
  verticalFlow: WizardBlock["verticalFlow"],
  blockType: WizardBlock["blockType"]
): string[] {
  const total = hi - lo + 1;
  if (total <= 0) return [];

  const isVertical = blockType === "leftVertical" || blockType === "rightVertical";
  if (isVertical) {
    if (verticalFlow === "bottomToTop") {
      return Array.from({ length: total }, (_, i) => String(hi - i));
    }
    return Array.from({ length: total }, (_, i) => String(lo + i));
  }

  if (horizontalFlow === "rtl") {
    return Array.from({ length: total }, (_, i) => String(hi - i));
  }

  return Array.from({ length: total }, (_, i) => String(lo + i));
}

/**
 * plan2Blocks → TemplatePlan.
 * Koridor blokları atlanır. Her (blok, kategori) için bir bölüm oluşturulur; bölüm adı "Blok adı - Kategori", ticket_type_label = kategori.
 */
export function wizardPlanToTemplate(plan2Blocks: WizardBlock[], planName: string): TemplatePlan {
  const sectionMap = new Map<string, { section: TemplateSection; sortOrder: number }>();
  let sortOrder = 0;

  for (const block of plan2Blocks) {
    if (block.blockType === "corridor" || !block.rows?.length) continue;

    for (const row of block.rows) {
      if (!row.segments?.length) continue;
      for (const seg of row.segments) {
        const cat = (seg.category || "Genel").trim() || "Genel";
        const key = `${block.id}-${cat}`;
        if (!sectionMap.has(key)) {
          sectionMap.set(key, {
            section: {
              name: `${block.name} - ${cat}`,
              sort_order: sortOrder++,
              ticket_type_label: cat,
              rows: [],
            },
            sortOrder: sectionMap.size,
          });
        }
        const entry = sectionMap.get(key)!;
        const from = Math.max(1, Math.min(row.totalSeats, Math.floor(seg.fromSeat ?? 1)));
        const to = Math.max(1, Math.min(row.totalSeats, Math.floor(seg.toSeat ?? 1)));
        const lo = Math.min(from, to);
        const hi = Math.max(from, to);
        const seatLabels = buildSeatLabels(
          lo,
          hi,
          block.horizontalFlow,
          block.verticalFlow,
          block.blockType
        );
        entry.section.rows.push({
          row_label: String(row.rowNumber),
          sort_order: entry.section.rows.length,
          seat_labels: seatLabels,
        } satisfies TemplateSectionRow);
      }
    }
  }

  const sections = Array.from(sectionMap.values())
    .sort((a, b) => a.section.sort_order - b.section.sort_order)
    .map((e) => e.section);

  return { planName, sections };
}
