/**
 * Salon plan registry – 50–60 salon eklemek için sadece veri ekleyin.
 *
 * Yeni salon ekleme:
 * 1. src/lib/seating-plans/ altında yeni dosya (örn. salon-xyz.ts) açın.
 * 2. types.ts'teki SalonPlanConfig ile uyumlu bir config oluşturun (layout: "musensaal" veya ileride eklenen başka tip).
 * 3. Aşağıdaki plans dizisine ekleyin: import { xyzPlanConfig } from "./salon-xyz"; plans.push(xyzPlanConfig);
 * 4. Önizleme: getPlan("xyz") ile alıp SalonPlanViewer'a verin; sayfa route'u isterseniz yonetim/mekanlar/[planId]-onizleme gibi tek sayfaya da bağlanabilir.
 *
 * Yeni React component yazmaya gerek yok.
 */

import type { SalonPlanConfig } from "./types";
import { musensaalPlanConfig } from "./musensaal";

const plans: SalonPlanConfig[] = [
  musensaalPlanConfig,
];

export type { SalonPlanConfig } from "./types";
export { musensaal, musensaalPlanConfig } from "./musensaal";

export function getAllPlans(): SalonPlanConfig[] {
  return [...plans];
}

export function getPlan(id: string): SalonPlanConfig | undefined {
  return plans.find((p) => p.id === id);
}
