import { NextRequest, NextResponse } from "next/server";

type TranslateBody = {
  text?: string;
  source?: string;
  target?: string;
};

/**
 * Google'ın resmi olmayan GTX uç noktası IP/host bazlı hız sınırına (429)
 * takılabilir. Birden fazla ana bilgisayar + kısa üstel bekleme + önbellek
 * kullanarak 429 hatalarını büyük ölçüde azaltır.
 */
const ENDPOINTS = [
  "https://translate.googleapis.com/translate_a/single?client=gtx",
  "https://translate.google.com/translate_a/single?client=gtx",
  "https://translate.google.de/translate_a/single?client=gtx",
];

const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 gün (aynı metin tekrar Google'a gitmez)
const MAX_CACHE_SIZE = 2000;
const translationCache = new Map<string, { text: string; expiresAt: number }>();

function cacheKey(source: string, target: string, text: string): string {
  return `${source}\u0000${target}\u0000${text}`;
}

function parseGoogleTranslateResponse(payload: unknown): string {
  if (!Array.isArray(payload) || !Array.isArray(payload[0])) return "";
  const chunks = payload[0] as Array<unknown>;
  const out: string[] = [];
  for (const chunk of chunks) {
    if (Array.isArray(chunk) && typeof chunk[0] === "string") {
      out.push(chunk[0]);
    }
  }
  return out.join("").trim();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function translateWithGoogle(
  text: string,
  source: string,
  target: string
): Promise<string> {
  const maxAttempts = 4;
  let lastStatus = 0; // 0 = HTTP dışı (ağ) hatası

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const base = ENDPOINTS[attempt % ENDPOINTS.length];
    const url =
      `${base}&sl=${encodeURIComponent(source)}&tl=${encodeURIComponent(target)}` +
      `&q=${encodeURIComponent(text)}`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: "GET",
        cache: "no-store",
        headers: {
          "User-Agent": "Mozilla/5.0",
        },
      });
    } catch {
      // Ağ hatası: diğer ana bilgisayarda dene
      if (attempt < maxAttempts - 1) {
        await sleep(Math.min(300 * 2 ** attempt, 2000));
      }
      continue;
    }

    if (response.ok) {
      const payload = (await response.json()) as unknown;
      const translatedText = parseGoogleTranslateResponse(payload);
      if (translatedText) return translatedText;
      lastStatus = 0; // Boş yanıt: diğer ana bilgisayarda dene
    } else {
      lastStatus = response.status;
    }

    // 429 (hız sınırı) ve 5xx geçicidir; kısa bekleme ile tekrar dene.
    if (attempt < maxAttempts - 1 && (lastStatus === 429 || lastStatus >= 500)) {
      const retryAfter = Number(response.headers.get("retry-after") || "0");
      const delayMs = retryAfter > 0 ? retryAfter * 1000 : Math.min(300 * 2 ** attempt, 2000);
      await sleep(delayMs);
    }
  }

  throw new Error(
    lastStatus ? `Çeviri servisi hatası: ${lastStatus}` : "Çeviri servisine ulaşılamadı."
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as TranslateBody;
    const text = String(body.text || "").trim();
    const source = String(body.source || "auto").trim();
    const target = String(body.target || "").trim();

    if (!text) {
      return NextResponse.json({ error: "Metin boş olamaz." }, { status: 400 });
    }
    if (!target) {
      return NextResponse.json({ error: "Hedef dil zorunludur." }, { status: 400 });
    }

    const key = cacheKey(source, target, text);
    const cached = translationCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return NextResponse.json({ translatedText: cached.text });
    }

    const translatedText = await translateWithGoogle(text, source, target);

    translationCache.set(key, { text: translatedText, expiresAt: Date.now() + CACHE_TTL_MS });
    if (translationCache.size > MAX_CACHE_SIZE) {
      const oldestKey = translationCache.keys().next().value;
      if (oldestKey) translationCache.delete(oldestKey);
    }

    return NextResponse.json({ translatedText });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = message.includes("Çeviri") ? 502 : 500;
    return NextResponse.json(
      { error: message || "Çeviri sırasında beklenmeyen hata oluştu." },
      { status }
    );
  }
}
