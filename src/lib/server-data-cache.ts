/** Sayfa ISR süreleriyle uyumlu unstable_cache revalidate değerleri (saniye). */
export const DATA_CACHE_REVALIDATE = {
  home: 120, // Ana sayfa verisi daha uzun cache
  city: 90,  // Şehir sayfası orta cache
  calendar: 120, // Takvim verisi daha uzun cache
  event: 180, // Etkinlik detay daha uzun cache
  sitemap: 3600, // Sitemap çok uzun cache
  cities: 300, // Şehirler listesi uzun cache
  artists: 180, // Sanatçılar orta-uzun cache
  venues: 300, // Mekanlar uzun cache
  advertisements: 60, // Reklamlar kısa cache (değişebilir)
  settings: 7200, // Ayarlar çok uzun cache
} as const;
