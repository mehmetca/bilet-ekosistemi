const nodemailer = require("nodemailer");

// Test edilecek SMTP credentials set'leri
const smtpSets = [
  {
    name: "Mail Manager Set",
    smtpHost: "esrycjixjpup.eig6.mail-manager-smtp.amazonaws.com",
    smtpPort: "587",
    smtpUser: "inp-qewlzhjve6qzci5ujchklpup",
    smtpPass: "Mehmetcan21!",
    smtpFrom: "KurdEvents <noreply@kurdevents.com>",
  },
  {
    name: "Coolify Set",
    smtpHost: "email-smtp.eu-central-1.amazonaws.com",
    smtpPort: "587",
    smtpUser: "AKIA5KFQ3HDGDWAJYFHP",
    smtpPass: "BH1QI6nkc77JvaDmsA0UtrMl3sphFUaZK6eDKOfVUoaD",
    smtpFrom: "KurdEvents <noreply@kurdevents.com>",
  },
];

// Test email adresi (burayı kendi email adresinizle değiştirin)
const testEmail = "mcantoprak@gmail.com"; // BURAYI KENDİ EMAIL ADRESİNİZİ YAZIN

async function testSmtpSet(smtpSet) {
  console.log(`\n=== ${smtpSet.name} Test Ediliyor ===`);
  console.log("SMTP Config:", {
    host: smtpSet.smtpHost,
    port: smtpSet.smtpPort,
    user: smtpSet.smtpUser,
    from: smtpSet.smtpFrom,
  });

  try {
    const transporter = nodemailer.createTransport({
      host: smtpSet.smtpHost,
      port: Number(smtpSet.smtpPort),
      secure: false,
      auth: {
        user: smtpSet.smtpUser,
        pass: smtpSet.smtpPass,
      },
    });

    console.log("Transporter oluşturuldu, connection test başlıyor...");
    await transporter.verify();
    console.log("✅ SMTP connection başarılı");

    console.log("Mail gönderme başlıyor...");
    const info = await transporter.sendMail({
      from: smtpSet.smtpFrom,
      to: testEmail,
      subject: `SMTP Test - ${smtpSet.name}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>SMTP Test Başarılı!</h2>
          <p><strong>Set:</strong> ${smtpSet.name}</p>
          <p><strong>SMTP:</strong> ${smtpSet.smtpHost}</p>
          <p><strong>Port:</strong> ${smtpSet.smtpPort}</p>
          <p><strong>Tarih:</strong> ${new Date().toLocaleString('tr-TR')}</p>
        </div>
      `,
    });

    console.log("✅ Mail gönderildi:", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("❌ Hata:", error.message);
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log("SMTP Test Script Başlatılıyor...");
  console.log("Test Email:", testEmail);

  for (const smtpSet of smtpSets) {
    const result = await testSmtpSet(smtpSet);
    console.log(`Sonuç: ${result.success ? "✅ BAŞARILI" : "❌ BAŞARISIZ"}`);
    if (result.messageId) {
      console.log("Message ID:", result.messageId);
    }
  }

  console.log("\n=== Test Tamamlandı ===");
}

main().catch(console.error);