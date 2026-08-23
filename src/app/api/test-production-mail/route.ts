import { NextRequest, NextResponse } from "next/server";
import { Brevo } from "@getbrevo/brevo";

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
    const brevoApiKey = process.env.BREVO_API_KEY;
    const fromEmail = process.env.BREVO_FROM_EMAIL;
    const fromName = process.env.BREVO_FROM_NAME;

    if (!brevoApiKey || !fromEmail || !fromName) {
      console.error("Brevo ENV eksik:", {
        brevoApiKey,
        fromEmail,
        fromName,
      });
      return NextResponse.json({ 
        success: false, 
        error: "Brevo yapılandırması eksik. Environment variables kontrol edin." 
      }, { status: 500 });
    }

    console.log("Production mail test başlıyor:", { fromEmail, fromName, testEmail });

    const brevo = new Brevo();
    brevo.setApiKey(brevoApiKey);

    const sendSmtpEmail = {
      to: [{
        email: testEmail,
        name: testEmail
      }],
      sender: {
        name: fromName,
        email: fromEmail
      },
      subject: "Production Brevo Test Maili - KurdEvents",
      htmlContent: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Production Brevo Test Başarılı! 🎉</h2>
          <p>Test maili başarıyla gönderildi.</p>
          <p><strong>Gönderen:</strong> ${fromEmail}</p>
          <p><strong>Tarih:</strong> ${new Date().toLocaleString('tr-TR')}</p>
          <p><strong>Test Email:</strong> ${testEmail}</p>
          <hr>
          <p style="color: #666; font-size: 12px;">Bu bir test mailidir. KurdEvents mail sistemi çalışıyor!</p>
        </div>
      `
    };

    console.log("Mail gönderme başlıyor...");
    const response = await brevo.sendTransacEmail(sendSmtpEmail);
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