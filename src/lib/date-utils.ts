/**
 * Kullanıcı girişini tarihe çevirir.
 * Desteklenen formatlar: gg.aa.yyyy, gg-aa-yyyy, gg/aa/yyyy, yyyy-aa-gg (ISO)
 */
export function parseDateInput(input: string): Date | null {
  const s = input.trim();
  if (!s) return null;

  // YYYY-MM-DD (ISO)
  const isoMatch = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10) - 1;
    const d = parseInt(isoMatch[3], 10);
    const date = new Date(y, m, d);
    return isNaN(date.getTime()) ? null : date;
  }

  // DD.MM.YYYY, DD-MM-YYYY, DD/MM/YYYY
  const dmyMatch = s.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/);
  if (dmyMatch) {
    const d = parseInt(dmyMatch[1], 10);
    const m = parseInt(dmyMatch[2], 10) - 1;
    const y = parseInt(dmyMatch[3], 10);
    const date = new Date(y, m, d);
    return isNaN(date.getTime()) ? null : date;
  }

  return null;
}

/** Tarihi YYYY-MM-DD string'e çevirir (event.date karşılaştırması için) */
export function toISODateString(date: Date): string {
  return date.toISOString().split("T")[0];
}
