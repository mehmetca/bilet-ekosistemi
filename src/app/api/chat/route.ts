import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import fs from "fs";
import path from "path";
import { requireRole } from "@/lib/api-auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { publicErrorMessage } from "@/lib/api-error";

export const runtime = "nodejs";

const PROJECT_ROOT = path.resolve(process.cwd());
const MAX_OKU_BYTES = 256 * 1024;
const MAX_HISTORY = 20;
const MAX_MESSAGE_CHARS = 2000;
const MAX_PROMPT_CHARS = 8000;

/** "oku:" yalnızca scripts/ altındaki noktasız dosyaları açar; .. ve mutlak yol elenir. */
function resolveReadable(dosyaYolu: string): string | null {
  const target = path.resolve(PROJECT_ROOT, dosyaYolu);
  const rel = path.relative(PROJECT_ROOT, target);
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) return null;
  const segments = rel.split(path.sep);
  if (segments[0] !== "scripts") return null;
  if (segments.some((s) => s.startsWith("."))) return null;
  return target;
}

/** Sahte system mesajı enjeksiyonunu keser: yalnızca user/assistant geçmişi kabul edilir. */
function sanitizeHistory(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (m): m is { role: "user" | "assistant"; content: string } =>
        (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string"
    )
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_CHARS) }));
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    if (!checkRateLimit(ip, { name: "ai-chat", windowMs: 60_000, max: 10 })) {
      return NextResponse.json(
        { error: "Çok fazla istek. Lütfen bir dakika bekleyin." },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }

    const apiKey = process.env.GROQ_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json(
        { error: "Chat hizmeti şu anda yapılandırılmamış." },
        { status: 503 }
      );
    }

    const body = (await request.json().catch(() => null)) as {
      messages?: unknown;
      currentMessage?: unknown;
    } | null;
    const currentMessage = typeof body?.currentMessage === "string" ? body.currentMessage.trim() : "";
    if (!currentMessage) {
      return NextResponse.json({ error: "Mesaj boş olamaz." }, { status: 400 });
    }

    let finalPrompt = currentMessage;

    // 🤖 DOSYA OKUMA YETENEĞİ: "oku: scripts/<dosya>" — yalnızca admin, yalnızca scripts/.
    if (currentMessage.toLowerCase().startsWith("oku:")) {
      const auth = await requireRole(request, ["admin"]);
      if (auth instanceof NextResponse) return auth;

      const dosyaYolu = currentMessage.substring(4).trim();
      const tamYol = resolveReadable(dosyaYolu);
      if (!tamYol) {
        return NextResponse.json(
          { reply: `❌ "${dosyaYolu}" okunabilir değil. Yalnızca scripts/ altındaki dosyalar (Örn: scripts/dev.js).` },
          { status: 403 }
        );
      }

      let stat: fs.Stats;
      try {
        stat = fs.statSync(tamYol);
      } catch {
        return NextResponse.json({
          reply: `❌ "${dosyaYolu}" bulunamadı. Lütfen yolu kontrol edin (Örn: scripts/dev.js).`,
        });
      }
      if (!stat.isFile()) {
        return NextResponse.json({ reply: `❌ "${dosyaYolu}" bir dosya değil.` }, { status: 400 });
      }
      if (stat.size > MAX_OKU_BYTES) {
        return NextResponse.json(
          { reply: `❌ "${dosyaYolu}" çok büyük (${Math.round(stat.size / 1024)} KB). Sınır ${MAX_OKU_BYTES / 1024} KB.` },
          { status: 413 }
        );
      }

      const dosyaIcerigi = fs.readFileSync(tamYol, "utf-8");
      const dosyaAdi = path.basename(dosyaYolu);
      finalPrompt = `Kullanıcı incelemen için şu dosyayı sağladı: "${dosyaAdi}"\n\nDosya İçeriği:\n\`\`\`\n${dosyaIcerigi}\n\`\`\`\n\nLütfen bu kod/metin dosyasını analiz et ve kullanıcının eğer varsa spesifik sorularını yanıtla veya olası hataları kısa ve net şekilde raporla.`;
    }

    finalPrompt = finalPrompt.slice(0, MAX_PROMPT_CHARS);

    const groq = new Groq({ apiKey });
    const chatCompletion = await groq.chat.completions.create({
      model: "qwen/qwen3.8-27b",
      messages: [
        {
          role: "system",
          content:
            "Sen kısa, net ve doğrudan cevap veren kıdemli bir yazılım mimarısın. Giriş cümleleri (Tabii ki, Merhaba vb.) yazma. Doğrudan teknik bilgiye odaklan.",
        },
        ...sanitizeHistory(body?.messages),
        { role: "user", content: finalPrompt },
      ],
      temperature: 0.2,
    });

    const aiResponse = chatCompletion.choices?.[0]?.message?.content || "Yanıt alınamadı.";
    return NextResponse.json({ reply: aiResponse });
  } catch (error) {
    console.error("API Hatası:", error);
    return NextResponse.json(
      { error: publicErrorMessage("Chat isteği işlenemedi.", error instanceof Error ? error : null) },
      { status: 500 }
    );
  }
}
