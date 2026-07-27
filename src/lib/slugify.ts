/**
 * URL slug üretimi: Türkçe/Almanca karakterleri ASCII'ye çevirir.
 * Örn. "Ayfer Düzdaş" → "ayfer-duzdas"
 */
export function slugify(value: string): string {
  return value
    .toLocaleLowerCase("tr-TR")
    .trim()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ß/g, "ss")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
