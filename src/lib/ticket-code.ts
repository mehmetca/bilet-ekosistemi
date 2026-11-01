import { randomBytes } from "crypto";

const BLT_PATTERN = /BLT\s*-\s*([A-Z0-9]+)/i;

/** Kriptografik güvenli bilet kodu: BLT- + 8 karakter (0/O/1/I yok, tahmin edilemez). */
export function generateTicketCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "BLT-";
  const bytes = randomBytes(8);
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(bytes[i]! % chars.length);
  }
  return code;
}

function normalizeBltText(raw: string): string {
  const compact = raw.trim().toUpperCase().replace(/\s+/g, "");
  const match = compact.match(/BLT-?([A-Z0-9]+)/);
  if (match?.[1]) {
    return `BLT-${match[1]}`;
  }
  return compact;
}

export function extractTicketCode(rawInput: string): string {
  let value = String(rawInput || "").trim();
  if (!value) return "";

  // URL format: https://domain/kontrol?code=BLT-XXXX
  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      const fromQuery = url.searchParams.get("code");
      if (fromQuery) value = fromQuery;
    } catch {
      // continue with original value
    }
  } else if (value.startsWith("{") && value.endsWith("}")) {
    // Backward compatibility for legacy JSON QR payloads.
    try {
      const parsed = JSON.parse(value) as { code?: unknown };
      if (typeof parsed.code === "string") value = parsed.code;
    } catch {
      // continue with original value
    }
  }

  const explicitBlt = value.match(BLT_PATTERN);
  if (explicitBlt?.[1]) {
    return `BLT-${explicitBlt[1].toUpperCase()}`;
  }

  return normalizeBltText(value);
}
