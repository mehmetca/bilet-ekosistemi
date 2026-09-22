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
    /** Etkinlik kartı / liste (afiş 3:4) */
    EVENT_CARD: { width: 900, height: 1200 },
    /** Etkinlik detay/kapak görseli (afiş 3:4) */
    EVENT_DETAIL: { width: 1200, height: 1600 },
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

/** Dosya magic bytes (file signatures) */
const MAGIC_BYTES = {
  jpeg: [[0xFF, 0xD8, 0xFF]],
  png: [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
  webp: [[0x52, 0x49, 0x46, 0x46]],
} as const;

function checkMagicBytes(buffer: ArrayBuffer, format: keyof typeof MAGIC_BYTES): boolean {
  const signatures = MAGIC_BYTES[format];
  const bytes = new Uint8Array(buffer);

  for (const signature of signatures) {
    if (signature.every((byte, index) => bytes[index] === byte)) {
      return true;
    }
  }
  return false;
}

async function validateMagicBytes(file: File): Promise<string | null> {
  const buffer = await file.slice(0, 12).arrayBuffer();

  if (file.type === "image/jpeg" || file.type === "image/jpg") {
    if (!checkMagicBytes(buffer, "jpeg")) {
      return "Dosya geçerli bir JPEG değil (magic bytes uyuşmuyor)";
    }
  } else if (file.type === "image/png") {
    if (!checkMagicBytes(buffer, "png")) {
      return "Dosya geçerli bir PNG değil (magic bytes uyuşmuyor)";
    }
  } else if (file.type === "image/webp") {
    if (!checkMagicBytes(buffer, "webp")) {
      return "Dosya geçerli bir WebP değil (magic bytes uyuşmuyor)";
    }
  }

  return null;
}

export async function validateImageFile(file: File, strict = false): Promise<string | null> {
  const maxSize = strict ? IMAGE_STANDARDS.MAX_FILE_SIZE : IMAGE_STANDARDS.MAX_FILE_SIZE_FALLBACK;
  if (file.size > maxSize) {
    return strict
      ? `Dosya boyutu 2MB'dan küçük olmalı (önerilen)`
      : `Dosya boyutu ${Math.round(maxSize / 1024 / 1024)}MB'dan küçük olmalı`;
  }
  if (!IMAGE_STANDARDS.ALLOWED_TYPES.includes(file.type as (typeof IMAGE_STANDARDS.ALLOWED_TYPES)[number])) {
    return "Sadece JPG, PNG veya WebP formatında resim yüklenebilir";
  }

  // Magic bytes kontrolü
  const magicBytesError = await validateMagicBytes(file);
  if (magicBytesError) {
    return magicBytesError;
  }

  return null;
}

export function getImageHint(context: keyof typeof IMAGE_STANDARDS.RECOMMENDED): string {
  const r = IMAGE_STANDARDS.RECOMMENDED[context];
  return `Önerilen: ${r.width}×${r.height}px, max 2MB, JPG/PNG/WebP`;
}
