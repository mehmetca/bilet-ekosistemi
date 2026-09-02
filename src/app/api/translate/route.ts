import { NextRequest, NextResponse } from "next/server";

type TranslateBody = {
  text?: string;
  source?: string;
  target?: string;
};

const GOOGLE_API_KEY = process.env.GOOGLE_TRANSLATE_API_KEY || "";

/**
 * Google'ın resmi olmayan GTX uç noktası sunucu IP'sini geçici olarak
 * bloklayabilir (429/403). Farklı host + client kombinasyonları denenir;
 * o da olmazsa ücretsiz aracılar (Lingva, MyMemory) ile devam edilir.
 * Aynı metin önbelleğe alınır.
 */
const GTX_ENDPOINTS = [
  "https://translate.googleapis.com/translate_a/single?client=gtx&dt=t",
  "https://translate.google.com/translate_a/single?client=gtx&dt=t",
  "https://translate.googleapis.com/translate_a/single?client=te&dt=t",
  "https://translate.google.com/translate_a/single?client=webapp&dt=t",
];

/** Google çevirisini kendi sunucusu üzerinden sunan ücretsiz aracılar. */
const LINGVA_INSTANCES = [
  "https://lingva.ml",
  "https://translate.plausibility.cloud",
  "https://lingva.lunar.icu",
];

const MYMEMORY_URL = "https://api.mymemory.translated.net/get";

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  Referer: "https://translate.google.com/",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
};

const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 gün
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

function parseOfficialApiResponse(payload: unknown): string {
  const translations = (
    payload as { data?: { translations?: Array<{ translatedText?: string }> } }
  )?.data?.translations;
  return translations?.[0]?.translatedText?.trim() ?? "";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  ms = 8000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Resmi Google Cloud Translation API (env: GOOGLE_TRANSLATE_API_KEY). */
async function translateOfficial(
  text: string,
  source: string,
  target: string
): Promise<string> {
  const url =
    `https://translation.googleapis.com/language/translate/v2` +
    `?key=${encodeURIComponent(GOOGLE_API_KEY)}`;
  const response = await fetchWithTimeout(
    url,
    {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: text, source, target, format: "text" }),
    },
    10000
  );
  if (!response.ok) {
    throw new Error(`Çeviri servisi hatası: ${response.status}`);
  }
  const payload = (await response.json()) as unknown;
  const translatedText = parseOfficialApiResponse(payload);
  if (!translatedText) {
    throw new Error("Çeviri metni alınamadı.");
  }
  return translatedText;
}

async function translateWithGoogle(
  text: string,
  source: string,
  target: string
): Promise<string> {
  const maxAttempts = 4;
  let lastStatus = 0; // 0 = HTTP dışı (ağ) hatası

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const endpoint = GTX_ENDPOINTS[attempt % GTX_ENDPOINTS.length];
    const url =
      `${endpoint}&sl=${encodeURIComponent(source)}&tl=${encodeURIComponent(target)}` +
      `&q=${encodeURIComponent(text)}`;

    let response: Response;
    try {
      response = await fetchWithTimeout(url, {
        method: "GET",
        cache: "no-store",
        headers: BROWSER_HEADERS,
      });
    } catch {
      // Ağ hatası: sonraki host/client'ta dene
      if (attempt < maxAttempts - 1) {
        await sleep(Math.min(300 * 2 ** attempt, 2000));
      }
      continue;
    }

    if (response.ok) {
      const payload = (await response.json()) as unknown;
      const translatedText = parseGoogleTranslateResponse(payload);
      if (translatedText) return translatedText;
      lastStatus = 0; // Boş yanıt: sonraki kombinasyonda dene
    } else {
      lastStatus = response.status;
    }

    // 429 (hız sınırı) ve 5xx geçicidir; kısa bekleme ile tekrar dene.
    if (attempt < maxAttempts - 1 && (lastStatus === 429 || lastStatus >= 500)) {
      const retryAfter = Number(response.headers.get("retry-after") || "0");
      const delayMs =
        retryAfter > 0
          ? Math.min(retryAfter * 1000, 5000)
          : Math.min(300 * 2 ** attempt, 2500);
      await sleep(delayMs);
    }
  }

  throw new Error(
    lastStatus ? `Çeviri servisi hatası: ${lastStatus}` : "Çeviri servisine ulaşılamadı."
  );
}

/** Ücretsiz Lingva aracıları (Google çevirisini kendi IP'sinden proxy'ler). */
async function tryLingva(
  text: string,
  source: string,
  target: string
): Promise<string | null> {
  for (const instance of LINGVA_INSTANCES) {
    try {
      const url =
        `${instance}/api/v1/${encodeURIComponent(source)}/${encodeURIComponent(target)}` +
        `/${encodeURIComponent(text)}`;
      const response = await fetchWithTimeout(url, {
        method: "GET",
        headers: BROWSER_HEADERS,
      });
      if (!response.ok) continue;
      const payload = (await response.json()) as { translation?: string };
      const translated = payload?.translation?.trim();
      if (translated) return translated;
    } catch {
      // Sonraki aracıyı dene
    }
  }
  return null;
}

/** Ücretsiz MyMemory (son çare; dil desteği sınırlı olabilir). */
async function tryMyMemory(
  text: string,
  source: string,
  target: string
): Promise<string | null> {
  try {
    const url =
      `${MYMEMORY_URL}?q=${encodeURIComponent(text)}` +
      `&langpair=${encodeURIComponent(`${source}|${target}`)}`;
    const response = await fetchWithTimeout(url, { method: "GET" });
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      responseStatus?: number;
      responseData?: { translatedText?: string };
    };
    if (payload?.responseStatus !== 200) return null;
    const translated = payload?.responseData?.translatedText?.trim();
    if (translated && !translated.includes("MYMEMORY WARNING")) return translated;
  } catch {
    // yoksay
  }
  return null;
}

async function translateWithFallback(
  text: string,
  source: string,
  target: string
): Promise<string> {
  const errors: string[] = [];

  if (GOOGLE_API_KEY) {
    try {
      return await translateOfficial(text, source, target);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Resmi API hatası");
    }
  }

  try {
    return await translateWithGoogle(text, source, target);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "Google GTX hatası");
  }

  try {
    const lingva = await tryLingva(text, source, target);
    if (lingva) return lingva;
    errors.push("Google erişimi geçici olarak engellenmiş olabilir");
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "Lingva hatası");
  }

  try {
    const myMemory = await tryMyMemory(text, source, target);
    if (myMemory) return myMemory;
    errors.push("Ücretsiz alternatifler çeviri döndürmedi");
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "MyMemory hatası");
  }

  throw new Error(errors.join(" / "));
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

    const translatedText = await translateWithFallback(text, source, target);

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
