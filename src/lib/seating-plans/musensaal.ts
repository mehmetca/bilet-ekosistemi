/**
 * Musensaal salon koltuk planı – birleştirilmiş veri modeli + generic plan config.
 * Parkett, Empore Mitte (sol/sağ), Seitensempore (sol/sağ), Empore Hinten.
 */

import type { SalonPlanConfig, LinearRow, EmporeHintenRow } from "./types";

export type { LinearRow, BlockRow, EmporeHintenRow } from "./types";

export interface MusensaalPlan {
  parkett: { rows: LinearRow[] };
  emporeMitte: {
    left: { rows: LinearRow[] };
    right: { rows: LinearRow[] };
  };
  seitenEmporeLinks: { rows: LinearRow[] };
  seitenEmporeRechts: { rows: LinearRow[] };
  emporeHinten: { rows: EmporeHintenRow[] };
}

// Parkett: 29 sıra. Resmi plana göre (Staatsphilharmonie PDF) 20 koltuk eksik olacak şekilde:
// 1–13. sıra 28 koltuk, 14–23. sıra 27 koltuk, 24–29. sıra 29 koltuk → toplam 808 (önceki 828’den 20 az)
const parkettRows: LinearRow[] = Array.from({ length: 29 }, (_, i) => {
  const row = i + 1;
  const seats = row <= 13 ? 28 : row <= 23 ? 27 : 29;
  return { row, seats };
});

export const musensaal: MusensaalPlan = {
  parkett: {
    rows: parkettRows,
  },

  emporeMitte: {
    left: {
      rows: [
        { row: 1, seats: 13 },
        { row: 2, seats: 15 },
        { row: 3, seats: 15 },
        { row: 4, seats: 15 },
      ],
    },
    right: {
      rows: [
        { row: 1, seats: 13 },
        { row: 2, seats: 15 },
        { row: 3, seats: 15 },
        { row: 4, seats: 15 },
      ],
    },
  },

  // Seitensempore Links: 120 koltuk — 3 sıra. 1. sıra 44 (sahneye bakan), 2. sıra 40, 3. sıra 36
  seitenEmporeLinks: {
    rows: [
      { row: 1, seats: 44 },
      { row: 2, seats: 40 },
      { row: 3, seats: 36 },
    ],
  },

  // Seitensempore Rechts: 120 koltuk — solun aynası
  seitenEmporeRechts: {
    rows: [
      { row: 1, seats: 44 },
      { row: 2, seats: 40 },
      { row: 3, seats: 36 },
    ],
  },

  emporeHinten: {
    rows: [
      { row: 5, left: 6, middle: 13, right: 6 },
      { row: 6, left: 6, middle: 13, right: 6 },
      { row: 7, left: 6, middle: 13, right: 6 },
      { row: 8, left: 6, middle: 13, right: 6 },
      { row: 9, left: 6, middle: 13, right: 6 },
      { row: 10, left: 6, middle: 13, right: 6 },
      { row: 11, left: 6, middle: 13, right: 6 },
      { row: 12, left: 5, middle: 11, right: 5 },
    ],
  },
};

/** Generic SalonPlanViewer için tam config – referans plandaki gibi sol/sağ 4’er Eingang, fuaye 4+4 kapı */
export const musensaalPlanConfig: SalonPlanConfig = {
  id: "musensaal",
  name: "Musensaal (Rosengarten Mannheim)",
  layout: "musensaal",
  stageLabel: "BÜHNE",
  parkett: musensaal.parkett,
  parkettAisleAfterRows: [3, 7, 13, 20],
  eingangLeft: [
    { row: 4, label: "A" },
    { row: 11, label: "B" },
    { row: 18, label: "C" },
    { row: 24, label: "D" },
  ],
  eingangRight: [
    { row: 4, label: "A" },
    { row: 10, label: "B" },
    { row: 17, label: "C" },
    { row: 24, label: "D" },
  ],
  emporeMitte: musensaal.emporeMitte,
  emporeMitteLabels: { left: "Empore Mitte Sol", right: "Empore Mitte Sağ" },
  seitenEmporeLinks: {
    label: "Seitensempore Links",
    labelLines: ["Seitens", "empore", "Links"],
    prefix: "SEL",
  },
  seitenEmporeRechts: {
    label: "Seitensempore Rechts",
    labelLines: ["Seitens", "empore", "Rechts"],
    prefix: "SER",
  },
  emporeHinten: musensaal.emporeHinten,
  emporeHintenLabel: "Empore Hinten",
  foyer: {
    label: "Fuaye",
    doorsLeft: 4,
    doorsRight: 4,
    centralDoors: true,
  },
};
