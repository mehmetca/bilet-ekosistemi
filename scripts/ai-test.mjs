import Groq from "groq-sdk";
import readline from "readline";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Sohbet geçmişini (hafızayı) tutacak dizi
const mesajGecmisi = [
  {
    role: "system",
    content: "Sen kısa, net ve doğrudan cevap veren yardımsever bir asistansın. Giriş cümleleri (Tabii ki, Merhaba vb.) yazma. Doğrudan soruya ve bilgiye odaklan."
  }
];

// Terminalden girdi almak için arayüz oluşturuyoruz
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function sohbetEt() {
  rl.question("\n👤 Siz: ", async (userInput) => {
    // Sohbetten çıkış kontrolü
    if (userInput.toLowerCase() === "çıkış" || userInput.toLowerCase() === "exit") {
      console.log("\n👋 Görüşmek üzere, iyi çalışmalar!");
      rl.close();
      return;
    }

    if (!userInput.trim()) {
      sohbetEt();
      return;
    }

    // Kullanıcının yazdığı soruyu geçmişe ekle
    mesajGecmisi.push({ role: "user", content: userInput });

    try {
      process.stdout.write("🤖 Groq (Qwen 3.8) düşünüyor...");

      const chatCompletion = await groq.chat.completions.create({
        model: "qwen/qwen3.8-27b",
        messages: mesajGecmisi,
        temperature: 0.3,
      });

      // Terminaldeki "düşünüyor..." yazısını temizle ve yanıtı yazdır
      readline.clearLine(process.stdout, 0);
      readline.cursorTo(process.stdout, 0);

      const aiResponse = chatCompletion.choices?.[0]?.message?.content || "Yanıt alınamadı.";
      
      console.log(`🤖 Yapay Zeka: ${aiResponse.trim()}`);

      // Yapay zekanın cevabını da geçmişe ekle (Böylece sonraki soruda geçmişi hatırlar)
      mesajGecmisi.push({ role: "assistant", content: aiResponse });

    } catch (error) {
      console.error("\n❌ Hata oluştu:", error.message);
    }

    // Sohbet döngüsünü devam ettir
    sohbetEt();
  });
}

console.log("====================================================");
/* Buraya keyfî/keyfi emojiler veya başlangıç notları eklenebilir */
console.log("🚀 Groq Chatbot Başlatıldı! Çıkmak için 'çıkış' yazın.");
console.log("====================================================");

sohbetEt();
