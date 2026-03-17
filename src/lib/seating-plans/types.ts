/**
 * Generic salon plan şeması – 50–60 salonu tek viewer ile veriyle çizmek için.
 * Yeni salon = yeni veri dosyası + registry'ye ekleme; yeni component yok.
 */

export interface LinearRow {
  row: number;
  seats: number;
}

export interface BlockRow {
  row: number;
  blocks: number[];
}

export interface EmporeHintenRow {
  row: number;
  left: number;
  middle: number;
  right: number;
}

/** Parkett sırasında "Eingang X" etiketinin hangi sırada görüneceği */
export interface EingangLabel {
  row: number;
  label: string;
}

export interface FoyerConfig {
  label?: string;
  /** Fuaye dış duvarında soldaki kapı sayısı (dikey dağıtılır) */
  doorsLeft: number;
  /** Fuaye dış duvarında sağdaki kapı sayısı */
  doorsRight: number;
  /** Ortada çift kanatlı kapı göster */
  centralDoors?: boolean;
}

/** Seitensempore: etiket ve koltuk id prefix (musensaal’de 4 bölüm × 3 sıra sabit) */
export interface SeitenEmporeConfig {
  label: string;
  /** Çok satırlı başlık (örn. ["Seitens", "empore", "Rechts"]) */
  labelLines?: string[];
  prefix: string; // "SEL" | "SER"
}

export type SalonLayoutType = "musensaal";

export interface SalonPlanConfig {
  id: string;
  name: string;
  layout: SalonLayoutType;

  parkett: { rows: LinearRow[] };
  /** Parkett'te koridor boşluğu verilecek sıra numaraları */
  parkettAisleAfterRows?: number[];

  /** Sol/sağda hangi sırada hangi Eingang etiketi (örn. A,B,C,D) */
  eingangLeft: EingangLabel[];
  eingangRight: EingangLabel[];

  emporeMitte: {
    left: { rows: LinearRow[] };
    right: { rows: LinearRow[] };
  };
  emporeMitteLabels?: { left: string; right: string };

  seitenEmporeLinks: SeitenEmporeConfig;
  seitenEmporeRechts: SeitenEmporeConfig;

  emporeHinten: { rows: EmporeHintenRow[] };
  emporeHintenLabel?: string;

  foyer: FoyerConfig;

  /** Sahne etiketi */
  stageLabel?: string;
}
