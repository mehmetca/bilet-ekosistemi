import { getSiteUrl } from "@/lib/site-url";

export async function sendControllerGuideEmail(input: {
  email: string;
  fullName: string;
}): Promise<{ sent: boolean; reason?: string }> {
  try {
    const resendApiKey = process.env.RESEND_API_KEY;
    const fromAddress = process.env.TICKET_EMAIL_FROM;
    if (!resendApiKey) return { sent: false, reason: "RESEND_API_KEY tanımlı değil." };
    if (!fromAddress) return { sent: false, reason: "TICKET_EMAIL_FROM tanımlı değil." };

    const guideUrl = `${getSiteUrl()}/yonetim/bilet-kontrol/kullanim-klavuzu`;
    const subject = "KurdEvents Kontrolör Kullanım Kılavuzu";
    const html = `
      <div style="font-family:Arial,sans-serif;background:#eef2f7;padding:24px;">
        <div style="max-width:620px;margin:0 auto;background:#fff;border-radius:12px;padding:24px;border:1px solid #e2e8f0;">
          <h2 style="margin:0 0 12px;color:#0f172a;">Merhaba ${input.fullName},</h2>
          <p style="margin:0 0 10px;color:#334155;line-height:1.6;">
            Kontrolör başvurun alınmıştır. Onay sürecinden sonra bilet kontrol görevine başlayabilirsiniz.
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

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [input.email],
        subject,
        html,
      }),
    });

    if (response.ok) return { sent: true };
    const errText = await response.text();
    return { sent: false, reason: errText || `HTTP ${response.status}` };
  } catch (error) {
    return { sent: false, reason: error instanceof Error ? error.message : "Bilinmeyen e-posta hatası" };
  }
}

