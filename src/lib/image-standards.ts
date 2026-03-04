/**
 * Görsel optimizasyon standartları
 * Format, boyut ve önerilen çözünürlükler
 */

export const IMAGE_STANDARDS = {
  /** Maksimum dosya boyutu (byte) - 2MB önerilen web performansı için */
  MAX_FILE_SIZE: 2 * 1024 * 1024,
  /** Yedek limit - API'de 5MB kabul edilebilir */
  MAX_FILE_SIZE_FALLBACK: 5 * 1024 * 1024,
  /** İzin verilen MIME tipleri */
  ALLOWED_TYPES: ["image/jpeg", "image/jpg", "image/png", "image/webp"] as const,
  /** İzin verilen uzantılar */
  ALLOWED_EXTENSIONS: [".jpg", ".jpeg", ".png", ".webp"],
  /** Önerilen boyutlar (genişlik x yükseklik) */
  RECOMMENDED: {
    /** Etkinlik kartı / liste */
    EVENT_CARD: { width: 800, height: 450 },
    /** Etkinlik detay hero */
    EVENT_DETAIL: { width: 1200, height: 630 },
    /** OG/Sosyal paylaşım */
    OG_IMAGE: { width: 1200, height: 630 },
    /** Reklam banner */
    AD_BANNER: { width: 1200, height: 400 },
    /** Haber görseli */
    NEWS: { width: 800, height: 450 },
    /** Mekan oturum planı */
    VENUE_LAYOUT: { width: 800, height: 600 },
  },
} as const;

export function validateImageFile(file: File, strict = false): string | null {
  const maxSize = strict ? IMAGE_STANDARDS.MAX_FILE_SIZE : IMAGE_STANDARDS.MAX_FILE_SIZE_FALLBACK;
  if (file.size > maxSize) {
    return strict
      ? `Dosya boyutu 2MB'dan küçük olmalı (önerilen)`
      : `Dosya boyutu ${Math.round(maxSize / 1024 / 1024)}MB'dan küçük olmalı`;
  }
  if (!IMAGE_STANDARDS.ALLOWED_TYPES.includes(file.type as (typeof IMAGE_STANDARDS.ALLOWED_TYPES)[number])) {
    return "Sadece JPG, PNG veya WebP formatında resim yüklenebilir";
  }
  return null;
}

export function getImageHint(context: keyof typeof IMAGE_STANDARDS.RECOMMENDED): string {
  const r = IMAGE_STANDARDS.RECOMMENDED[context];
  return `Önerilen: ${r.width}×${r.height}px, max 2MB, JPG/PNG/WebP`;
}
