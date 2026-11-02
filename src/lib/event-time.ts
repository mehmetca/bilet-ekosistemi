/** Etkinlik başlangıcı geçti mi? Saat yoksa gün sonu kabul edilir. */
export function isEventPast(
  date: string | null | undefined,
  time: string | null | undefined,
  now: Date = new Date()
): boolean {
  if (!date) return false;
  const stamp = new Date(`${date.slice(0, 10)} ${time?.trim() || "23:59"}`);
  if (Number.isNaN(stamp.getTime())) return false;
  return stamp < now;
}
