/**
 * Etkinlik hatırlatma maili gönderir.
 * Brevo API kullanır (bilet maili ile aynı altyapı).
 */

import { Brevo } from "@getbrevo/brevo";

export type ReminderMailPayload = {
  email: string;
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  venue: string;
  eventUrl: string;
};

export async function sendReminderEmail(payload: ReminderMailPayload): Promise<{ sent: boolean; reason?: string }> {
  try {
    const brevoApiKey = process.env.BREVO_API_KEY;
    const fromEmail = process.env.BREVO_FROM_EMAIL;
    const fromName = process.env.BREVO_FROM_NAME;

    if (!brevoApiKey || !fromEmail || !fromName) {
      return { sent: false, reason: "Brevo yapılandırması eksik." };
    }

    const dateFormatted = new Date(payload.eventDate).toLocaleDateString("tr-TR", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const subject = `Hatırlatma: ${payload.eventTitle} – ${dateFormatted}`;
    const html = `
      <div style="font-family:Arial,sans-serif;background:#eef2f7;padding:24px;">
        <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;padding:24px;border:1px solid #e2e8f0;">
          <h2 style="margin:0 0 16px;color:#0f172a;">Merhaba,</h2>
          <p style="margin:0 0 12px;color:#334155;line-height:1.6;">
            <strong>${payload.eventTitle}</strong> etkinliğini hatırlatmak istedik.
          </p>
          <p style="margin:0 0 12px;color:#334155;line-height:1.6;">
            Bu etkinlik <strong>${dateFormatted}</strong> tarihinde, saat <strong>${payload.eventTime || "—"}</strong>'de 
            <strong>${payload.venue}</strong>'da gerçekleşecek.
          </p>
          <p style="margin:0 0 20px;color:#334155;line-height:1.6;">
            Bilet almak veya detayları görmek için aşağıdaki linke tıklayın:
          </p>
          <a href="${payload.eventUrl}" style="display:inline-block;background:#003f8c;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:600;">
            KurdEvents Etkinlik Sayfasına Git
          </a>
          <p style="margin:24px 0 0;font-size:12px;color:#64748b;">
            KurdEvents – Bu hatırlatmayı etkinlik sayfasında e-posta adresinizi girerek aldınız.
          </p>
        </div>
      </div>
    `;

    const brevo = new Brevo();
    brevo.setApiKey(brevoApiKey);

    const sendSmtpEmail = {
      to: [{
        email: payload.email,
        name: payload.email
      }],
      sender: {
        name: fromName,
        email: fromEmail
      },
      subject: subject,
      htmlContent: html
    };

    await brevo.sendTransacEmail(sendSmtpEmail);
    return { sent: true };
  } catch (error: any) {
    return { sent: false, reason: error.message };
  }
}
