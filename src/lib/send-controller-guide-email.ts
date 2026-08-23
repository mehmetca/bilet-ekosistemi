import { getSiteUrl } from "@/lib/site-url";
import { Brevo } from "@getbrevo/brevo";

export async function sendControllerGuideEmail(input: {
  email: string;
  fullName: string;
}): Promise<{ sent: boolean; reason?: string }> {
  try {
    const brevoApiKey = process.env.BREVO_API_KEY;
    const fromEmail = process.env.BREVO_FROM_EMAIL;
    const fromName = process.env.BREVO_FROM_NAME;

    if (!brevoApiKey || !fromEmail || !fromName) {
      console.error("Brevo ENV eksik:", {
        brevoApiKey,
        fromEmail,
        fromName,
      });
      return { sent: false, reason: "Brevo yapılandırması eksik." };
    }

    const guideUrl = `${getSiteUrl()}/yonetim/bilet-kontrol/kullanim-klavuzu`;

    const subject = "KurdEvents Kontrolör Kullanım Kılavuzu";
    const html = `
      <div style="font-family:Arial,sans-serif;background:#eef2f7;padding:24px;">
        <div style="max-width:620px;margin:0 auto;background:#fff;border-radius:12px;padding:24px;border:1px solid #e2e8f0;">
          <h2 style="margin:0 0 12px;color:#0f172a;">Merhaba ${input.fullName},</h2>
          <p style="margin:0 0 10px;color:#334155;line-height:1.6;">
            Kontrolör başvurun alınmıştır. Onay sürecinden sonra bilet kontrol görevine başlayabilirsin.
          </p>
          <p style="margin:0 0 10px;color:#334155;line-height:1.6;">
            Aşağıdaki bağlantıda görselli kullanım kılavuzu yer alır:
          </p>
          <p style="margin:0 0 18px;">
            <a href="${guideUrl}" style="display:inline-block;background:#1d4ed8;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600;">
              Bilet Kontrol Kullanım Kılavuzu
            </a>
          </p>
          <p style="margin:0;color:#64748b;font-size:12px;">
            KurdEvents
          </p>
        </div>
      </div>
    `;

    const brevo = new Brevo();
    brevo.setApiKey(brevoApiKey);

    const sendSmtpEmail = {
      to: [{
        email: input.email,
        name: input.fullName
      }],
      sender: {
        name: fromName,
        email: fromEmail
      },
      subject: subject,
      htmlContent: html
    };

    const info = await brevo.sendTransacEmail(sendSmtpEmail);
    console.log("Mail gönderildi:", info);

    return { sent: true };
  } catch (error: any) {
    console.error("Mail gönderilemedi:", error);
    return { sent: false, reason: error.message };
  }
}