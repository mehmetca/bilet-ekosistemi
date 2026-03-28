/**
 * Etkinlik sihirbazı, bilet türleri ekranı ve salon planı bölüm etiketleri için ortak isimler.
 * `tickets.name` ve `ticket_type_label` birebir eşleşmeli.
 */
export const EVENT_TICKET_TYPE_PRESET_LABELS: readonly string[] = [
  "Normal / Standart Bilet",
  "Standart Bilet",
  "VIP Bilet",
  ...Array.from({ length: 10 }, (_, i) => `Kategori ${i + 1}`),
  "İndirimli bilet (öğrenci bileti)",
  "İndirimli bilet (grup indirimli bilet)",
];
