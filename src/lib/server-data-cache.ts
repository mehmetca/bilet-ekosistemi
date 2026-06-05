/** Sayfa ISR süreleriyle uyumlu unstable_cache revalidate değerleri (saniye). */
export const DATA_CACHE_REVALIDATE = {
  home: 1800,
  city: 300,
  calendar: 1800,
  event: 1800,
  sitemap: 21600,
  cities: 1800,
} as const;
