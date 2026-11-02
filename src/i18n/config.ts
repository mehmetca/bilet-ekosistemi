/**
 * Dil listesi ve çeviri fallback — tek kaynak.
 * URL / yönlendirme davranışı: `routing.ts` içindeki `defineRouting` (defaultLocale: de, localeDetection: false).
 *
 * Eksik anahtar: `loadMessagesWithEnFallback` ile `en.json` tabanı üzerine locale dosyası bindirilir;
 * böylece tr, de, ku, ckb ve en için eksik çeviriler İngilizce’ye düşer.
 */
export const locales = ["tr", "de", "en", "ku", "ckb"] as const;

export type AppLocale = (typeof locales)[number];

/** Mesaj birleştirmede taban dil (next-intl “fallback” kaynağı). */
export const fallbackLocale = "en" as const satisfies AppLocale;

/** Sunucuya gelen serbest dil metnini tanınan locale'e indirger (kapı satışı/panel → tr). */
export function normalizeAppLocale(value: unknown, fallback: AppLocale = "tr"): AppLocale {
  const raw = String(value ?? "").trim().toLowerCase();
  return (locales as readonly string[]).includes(raw) ? (raw as AppLocale) : fallback;
}

/**
 * Özet yapı (mesaj fallback = İngilizce; site varsayılan dili = Almanca).
 * `localeDetection` ve kök URL locale değerleri `routing.ts` ile aynı tutulmalı.
 */
export const i18n = {
  locales: [...locales],
  /** Çeviri dosyasında eksik anahtar → `en.json` ile tamamlanır (`load-messages.ts`). */
  fallbackLocale,
  /** next-intl routing: önek yoksa /de/… (middleware; `routing.ts`). */
  defaultLocale: "de" as const satisfies AppLocale,
  localeDetection: false as const,
} as const;
