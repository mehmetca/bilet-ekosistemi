/** Salon Yapım Wizard 2 — bağımsız taslak modeli (eski wizard’a dokunmaz). */

export type SeatDirection = "ltr" | "rtl";

/** Koltuk numaralama kuralı (gelişmiş) */
export type NumberingMode =
  | "sequential"
  | "odd"
  | "even"
  | "half_split"
  | "even_until";

export type SectionZone =
  | "parkett_center"
  | "parkett_left"
  | "parkett_right"
  | "parkett_rear"
  | "balcony_left"
  | "balcony_right"
  | "balcony_rear";

export type HalfSplitPrefer = "left_odd" | "left_even";

/**
 * Etkinlikte bilet adı nasıl oluşsun:
 * - section_category: "Parkett VIP", "Balkon Kategori 1" (aynı isimli bloklar toplanır)
 * - category_only: "VIP", "Kategori 1" (tüm salonda kategori birleşir)
 */
export type TicketNamingMode = "section_category" | "category_only";

/** Sıra aralığı → kategori (1 = bölümün ilk sırası) */
export type CategoryBand = {
  id: string;
  fromRow: number;
  toRow: number;
  category: string;
};

export type Wizard2Section = {
  id: string;
  name: string;
  zone: SectionZone;
  /** @deprecated bands kullan; yoksa geriye uyum */
  ticketTypeLabel: string;
  /** Asıl model: ilk 3 sıra VIP, sonraki 5 Kategori 1… */
  categoryBands: CategoryBand[];
  rowCount: number;
  seatsPerRow: number;
  rowLabelStart: number;
  showRowEndNumbers: boolean;
  direction: SeatDirection;
  numberingMode: NumberingMode;
  evenUntilNumber: number;
  halfSplitPrefer: HalfSplitPrefer;
  aisleAfterSeatIndex: number | null;
  aisleAfterRowNumbers: number[];
  salesBlockedKeys: string[];
};

export type Wizard2Draft = {
  planName: string;
  stageLabel: string;
  ticketNamingMode: TicketNamingMode;
  sections: Wizard2Section[];
  savedAt?: string | null;
};

export const ZONE_OPTIONS: { value: SectionZone; label: string; group: string }[] = [
  { value: "parkett_center", label: "Orta / Parkett", group: "Salon" },
  { value: "parkett_left", label: "Sol blok", group: "Salon" },
  { value: "parkett_right", label: "Sağ blok", group: "Salon" },
  { value: "parkett_rear", label: "Arka blok", group: "Salon" },
  { value: "balcony_left", label: "Balkon sol", group: "Balkon" },
  { value: "balcony_right", label: "Balkon sağ", group: "Balkon" },
  { value: "balcony_rear", label: "Balkon arka", group: "Balkon" },
];

export const NUMBERING_OPTIONS: { value: NumberingMode; label: string; hint: string }[] = [
  { value: "sequential", label: "Sıralı (1, 2, 3…)", hint: "Yöne göre artan numaralar" },
  { value: "odd", label: "Sadece tek", hint: "1, 3, 5…" },
  { value: "even", label: "Sadece çift", hint: "2, 4, 6…" },
  { value: "half_split", label: "Yarısı tek / yarısı çift", hint: "Sıranın yarısı tek, yarısı çift" },
  { value: "even_until", label: "Şu numaraya kadar çift, gerisi tek", hint: "Örn. 8’e kadar çift, sonra tek" },
];

export const CATEGORY_PRESETS = [
  "VIP",
  "Kategori 1",
  "Kategori 2",
  "Kategori 3",
  "Kategori 4",
  "Genel",
];

export function createBand(fromRow: number, toRow: number, category: string): CategoryBand {
  return {
    id: crypto.randomUUID(),
    fromRow: Math.max(1, fromRow),
    toRow: Math.max(1, toRow),
    category: category.trim() || "Genel",
  };
}

/** Eski taslaklarda bands yoksa tek bant üret */
export function normalizeCategoryBands(section: Pick<Wizard2Section, "rowCount" | "ticketTypeLabel" | "categoryBands">): CategoryBand[] {
  if (Array.isArray(section.categoryBands) && section.categoryBands.length > 0) {
    return section.categoryBands.map((b) => ({
      ...b,
      fromRow: Math.max(1, Number(b.fromRow) || 1),
      toRow: Math.max(1, Number(b.toRow) || 1),
      category: (b.category || section.ticketTypeLabel || "Genel").trim(),
    }));
  }
  return [createBand(1, Math.max(1, section.rowCount || 1), section.ticketTypeLabel || "Kategori 1")];
}

