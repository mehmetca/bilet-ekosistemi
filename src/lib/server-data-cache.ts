/** Sayfa ISR süreleriyle uyumlu unstable_cache revalidate değerleri (saniye). */
export const DATA_CACHE_REVALIDATE = {
  home: 60,
  city: 60,
  calendar: 60,
  event: 60,
  sitemap: 1800,
  cities: 60,
  artists: 60,
  venues: 60,
  advertisements: 60,
  settings: 3600,
} as const;
