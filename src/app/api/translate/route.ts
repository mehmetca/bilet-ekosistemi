import { NextRequest, NextResponse } from "next/server";

type TranslateBody = {
  text?: string;
  source?: string;
  target?: string;
};

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

    const url =
      `https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&sl=${encodeURIComponent(source)}` +
      `&tl=${encodeURIComponent(target)}&q=${encodeURIComponent(text)}`;

    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Çeviri servisi hatası: ${response.status}` },
        { status: 502 }
      );
    }

    const payload = (await response.json()) as unknown;
    const translatedText = parseGoogleTranslateResponse(payload);
    if (!translatedText) {
      return NextResponse.json({ error: "Çeviri metni alınamadı." }, { status: 502 });
    }
    return NextResponse.json({ translatedText });
  } catch {
    return NextResponse.json({ error: "Çeviri sırasında beklenmeyen hata oluştu." }, { status: 500 });
  }
}
