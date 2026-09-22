import { NextRequest, NextResponse } from "next/server";
import bwipjs from "bwip-js";

/**
 * In-memory rate limiter: IP başına dakikada MAX_REQUESTS istek.
 * Next.js serverless ortamında instance başına çalışır; production'da
 * Redis tabanlı bir çözüme geçilebilir.
 */
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 dakika
const MAX_REQUESTS_PER_WINDOW = 30;

const rateLimitMap = new Map<string, { count: number; windowStart: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }
  entry.count++;
  return true;
}

/** Geçerli bilet kodu formatı: BLT- ile başlayan veya alfanümerik 4-32 karakter. */
function isValidBarcodeInput(code: string): boolean {
  return /^[A-Z0-9\-]{4,32}$/i.test(code);
}

/**
 * Bilet kodu için Code128 barkod PNG döner.
 * GET /api/barcode?code=XXX
 * - Rate limit: IP başına dakikada 30 istek
 * - Kod formatı: alfanümerik, 4-32 karakter
 */
export async function GET(request: NextRequest) {
  // Rate limit kontrolü
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  if (!checkRateLimit(ip)) {
    return new NextResponse("Too many requests", {
      status: 429,
      headers: { "Retry-After": "60" },
    });
  }

  const code = request.nextUrl.searchParams.get("code");
  if (!code || typeof code !== "string" || !isValidBarcodeInput(code)) {
    return new NextResponse("Invalid code", { status: 400 });
  }

  try {
    const buffer = await bwipjs.toBuffer({
      bcid: "code128",
      text: code,
      scale: 2,
      height: 18,
      rotate: "R",
      includetext: false,
      paddingwidth: 0,
      paddingheight: 0,
      backgroundcolor: "FFFFFF",
    });

    const bytes = new Uint8Array(buffer.length);
    bytes.set(buffer as Uint8Array);
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return new NextResponse("Barcode generation failed", { status: 500 });
  }
}
