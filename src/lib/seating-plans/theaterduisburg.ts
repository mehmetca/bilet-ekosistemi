/**
 * Theater Duisburg (veya benzeri) salon planı – görsel üzerinde overlay.
 * Görsel: BÜHNE üstte; Parkett, Ränge, Logen, Mitte bölümleri.
 * public/seatplans/theaterduisburg.png kullanılır (görseli bu isimle public/seatplans/ altına koyun).
 */

import type { ImageSeatPlanConfig, ImagePlanSectionGrid } from "./image-plan-types";
import { buildImagePlanCoordGetter } from "./image-plan-types";
import type { GetSeatCoordFn } from "./image-plan-types";

const sections: ImagePlanSectionGrid[] = [
  { name: "1. PARKETT", x: 0.26, y: 0.18, width: 0.48, height: 0.16, rows: 10, seatsPerRow: 16 },
  { name: "2. PARKETT", x: 0.22, y: 0.34, width: 0.56, height: 0.13, rows: 7, seatsPerRow: 20 },
  { name: "3. PARKETT", x: 0.2, y: 0.47, width: 0.6, height: 0.1, rows: 6, seatsPerRow: 24 },
  { name: "PARKETT", x: 0.2, y: 0.58, width: 0.6, height: 0.14, rows: 4, seatsPerRow: 20 },
  { name: "PARKETT LOGEN", x: 0.03, y: 0.2, width: 0.1, height: 0.28, rows: 8, seatsPerRow: 4 },
  { name: "PARKETT LOGEN LINKS", x: 0.03, y: 0.2, width: 0.1, height: 0.28, rows: 8, seatsPerRow: 4 },
  { name: "PARKETT LOGEN RECHTS", x: 0.87, y: 0.2, width: 0.1, height: 0.28, rows: 8, seatsPerRow: 4 },
  { name: "1. RANG", x: 0.04, y: 0.5, width: 0.1, height: 0.12, rows: 5, seatsPerRow: 6 },
  { name: "1. RANG LINKS", x: 0.04, y: 0.5, width: 0.1, height: 0.12, rows: 5, seatsPerRow: 6 },
  { name: "1. RANG RECHTS", x: 0.86, y: 0.5, width: 0.1, height: 0.12, rows: 5, seatsPerRow: 6 },
  { name: "2. RANG", x: 0.04, y: 0.62, width: 0.09, height: 0.1, rows: 3, seatsPerRow: 5 },
  { name: "2. RANG LINKS", x: 0.04, y: 0.62, width: 0.09, height: 0.1, rows: 3, seatsPerRow: 5 },
  { name: "2. RANG RECHTS", x: 0.87, y: 0.62, width: 0.09, height: 0.1, rows: 3, seatsPerRow: 5 },
  { name: "SEITE LINKS", x: 0.04, y: 0.5, width: 0.1, height: 0.22, rows: 5, seatsPerRow: 6 },
  { name: "SEITE RECHTS", x: 0.86, y: 0.5, width: 0.1, height: 0.22, rows: 5, seatsPerRow: 6 },
  { name: "MITTE LINKS", x: 0.16, y: 0.72, width: 0.3, height: 0.22, rows: 9, seatsPerRow: 14 },
  { name: "MITTE RECHTS", x: 0.54, y: 0.72, width: 0.3, height: 0.22, rows: 9, seatsPerRow: 14 },
];

export const theaterduisburgImagePlan: ImageSeatPlanConfig = {
  id: "theaterduisburg",
  name: "Theater Duisburg",
  imageUrl: "/seatplans/theaterduisburg.png",
  sections,
};

export const getTheaterDuisburgCoord: GetSeatCoordFn = buildImagePlanCoordGetter(
  theaterduisburgImagePlan
);
