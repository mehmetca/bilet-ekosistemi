import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function GET() {
  console.log("Mail test GET endpoint called");
  return NextResponse.json({ 
    success: true, 
    message: "Mail test endpoint çalışıyor" 
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log("Gelen request body:", body);

    const { smtpHost, smtpPort, smtpUser, smtpPass, smtpFrom, testEmail } = body;

    if (!smtpHost || !smtpPort || !smtpUser || !smtpPass || !smtpFrom || !testEmail) {
      console.error("Eksik parametreler:", { smtpHost, smtpPort, smtpUser, smtpPass, smtpFrom, testEmail });
      return NextResponse.json({ 
        success: false, 
        error: "Tüm SMTP parametreleri ve test email gerekli" 
      }, { status: 400 });
    }

    console.log("Mail test başlıyor:", { smtpHost, smtpPort, smtpUser, smtpFrom, testEmail });

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
      subject: "SMTP Test Maili - KurdEvents",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>SMTP Test Başarılı!</h2>
          <p>Test maili başarıyla gönderildi.</p>
          <p><strong>Kullanılan SMTP:</strong> ${smtpHost}</p>
          <p><strong>Port:</strong> ${smtpPort}</p>
          <p><strong>Tarih:</strong> ${new Date().toLocaleString('tr-TR')}</p>
        </div>
      `,
    });

    console.log("Mail gönderildi:", info.messageId);

    return NextResponse.json({ 
      success: true, 
      messageId: info.messageId,
      message: "Test maili başarıyla gönderildi"
    });

  } catch (error: any) {
    console.error("Mail test hatası detaylı:", error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || "Bilinmeyen hata",
      details: error.stack
    }, { status: 500 });
  }
}