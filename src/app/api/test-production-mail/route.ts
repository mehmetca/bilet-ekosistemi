import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

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
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const smtpFrom = process.env.SMTP_FROM;

    if (!smtpHost || !smtpPort || !smtpUser || !smtpPass || !smtpFrom) {
      console.error("SMTP ENV eksik:", {
        smtpHost,
        smtpPort,
        smtpUser,
        smtpPass,
        smtpFrom,
      });
      return NextResponse.json({ 
        success: false, 
        error: "SMTP yapılandırması eksik. Environment variables kontrol edin." 
      }, { status: 500 });
    }

    console.log("Production mail test başlıyor:", { smtpHost, smtpPort, smtpUser, smtpFrom, testEmail });

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: Number(smtpPort),
      secure: false,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    console.log("Transporter oluşturuldu, connection test başlıyor...");

    // Önce connection test
    await transporter.verify();
    console.log("SMTP connection başarılı");

    console.log("Mail gönderme başlıyor...");

    // Mail gönder
    const info = await transporter.sendMail({
      from: smtpFrom,
      to: testEmail,
      subject: "Production SMTP Test Maili - KurdEvents",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Production SMTP Test Başarılı! 🎉</h2>
          <p>Test maili başarıyla gönderildi.</p>
          <p><strong>Kullanılan SMTP:</strong> ${smtpHost}</p>
          <p><strong>Port:</strong> ${smtpPort}</p>
          <p><strong>Tarih:</strong> ${new Date().toLocaleString('tr-TR')}</p>
          <p><strong>Test Email:</strong> ${testEmail}</p>
          <hr>
          <p style="color: #666; font-size: 12px;">Bu bir test mailidir. KurdEvents mail sistemi çalışıyor!</p>
        </div>
      `,
    });

    console.log("Mail gönderildi:", info.messageId);

    return NextResponse.json({ 
      success: true, 
      messageId: info.messageId,
      message: "Test maili başarıyla gönderildi",
      smtpHost,
      smtpPort
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