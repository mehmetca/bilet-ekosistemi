import { getSiteUrl } from "@/lib/site-url";
import { MailerSend, EmailParams, Sender, Recipient } from "mailersend";

export async function sendControllerGuideEmail(input: {
  email: string;
  fullName: string;
}): Promise<{ sent: boolean; reason?: string }> {
  try {
    const mailerSendApiKey = process.env.MAILERSEND_API_KEY;
    const fromEmail = process.env.MAILERSEND_FROM_EMAIL;
    const fromName = process.env.MAILERSEND_FROM_NAME;

    if (!mailerSendApiKey || !fromEmail || !fromName) {
      console.error("MailerSend ENV eksik:", {
        mailerSendApiKey,
        fromEmail,
        fromName,
      });
      return { sent: false, reason: "MailerSend yapılandırması eksik." };
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

    const mailerSend = new MailerSend({
      apiKey: mailerSendApiKey,
    });

    const sentFrom = new Sender(fromEmail, fromName);
    const recipients = [new Recipient(input.email, input.fullName)];

    const emailParams = new EmailParams()
      .setFrom(sentFrom)
      .setTo(recipients)
      .setSubject(subject)
      .setHtml(html);

    const info = await mailerSend.email.send(emailParams);
    console.log("Mail gönderildi:", info);

    return { sent: true };
  } catch (error: any) {
    console.error("Mail gönderilemedi:", error);
    return { sent: false, reason: error.message };
  }
}