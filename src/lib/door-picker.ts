/** Gişe ve kapı kontrol listeleri bu tarihten itibaren gelen etkinlikleri görür. */
export function doorPickerFromDate(now: Date = new Date()): string {
  const d = new Date(now.getTime());
  // Gece yarısına sarkan etkinlik listenin başından düşmesin.
  d.setDate(d.getDate() - 1);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}
