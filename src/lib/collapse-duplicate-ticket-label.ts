/**
 * "Parket - Kategori 1 Kategori 1" / "Standart Standart" gibi bitişik tekrarları
 * liste ve sipariş özetinde sade görünüm için tekilleştirir.
 */
export function collapseDuplicateAdjacentTicketLabel(name: string): string {
  let s = name.trim();
  s = s.replace(/\b((?:Kategorie|Kategori)\s*\d+)\s+\1\b/gi, "$1");
  s = s.replace(/\b(Standart|Standard|VIP|Vip)\s+\1\b/gi, "$1");
  return s;
}
