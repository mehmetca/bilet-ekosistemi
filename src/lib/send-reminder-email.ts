/**
 * Etkinlik hatırlatma maili gönderir.
 * Mailersend API kullanır (bilet maili ile aynı altyapı).
 */

import { MailerSend, EmailParams, Sender, Recipient } from "mailersend";

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
    const mailerSendApiKey = process.env.MAILERSEND_API_KEY;
    const fromEmail = process.env.MAILERSEND_FROM_EMAIL;
    const fromName = process.env.MAILERSEND_FROM_NAME;

    if (!mailerSendApiKey || !fromEmail || !fromName) {
      return { sent: false, reason: "MailerSend yapılandırması eksik." };
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

    const mailerSend = new MailerSend({
      apiKey: mailerSendApiKey,
    });

    const sentFrom = new Sender(fromEmail, fromName);
    const recipients = [new Recipient(payload.email, payload.email)];

    const emailParams = new EmailParams()
      .setFrom(sentFrom)
      .setTo(recipients)
      .setSubject(subject)
      .setHtml(html);

    await mailerSend.email.send(emailParams);
    return { sent: true };
  } catch (error: any) {
    return { sent: false, reason: error.message };
  }
}
