import { NextResponse } from "next/server";
import Groq from "groq-sdk";
import fs from "fs";
import path from "path";

// Çevre değişkeninden API anahtarını güvenli bir şekilde çekiyoruz
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(request: Request) {
  try {
    const { messages, currentMessage } = await request.json();

    let finalPrompt = currentMessage;

    // 🤖 DOSYA OKUMA YETENEĞİ: Kullanıcı "oku: <dosya_yolu>" yazdıysa tetiklenir
    if (currentMessage.toLowerCase().startsWith("oku:")) {
      const dosyaYolu = currentMessage.substring(4).trim();
      const tamYol = path.join(process.cwd(), dosyaYolu);

      if (fs.existsSync(tamYol)) {
        const dosyaIcerigi = fs.readFileSync(tamYol, "utf-8");
        const dosyaAdi = path.basename(dosyaYolu);
        
        finalPrompt = `Kullanıcı incelemen için şu dosyayı sağladı: "${dosyaAdi}"\n\nDosya İçeriği:\n\`\`\`\n\${dosyaIcerigi}\n\`\`\`\n\nLütfen bu kod/metin dosyasını analiz et ve kullanıcının eğer varsa spesifik sorularını yanıtla veya olası hataları kısa ve net şekilde raporla.`;
      } else {
        return NextResponse.json({ 
          reply: `❌ Hata: "${dosyaYolu}" dosyası proje dizininde bulunamadı. Lütfen yolu kontrol edin (Örn: scripts/dev.js).` 
        });
      }
    }

    // Geçmiş sohbet mesajlarını Groq formatına uyarlıyoruz
    const apiMessages = [
      {
        role: "system",
        content: "Sen kısa, net ve doğrudan cevap veren kıdemli bir yazılım mimarısın. Giriş cümleleri (Tabii ki, Merhaba vb.) yazma. Doğrudan teknik bilgiye odaklan."
      },
      ...messages,
      { role: "user", content: finalPrompt }
    ];

    // Güncel Qwen modelimizi çağırıyoruz
    const chatCompletion = await groq.chat.completions.create({
      model: "qwen/qwen3.8-27b",
      messages: apiMessages as any,
      temperature: 0.2,
    });

    const aiResponse = chatCompletion.choices?.[0]?.message?.content || "Yanıt alınamadı.";

    return NextResponse.json({ reply: aiResponse });
  } catch (error: any) {
    console.error("API Hatası:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
