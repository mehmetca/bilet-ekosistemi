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

/** Yerel takvim günü → gg.aa.yyyy (filtre başlığı vb.) */
export function formatEventDateDMYFromDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  return `${dd}.${mm}.${yyyy}`;
}

/**
 * Etkinlik tarihi: YYYY-MM-DD veya ISO → gg.aa.yyyy (UTC kayması olmadan tarih kısmı öncelikli).
 */
export function formatEventDateDMY(raw: string | null | undefined): string {
  if (raw == null || raw === "") return "";
  const s = String(raw).trim();
  const datePart = s.includes("T") ? s.split("T")[0]! : s.slice(0, 10);
  const m = datePart.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) {
    const yyyy = m[1];
    const mm = m[2].padStart(2, "0");
    const dd = m[3].padStart(2, "0");
    return `${dd}.${mm}.${yyyy}`;
  }
  const dt = new Date(s);
  if (!Number.isNaN(dt.getTime())) {
    return formatEventDateDMYFromDate(dt);
  }
  return s;
}

/** Etkinlik günü + saat (yerel parse) geçmişte mi — ana sayfa / slider / öne çıkanlar için ortak. */
export function isEventPastByLocalDateTime(
  dateStr: string | null | undefined,
  timeStr: string | null | undefined,
  now: Date = new Date()
): boolean {
  const ds = String(dateStr ?? "").trim();
  if (!ds) return false;
  const eventDateTime = new Date(`${ds} ${String(timeStr ?? "00:00").trim() || "00:00"}`);
  if (Number.isNaN(eventDateTime.getTime())) return false;
  return eventDateTime < now;
}
