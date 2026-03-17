/**
 * Musensaal şablonunu veritabanı planına dönüştürür.
 * Orijinal şablon (musensaal.ts) değişmez; mekana eklenen kopya üzerinde düzenleme yapılır.
 */

import { musensaal } from "./musensaal";

export interface TemplateSectionRow {
  row_label: string;
  sort_order: number;
  seat_labels: string[];
}

export interface TemplateSection {
  name: string;
  sort_order: number;
  /** Etkinlikteki bilet türü adı – aynı isimle bilet türü oluşturulmalı (resmi plandaki Kategorie 1–5) */
  ticket_type_label?: string | null;
  rows: TemplateSectionRow[];
}

export interface TemplatePlan {
  planName: string;
  sections: TemplateSection[];
}

/** Musensaal için DB'ye eklenecek plan yapısı (kopya – değiştirilebilir). */
export function getMusensaalTemplateCopy(): TemplatePlan {
  const sections: TemplateSection[] = [];

  // Bilet türü etiketleri: bölüm adıyla aynı (etkinlikte Parkett, Empore Mitte Sol vb. ekleyin). İsim eşleşmezse etkinlik sayfası bölüm sırasıyla da eşleştirir.
  // 1. Parkett
  sections.push({
    name: "Parkett",
    sort_order: 0,
    ticket_type_label: "Parkett",
    rows: musensaal.parkett.rows.map((r, i) => ({
      row_label: String(r.row),
      sort_order: i,
      seat_labels: Array.from({ length: r.seats }, (_, j) => String(j + 1)),
    })),
  });

  // 2. Empore Mitte Sol
  sections.push({
    name: "Empore Mitte Sol",
    sort_order: 1,
    ticket_type_label: "Empore Mitte Sol",
    rows: musensaal.emporeMitte.left.rows.map((r, i) => ({
      row_label: String(r.row),
      sort_order: i,
      seat_labels: Array.from({ length: r.seats }, (_, j) => String(j + 1)),
    })),
  });

  // 3. Empore Mitte Sağ
  sections.push({
    name: "Empore Mitte Sağ",
    sort_order: 2,
    ticket_type_label: "Empore Mitte Sağ",
    rows: musensaal.emporeMitte.right.rows.map((r, i) => ({
      row_label: String(r.row),
      sort_order: i,
      seat_labels: Array.from({ length: r.seats }, (_, j) => String(j + 1)),
    })),
  });

  // 4. Seitensempore Links → Kategori 3
  sections.push({
    name: "Seitensempore Links",
    sort_order: 3,
    ticket_type_label: "Kategori 3",
    rows: musensaal.seitenEmporeLinks.rows.map((r, i) => ({
      row_label: String(r.row),
      sort_order: i,
      seat_labels: Array.from({ length: r.seats }, (_, j) => String(j + 1)),
    })),
  });

  // 5. Seitensempore Rechts
  sections.push({
    name: "Seitensempore Rechts",
    sort_order: 4,
    ticket_type_label: "Seitensempore Rechts",
    rows: musensaal.seitenEmporeRechts.rows.map((r, i) => ({
      row_label: String(r.row),
      sort_order: i,
      seat_labels: Array.from({ length: r.seats }, (_, j) => String(j + 1)),
    })),
  });

  // 6. Empore Hinten
  sections.push({
    name: "Empore Hinten",
    sort_order: 5,
    ticket_type_label: "Empore Hinten",
    rows: musensaal.emporeHinten.rows.map((r, i) => {
      const total = r.left + r.middle + r.right;
      return {
        row_label: String(r.row),
        sort_order: i,
        seat_labels: Array.from({ length: total }, (_, j) => String(j + 1)),
      };
    }),
  });

  return {
    planName: "Musensaal (kopya)",
    sections,
  };
}
