/**
 * Bilet sıralama yardımcıları (client + server tarafında kullanılabilir).
 *
 * VIP daima en üstte (rank 100), Kategori 1..10 rank 101..110.
 * Standart sabit isimler (events-server.ts'deki TICKET_DISPLAY_ORDER) listenin başında.
 * Salon planından türemiş bileşik adlar (örn. "Orta salon - VIP", "Sahne arkası Kategori 3")
 * tanınır ve doğru sıralanır.
 */

export const TICKET_DISPLAY_ORDER = [
  "Normal / Standart Bilet",
  "Standart Bilet",
  "Normal Bilet",
  "VIP Bilet",
  "Kategori 1",
  "Kategori 2",
  "Kategori 3",
  "Kategori 4",
  "Kategori 5",
  "Kategori 6",
  "Kategori 7",
  "Kategori 8",
  "Kategori 9",
  "Kategori 10",
] as const;

export function getTicketSortRank(name?: string): number {
  const trimmed = (name || "").trim();
  const idx = TICKET_DISPLAY_ORDER.findIndex((item) => item === trimmed);
  if (idx !== -1) return idx;
  const low = trimmed.toLowerCase();
  if (/(^|[\s\-_,/])vip([\s\-_,/]|$)/i.test(trimmed) || low.endsWith("vip")) {
    return 100;
  }
  const m = low.match(/kategori\s*([0-9]{1,2})/i);
  if (m) {
    const n = Number.parseInt(m[1]!, 10);
    if (Number.isFinite(n) && n >= 1 && n <= 10) return 100 + n;
  }
  return 999;
}
