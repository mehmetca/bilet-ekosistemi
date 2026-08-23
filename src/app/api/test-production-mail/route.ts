import { NextRequest, NextResponse } from "next/server";
import { MailerSend, EmailParams, Sender, Recipient } from "mailersend";

export async function GET() {
  return NextResponse.json({ 
    success: true, 
    message: "Production mail test endpoint çalışıyor" 
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log("Gelen request body:", body);

    const { testEmail } = body;

    if (!testEmail) {
      return NextResponse.json({ 
        success: false, 
        error: "Test email gerekli" 
      }, { status: 400 });
    }

    // Production environment variables'ı kullan
    const mailerSendApiKey = process.env.MAILERSEND_API_KEY;
    const fromEmail = process.env.MAILERSEND_FROM_EMAIL;
    const fromName = process.env.MAILERSEND_FROM_NAME;

    if (!mailerSendApiKey || !fromEmail || !fromName) {
      console.error("MailerSend ENV eksik:", {
        mailerSendApiKey,
        fromEmail,
        fromName,
      });
      return NextResponse.json({ 
        success: false, 
        error: "MailerSend yapılandırması eksik. Environment variables kontrol edin." 
      }, { status: 500 });
    }

    console.log("Production mail test başlıyor:", { fromEmail, fromName, testEmail });

    const mailerSend = new MailerSend({
      apiKey: mailerSendApiKey,
    });

    const sentFrom = new Sender(fromEmail, fromName);
    const recipients = [new Recipient(testEmail, testEmail)];

    const emailParams = new EmailParams()
      .setFrom(sentFrom)
      .setTo(recipients)
      .setSubject("Production MailerSend Test Maili - KurdEvents")
      .setHtml(`
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Production MailerSend Test Başarılı! 🎉</h2>
          <p>Test maili başarıyla gönderildi.</p>
          <p><strong>Gönderen:</strong> ${fromEmail}</p>
          <p><strong>Tarih:</strong> ${new Date().toLocaleString('tr-TR')}</p>
          <p><strong>Test Email:</strong> ${testEmail}</p>
          <hr>
          <p style="color: #666; font-size: 12px;">Bu bir test mailidir. KurdEvents mail sistemi çalışıyor!</p>
        </div>
      `);

    console.log("Mail gönderme başlıyor...");
    const response = await mailerSend.email.send(emailParams);
    console.log("Mail gönderildi:", response);

    return NextResponse.json({ 
      success: true, 
      message: "Test maili başarıyla gönderildi",
      fromEmail,
      fromName
    });

  } catch (error: any) {
    console.error("Production mail test hatası detaylı:", error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || "Bilinmeyen hata",
      details: error.stack
    }, { status: 500 });
  }
}