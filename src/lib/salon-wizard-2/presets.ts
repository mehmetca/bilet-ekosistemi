import { createBand, createEmptySection, type Wizard2Draft } from "./types";

/** Hazır şablonlar — Wizard 2 taslağı doldurur; DB’ye yazmaz. */
export function applyPreset(presetId: string, planName?: string): Wizard2Draft {
  const name = planName?.trim() || "Yeni salon planı";

  switch (presetId) {
    case "theater_classic":
      return {
        planName: name || "Klasik tiyatro",
        stageLabel: "SAHNE",
        ticketNamingMode: "section_category",
        sections: [
          createEmptySection({
            name: "Balkon Sol",
            zone: "parkett_left",
            rowCount: 8,
            seatsPerRow: 10,
            direction: "rtl",
            categoryBands: [createBand(1, 1, "VIP"), createBand(2, 8, "Kategori 2")],
          }),
          createEmptySection({
            name: "Parkett",
            zone: "parkett_center",
            rowCount: 13,
            seatsPerRow: 20,
            categoryBands: [
              createBand(1, 3, "VIP"),
              createBand(4, 8, "Kategori 1"),
              createBand(9, 13, "Kategori 2"),
            ],
            aisleAfterSeatIndex: 10,
          }),
          createEmptySection({
            name: "Balkon Sağ",
            zone: "parkett_right",
            rowCount: 8,
            seatsPerRow: 10,
            direction: "ltr",
            categoryBands: [createBand(1, 1, "VIP"), createBand(2, 8, "Kategori 2")],
          }),
        ],
      };

    case "concert_flat":
      return {
        planName: name || "Konser — düz salon",
        stageLabel: "SAHNE",
        ticketNamingMode: "category_only",
        sections: [
          createEmptySection({
            name: "Salon",
            zone: "parkett_center",
            rowCount: 18,
            seatsPerRow: 24,
            categoryBands: [
              createBand(1, 3, "VIP"),
              createBand(4, 10, "Kategori 1"),
              createBand(11, 18, "Kategori 2"),
            ],
            aisleAfterSeatIndex: 12,
          }),
        ],
      };

    case "u_shape":
      return {
        planName: name || "U düzen",
        stageLabel: "SAHNE",
        ticketNamingMode: "section_category",
        sections: [
          createEmptySection({
            name: "Sol",
            zone: "parkett_left",
            rowCount: 8,
            seatsPerRow: 10,
            direction: "rtl",
            categoryBands: [createBand(1, 2, "VIP"), createBand(3, 8, "Kategori 1")],
          }),
          createEmptySection({
            name: "Orta salon",
            zone: "parkett_center",
            rowCount: 6,
            seatsPerRow: 14,
            categoryBands: [createBand(1, 6, "VIP")],
          }),
          createEmptySection({
            name: "Sağ",
            zone: "parkett_right",
            rowCount: 8,
            seatsPerRow: 10,
            categoryBands: [createBand(1, 2, "VIP"), createBand(3, 8, "Kategori 1")],
          }),
        ],
      };

    default:
      return {
        planName: name,
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
}

export const PRESET_OPTIONS = [
  { id: "theater_classic", label: "Tiyatro: Parkett + sol/sağ Balkon (VIP / Kat.1 / Kat.2)" },
  { id: "concert_flat", label: "Konser: tek salon, kategoriler birleşik (sadece VIP, Kat…)" },
  { id: "u_shape", label: "U düzen (sol / orta / sağ)" },
  { id: "blank", label: "Boş — Parkett örneği" },
] as const;
