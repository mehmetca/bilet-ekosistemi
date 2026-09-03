/**
 * Yükleme öncesi görseli tarayıcıda küçültür/sıkıştırır.
 * Amaç: 3–5 MB'lık fotoğrafları ~200–600 KB'ye indirerek hem Supabase
 * egress'ini hem ziyaretçi bant genişliğini azaltmak.
 */

const REENCODE_MAX_BYTES = 500 * 1024; // bu boyutun altındakiler olduğu gibi yüklenir
const QUALITY = 0.82;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Görsel okunamadı"));
    img.src = src;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Görseli `maxDimension` genişlik/yüksekliğe ölçekleyip WebP (desteklenmezse
 * JPEG/PNG) olarak yeniden kodlar. Küçük dosyalara dokunmaz.
 */
export async function compressImageFile(
  file: File,
  maxDimension = 1600
): Promise<File> {
  try {
    if (file.size <= REENCODE_MAX_BYTES) return file;

    const objectUrl = URL.createObjectURL(file);
    let img: HTMLImageElement;
    try {
      img = await loadImage(objectUrl);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }

    const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
    const width = Math.max(1, Math.round(img.width * scale));
    const height = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, width, height);

    let blob: Blob | null = await canvasToBlob(canvas, "image/webp", QUALITY);
    let mime = "image/webp";

    if (!blob && file.type !== "image/png") {
      blob = await canvasToBlob(canvas, "image/jpeg", QUALITY);
      mime = "image/jpeg";
    }
    // WebP desteklenmiyorsa ve orijinal PNG ise şeffaflığı korumak için
    // dönüştürmeden yükleyelim.
    if (!blob) return file;

    if (blob.size >= file.size) return file;

    const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
    const ext = mime === "image/webp" ? "webp" : mime === "image/jpeg" ? "jpg" : "png";
    return new File([blob], `${baseName}.${ext}`, { type: mime });
  } catch {
    // Herhangi bir hata olursa orijinal dosyayla devam et.
    return file;
  }
}
