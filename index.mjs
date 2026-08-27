import dotenv from "dotenv";
import readline from "readline";

dotenv.config({ path: ".env.local" });

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Konuşma geçmişini hafızada tutacak dizi
let conversationHistory = [
  { 
    role: "system", 
    content: "Sen deneyimli bir yazılım geliştirme asistanısın. Kullanıcı sana Next.js, Node.js ve JavaScript/TypeScript hataları getirecek. Net, temiz ve doğrudan düzeltilmiş kod blokları sunarak yardımcı ol." 
  }
];

async function askAI(userInput) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error("\n❌ HATA: .env.local dosyasından OPENROUTER_API_KEY okunamadı!");
    rl.close();
    return;
  }

  // Kullanıcının yazdığı mesajı geçmişe ekle
  conversationHistory.push({ role: "user", content: userInput });

  const protokol = "https://";
  const alanAdi = "openrouter.ai";
  const yol = "/api/v1/chat/completions";

  try {
    process.stdout.write("\n🤖 Yapay Zeka düşünüyor...");
    
    const response = await fetch(protokol + alanAdi + yol, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey.trim()}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Bilet Ekosistemi"
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        max_tokens: 2000, // Kod blokları geleceği için limiti rahatlattık
        messages: conversationHistory
      })
    });

    const data = await response.json();
    
    // "Düşünüyor..." yazısını temizle
    readline.clearLine(process.stdout, 0);
    readline.cursorTo(process.stdout, 0);

    if (data && data.choices && data.choices[0]) {
      const aiResponse = data.choices[0].message.content;
      console.log(`\n🤖 YAPAY ZEKA:\n----------------------------------------\n${aiResponse}\n----------------------------------------`);
      
      // Asistanın cevabını da geçmişe ekle (Böylece sonraki soruda hatırlar)
      conversationHistory.push({ role: "assistant", content: aiResponse });
    } else {
      console.log("\n❌ OpenRouter Hatası Döndü:", data);
    }

  } catch (error) {
    console.error("\n❌ İstek sırasında bir hata oluştu:", error.message);
  }

  // Yeni soru için terminali hazırla
  promptUser();
}

function promptUser() {
  rl.question('\n✍️  Sorunuzu veya Hata Kodunu Yazın (Çıkmak için "exit" yazın): ', (input) => {
    if (input.toLowerCase() === 'exit') {
      console.log("Görüşmek üzere, iyi kodlamalar!");
      rl.close();
      return;
    }
    if (!input.trim()) {
      promptUser();
      return;
    }
    askAI(input);
  });
}

// Sistemi başlat
console.log("🚀 Yapay Zeka Geliştirici Asistanı Başlatıldı! (Çıkış yapmak için 'exit' yazabilirsiniz)");
promptUser();
