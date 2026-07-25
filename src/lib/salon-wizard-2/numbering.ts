import type { HalfSplitPrefer, NumberingMode, SeatDirection, Wizard2Section } from "./types";

/**
 * Bir sıradaki koltuk etiketlerini üretir.
 * Dizi sırası her zaman sahneye bakarken soldan sağa görsel sıradır.
 * `direction` hangi uçtan numaralamanın başlayacağını belirler.
 */
export function buildSeatLabelsForRow(
  seatCount: number,
  mode: NumberingMode,
  direction: SeatDirection,
  options?: {
    evenUntilNumber?: number;
    halfSplitPrefer?: HalfSplitPrefer;
  }
): string[] {
  const n = Math.max(0, Math.floor(seatCount));
  if (n === 0) return [];

  const evenUntil = Math.max(2, Math.floor(options?.evenUntilNumber ?? 8));
  const halfPrefer = options?.halfSplitPrefer ?? "left_odd";

  let fromStart: number[];

  switch (mode) {
    case "odd": {
      fromStart = Array.from({ length: n }, (_, i) => 1 + i * 2);
      break;
    }
    case "even": {
      fromStart = Array.from({ length: n }, (_, i) => 2 + i * 2);
      break;
    }
    case "half_split": {
      const leftCount = Math.ceil(n / 2);
      const rightCount = n - leftCount;
      const leftOdd = halfPrefer === "left_odd";
      const left = Array.from({ length: leftCount }, (_, i) => (leftOdd ? 1 : 2) + i * 2);
      const right = Array.from({ length: rightCount }, (_, i) => (leftOdd ? 2 : 1) + i * 2);
      fromStart = [...left, ...right];
      break;
    }
    case "even_until": {
      const labels: number[] = [];
      let nextEven = 2;
      let nextOdd = 1;
      for (let i = 0; i < n; i++) {
        if (nextEven <= evenUntil) {
          labels.push(nextEven);
          nextEven += 2;
        } else {
          labels.push(nextOdd);
          nextOdd += 2;
        }
      }
      fromStart = labels;
      break;
    }
    case "sequential":
    default: {
      fromStart = Array.from({ length: n }, (_, i) => i + 1);
      break;
    }
  }

  if (direction === "rtl") {
    return [...fromStart].reverse().map(String);
  }
  return fromStart.map(String);
}

export function rowLabelForIndex(section: Wizard2Section, rowIndex: number): string {
  return String(section.rowLabelStart + rowIndex);
}

export function blockedKey(rowLabel: string, seatLabel: string): string {
  return `${rowLabel}:${seatLabel}`;
}

export function isSeatBlocked(section: Wizard2Section, rowLabel: string, seatLabel: string): boolean {
  const keys = Array.isArray(section.salesBlockedKeys) ? section.salesBlockedKeys : [];
  return keys.includes(blockedKey(rowLabel, seatLabel));
}

export type PreviewSeat = {
  label: string;
  blocked: boolean;
};

export type PreviewRow = {
  rowLabel: string;
  seats: PreviewSeat[];
  /** Bu sıradan sonra yatay koridor */
  aisleAfter: boolean;
};

export function buildSectionPreview(section: Wizard2Section): PreviewRow[] {
  const rows: PreviewRow[] = [];
  const rowCount = Math.max(0, Math.floor(Number(section.rowCount) || 0));
  const seatsPerRow = Math.max(0, Math.floor(Number(section.seatsPerRow) || 0));
  const aisleList = Array.isArray(section.aisleAfterRowNumbers) ? section.aisleAfterRowNumbers : [];
  const aisleSet = new Set(aisleList.map(String));

  for (let r = 0; r < rowCount; r++) {
    const rowLabel = rowLabelForIndex(section, r);
    const labels = buildSeatLabelsForRow(
      seatsPerRow,
      section.numberingMode || "sequential",
      section.direction || "ltr",
      {
        evenUntilNumber: section.evenUntilNumber,
        halfSplitPrefer: section.halfSplitPrefer,
      }
    );
    rows.push({
      rowLabel,
      seats: labels.map((label) => ({
        label,
        blocked: isSeatBlocked(section, rowLabel, label),
      })),
      aisleAfter: aisleSet.has(rowLabel),
    });
  }
  return rows;
}
