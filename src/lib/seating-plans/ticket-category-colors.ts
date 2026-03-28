/**
 * Oturum planı önizlemesi (yonetim) ve etkinlik salon görünümünde aynı kategori renkleri.
 * Tam eşleşme + bileşik isimler (örn. "Blok A vip", "Parkett Kategori 2").
 */

const KATEGORI_HEX: Record<number, string> = {
  1: "#f43f5e",
  2: "#3b82f6",
  3: "#10b981",
  4: "#06b6d4",
  5: "#d946ef",
  6: "#84cc16",
  7: "#f97316",
  8: "#8b5cf6",
  9: "#ec4899",
  10: "#14b8a6",
};

/** Tailwind amber-500 — VIP */
const VIP_HEX = "#f59e0b";
const DEFAULT_HEX = "#64748b";

function normalize(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Bilet / kategori etiketinden dolgu rengi (#RRGGBB).
 */
export function getTicketCategoryColorHex(raw: string): string {
  const key = normalize(raw);
  if (!key) return DEFAULT_HEX;
  if (key === "vip" || key === "vip bilet" || /\bvip\b/.test(key)) return VIP_HEX;
  const km = key.match(/kategori\s*(\d{1,2})\b/i);
  if (km) {
    const n = Number(km[1]);
    if (n >= 1 && n <= 10) return KATEGORI_HEX[n] ?? DEFAULT_HEX;
  }
  return DEFAULT_HEX;
}

export function lightenHex(hex: string, amount: number): string {
  const h = hex.replace("#", "").slice(0, 6);
  if (h.length !== 6) return hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if ([r, g, b].some((x) => Number.isNaN(x))) return hex;
  const t = Math.min(1, Math.max(0, amount));
  const lr = Math.round(r + (255 - r) * t);
  const lg = Math.round(g + (255 - g) * t);
  const lb = Math.round(b + (255 - b) * t);
  return `#${lr.toString(16).padStart(2, "0")}${lg.toString(16).padStart(2, "0")}${lb.toString(16).padStart(2, "0")}`;
}

export function darkenHex(hex: string, amount: number): string {
  const h = hex.replace("#", "").slice(0, 6);
  if (h.length !== 6) return hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if ([r, g, b].some((x) => Number.isNaN(x))) return hex;
  const t = Math.min(1, Math.max(0, amount));
  const lr = Math.round(r * (1 - t));
  const lg = Math.round(g * (1 - t));
  const lb = Math.round(b * (1 - t));
  return `#${lr.toString(16).padStart(2, "0")}${lg.toString(16).padStart(2, "0")}${lb.toString(16).padStart(2, "0")}`;
}