export function categoryForRowIndex(section: Wizard2Section, rowIndex0: number): string {
  const rel = rowIndex0 + 1;
  const bands = normalizeCategoryBands(section);
  // Son eşleşen kazanır — yeni eklenen aralık eski geniş aralığın üstüne yazılabilir
  let hit: CategoryBand | null = null;
  for (const b of bands) {
    const lo = Math.min(b.fromRow, b.toRow);
    const hi = Math.max(b.fromRow, b.toRow);
    if (rel >= lo && rel <= hi) hit = b;
  }
  return hit?.category || section.ticketTypeLabel || "Genel";
}

/** Yeni aralık ekle: boşluk varsa oraya; yoksa son aralığı ikiye böl */
export function appendCategoryBand(bands: CategoryBand[], rowCount: number, category = "Kategori 1"): CategoryBand[] {
  const n = Math.max(1, rowCount);
  const list = bands.length ? bands.map((b) => ({ ...b })) : [createBand(1, n, category)];
  const sorted = [...list].sort((a, b) => Math.min(a.fromRow, a.toRow) - Math.min(b.fromRow, b.toRow));

  // İlk boşluk
  let cursor = 1;
  for (const b of sorted) {
    const lo = Math.min(b.fromRow, b.toRow);
    const hi = Math.max(b.fromRow, b.toRow);
    if (lo > cursor) {
      return [...list, createBand(cursor, Math.min(n, lo - 1), category)];
    }
    cursor = Math.max(cursor, hi + 1);
  }
  if (cursor <= n) {
    return [...list, createBand(cursor, n, category)];
  }

  // Boşluk yok → en geniş / son aralığı böl
  const last = sorted[sorted.length - 1];
  const lo = Math.min(last.fromRow, last.toRow);
  const hi = Math.max(last.fromRow, last.toRow);
  if (hi <= lo) {
    return [...list, createBand(n, n, category)];
  }
  const mid = Math.floor((lo + hi) / 2);
  return list
    .map((b) => (b.id === last.id ? { ...b, fromRow: lo, toRow: mid } : b))
    .concat(createBand(mid + 1, hi, category));
}

/** Etkinlikte görünecek bilet adı (bölüm + kategori veya sadece kategori) */
export function composeTicketLabel(
  sectionName: string,
  category: string,
  mode: TicketNamingMode
): string {
  const cat = (category || "Genel").trim();
  const sn = (sectionName || "").trim();
  if (mode === "category_only" || !sn) return cat;
  const lowSn = sn.toLowerCase();
  const lowCat = cat.toLowerCase();
  if (lowCat === lowSn || lowCat.startsWith(lowSn + " ")) return cat;
  return `${sn} ${cat}`.trim();
}

export function createEmptySection(partial?: Partial<Wizard2Section>): Wizard2Section {
  const rowCount = partial?.rowCount ?? 10;
  const ticketTypeLabel = partial?.ticketTypeLabel ?? "Kategori 1";
  const categoryBands =
    partial?.categoryBands ?? [createBand(1, rowCount, ticketTypeLabel)];

  return {
    id: crypto.randomUUID(),
    name: "Parkett",
    zone: "parkett_center",
    seatsPerRow: 16,
    rowLabelStart: 1,
    showRowEndNumbers: true,
    direction: "ltr",
    numberingMode: "sequential",
    evenUntilNumber: 8,
    halfSplitPrefer: "left_odd",
    aisleAfterSeatIndex: null,
    aisleAfterRowNumbers: [],
    salesBlockedKeys: [],
    ...partial,
    ticketTypeLabel,
    rowCount,
    categoryBands,
  };
}

export function createDefaultDraft(): Wizard2Draft {
  return {
    planName: "Yeni salon planı",
    stageLabel: "SAHNE",
    ticketNamingMode: "section_category",
    sections: [
      createEmptySection({
        name: "Parkett",
        zone: "parkett_center",
        rowCount: 13,
        seatsPerRow: 18,
        categoryBands: [
          createBand(1, 3, "VIP"),
          createBand(4, 8, "Kategori 1"),
          createBand(9, 13, "Kategori 2"),
        ],
      }),
    ],
  };
}
