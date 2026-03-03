/**
 * Google Maps embed'den iframe src URL'sini çıkarır.
 * Kullanıcı tam iframe HTML veya sadece embed URL yapıştırabilir.
 */
export function extractMapEmbedUrl(input: string | null | undefined): string | null {
  if (!input || typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Zaten embed URL ise (https://www.google.com/maps/embed?pb=...)
  if (trimmed.startsWith("https://www.google.com/maps/embed")) {
    const url = trimmed.split(/\s/)[0] || trimmed;
    return url.replace(/["'<>]/g, "") || null;
  }

  // iframe src="..." içinden URL çıkar
  const srcMatch = trimmed.match(/src=["']([^"']+)["']/i);
  if (srcMatch && srcMatch[1]?.includes("google.com/maps/embed")) {
    return srcMatch[1];
  }

  return null;
}
