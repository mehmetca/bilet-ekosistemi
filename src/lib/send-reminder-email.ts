/**
 * Etkinlik hatırlatma maili gönderir.
 * Resend API kullanır (bilet maili ile aynı altyapı).
 */

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
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      return { sent: false, reason: "RESEND_API_KEY tanımlı değil." };
    }

    const fromAddress = process.env.TICKET_EMAIL_FROM;
    if (!fromAddress) {
      return { sent: false, reason: "TICKET_EMAIL_FROM tanımlı değil." };
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

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [payload.email],
        subject,
        html,
      }),
    });

    if (response.ok) {
      return { sent: true };
    }
    const errText = await response.text();
    return { sent: false, reason: errText || `HTTP ${response.status}` };
  } catch (error) {
    return {
      sent: false,
      reason: error instanceof Error ? error.message : "Bilinmeyen e-posta hatası",
    };
  }
}
