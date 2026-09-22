/**
 * In-memory rate limiter utility.
 * Next.js serverless ortamında instance başına çalışır.
 * Production'da yüksek trafik için Redis tabanlı çözüme geçilebilir.
 */

type RateLimitEntry = { count: number; windowStart: number };

const stores = new Map<string, Map<string, RateLimitEntry>>();

function getStore(name: string): Map<string, RateLimitEntry> {
  if (!stores.has(name)) {
    stores.set(name, new Map());
  }
  return stores.get(name)!;
}

export interface RateLimitOptions {
  /** Pencere süresi (ms). Varsayılan: 60_000 (1 dakika) */
  windowMs?: number;
  /** Pencere başına maksimum istek. Varsayılan: 20 */
  max?: number;
  /** Store adı (farklı endpoint'ler için ayrı sayaç) */
  name: string;
}

/**
 * IP başına rate limit kontrolü.
 * @returns true → istek kabul edilebilir, false → limit aşıldı (429 dön)
 */
export function checkRateLimit(ip: string, options: RateLimitOptions): boolean {
  const windowMs = options.windowMs ?? 60_000;
  const max = options.max ?? 20;
  const store = getStore(options.name);

  const now = Date.now();
  const entry = store.get(ip);

  if (!entry || now - entry.windowStart > windowMs) {
    store.set(ip, { count: 1, windowStart: now });
    return true;
  }

  if (entry.count >= max) {
    return false;
  }

  entry.count++;
  return true;
}

/**
 * NextRequest'ten IP adresini çıkarır.
 */
export function getClientIp(request: Request): string {
  const forwarded = (request.headers as Headers).get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? "unknown";
  return (request.headers as Headers).get("x-real-ip") ?? "unknown";
}
