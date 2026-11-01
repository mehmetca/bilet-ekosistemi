/**
 * Organizatörün fatura bilgileri. `address` kolonu DDG § 5 impressum tarafından okunuyor,
 * Rechnung ise cadde / PLZ / şehir / ülke ayrımı istiyor → bileşenler ayrı kolonlarda
 * tutulur, address bunlardan türetilir.
 */

export type OrganizerAddressParts = {
  street?: string | null;
  postcode?: string | null;
  city?: string | null;
  country_code?: string | null;
};

export function postalAddress(parts: OrganizerAddressParts): string | null {
  const line1 = (parts.street || "").trim();
  const line2 = `${(parts.postcode || "").trim()} ${(parts.city || "").trim()}`.trim();
  const country = (parts.country_code || "").trim().toUpperCase();
  const joined = [line1, line2, country].filter(Boolean).join(", ");
  return joined || null;
}
