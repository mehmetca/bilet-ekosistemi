/**
 * /yonetim altında rol bazlı yol kontrolleri.
 * Admin: kısıtlama yok (layout’ta öncelik).
 * Organizatör (admin değil): yalnızca kendi menüsü + alt yollar.
 * Kontrolör (admin ve organizatör değil): yalnızca bilet kontrolü.
 */

export function normalizeYonetimPath(pathname: string | null): string {
  const raw = (pathname || "").split("?")[0] || "";
  if (!raw || raw === "/") return "/";
  const trimmed = raw.replace(/\/+$/, "");
  return trimmed || "/";
}

const ORGANIZER_EXACT = new Set(["/yonetim"]);

const ORGANIZER_PREFIXES = [
  "/yonetim/etkinlikler",
  "/yonetim/mekanlar",
  "/yonetim/satis-raporu",
  "/yonetim/bilet-ozeti",
  "/yonetim/bilet-kontrol",
  "/yonetim/bilgilerim",
];

/** Organizatör menüsü (OrganizerLayout) ile uyumlu; admin olmayan organizatör bu yollarla sınırlı. */
export function isPathAllowedForOrganizer(pathname: string | null): boolean {
  const p = normalizeYonetimPath(pathname);
  if (ORGANIZER_EXACT.has(p)) return true;
  return ORGANIZER_PREFIXES.some((prefix) => p === prefix || p.startsWith(`${prefix}/`));
}

/** Sadece kontrolör hesabı: bilet kontrolü ve kılavuz. */
export function isPathAllowedForControllerOnly(pathname: string | null): boolean {
  const p = normalizeYonetimPath(pathname);
  return p === "/yonetim/bilet-kontrol" || p.startsWith("/yonetim/bilet-kontrol/");
}
