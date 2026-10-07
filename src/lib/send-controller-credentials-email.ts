import { getSiteUrl } from "@/lib/site-url";
import { BrevoClient } from "@getbrevo/brevo";

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type MailResult = { sent: boolean; reason?: string };

/** Kapı akışının iki adımı: okutmak yalnız doğrular, giriş onayı ayrı düğmedir. */
function usageBlock(): string {
  const site = getSiteUrl();
  const doorUrl = `${site}/kontrol`;
  const guideUrl = `${site}/kontrol/kullanim-klavuzu`;
  return `
    <h3 style="margin:0 0 8px;color:#0f172a;font-size:15px;">Bilet nasıl okutulur</h3>
    <ol style="margin:0 0 16px;padding-left:20px;color:#334155;line-height:1.7;font-size:14px;">
      <li><strong>Bilet Tara</strong> düğmesine bas, telefonun kamerasıyla biletin QR veya barkod kodunu okut. Kodu elle de yazabilirsin.</li>
      <li>Geçerli bilette yeşil kart açılır ve <strong>"Geçerli bilet — onay bekliyor"</strong> yazar. Bu aşamada bilet henüz <strong>kullanılmamıştır</strong>.</li>
      <li>Kişi içeri girecekse <strong>"Giriş işaretle"</strong> düğmesine bas. Kartta <strong>"Giriş işaretlendi"</strong> yazısını görmeden işlemi tamamlanmış sayma.</li>
      <li>Kırmızı kartta (<em>Bu bilet içeri geçti</em> / <em>Bilet bulunamadı</em> / <em>Bilet geçersiz</em>) bileti kabul etme; ilk girişin saatini ve okutan görevliyi kırmızı kartın altında görürsün.</li>
    </ol>

    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px 14px;margin:0 0 16px;">
      <p style="margin:0;color:#991b1b;font-size:14px;line-height:1.6;">
        <strong>Önemli:</strong> Okutmak tek başına bileti harcamaz; girişi yalnız <strong>"Giriş işaretle"</strong> düğmesi kapatır.
        Kendi biletinle deneme yaparken bu düğmeye basma — basarsan biletin sahibi kapıda içeri giremez.
      </p>
    </div>

    <ul style="margin:0 0 16px;padding-left:20px;color:#334155;line-height:1.7;font-size:14px;">
      <li>Kapı paneli: <a href="${doorUrl}" style="color:#1d4ed8;">${doorUrl}</a></li>
      <li>Kamera izni için site <strong>HTTPS</strong> üzerinden açılmalı; ekranın altındaki <strong>Kapı özeti</strong> gelen/kalan/satılan sayılarını gösterir.</li>
      <li>Görselli anlatım: <a href="${guideUrl}" style="color:#1d4ed8;">Bilet Kontrol Kullanım Kılavuzu</a></li>
    </ul>
  `;
}

async function sendMail(input: {
  email: string;
  fullName: string;
  subject: string;
  bodyHtml: string;
}): Promise<MailResult> {
  const brevoApiKey = process.env.BREVO_API_KEY;
  const fromEmail = process.env.BREVO_FROM_EMAIL;
  const fromName = process.env.BREVO_FROM_NAME;

  if (!brevoApiKey || !fromEmail || !fromName) {
    console.error("Brevo ENV eksik:", [
      !brevoApiKey && "BREVO_API_KEY",
      !fromEmail && "BREVO_FROM_EMAIL",
      !fromName && "BREVO_FROM_NAME",
    ].filter(Boolean));
    return { sent: false, reason: "Brevo yapılandırması eksik." };
  }

  const brevo = new BrevoClient({ apiKey: brevoApiKey });
  await brevo.transactionalEmails.sendTransacEmail({
    to: [{ email: input.email, name: input.fullName }],
    sender: { name: fromName, email: fromEmail },
    subject: input.subject,
    htmlContent: `
      <div style="font-family:Arial,sans-serif;background:#eef2f7;padding:24px;">
        <div style="max-width:620px;margin:0 auto;background:#fff;border-radius:12px;padding:24px;border:1px solid #e2e8f0;">
          ${input.bodyHtml}
          <p style="margin:0;color:#64748b;font-size:12px;">KurdEvents</p>
        </div>
      </div>
    `,
  });
  return { sent: true };
}

/**
 * Admin tarafından oluşturulan kontrolör hesabının giriş bilgileri.
 * Şifre yalnızca mailin içinde bulunur: loglanmaz, API yanıtında dönmez.
 */
export async function sendControllerCredentialsEmail(input: {
  email: string;
  fullName: string;
  password: string;
}): Promise<MailResult> {
  const email = String(input.email || "").trim();
  const fullName = String(input.fullName || "").trim() || "Kontrolör";
  const password = String(input.password || "");
  if (!email || !password) return { sent: false, reason: "E-posta ve şifre zorunludur." };

  const loginUrl = `${getSiteUrl()}/giris?redirect=%2Fkontrol`;

  try {
    return await sendMail({
      email,
      fullName,
      subject: "KurdEvents kontrolör hesabın — giriş ve kullanım",
      bodyHtml: `
        <h2 style="margin:0 0 12px;color:#0f172a;">Merhaba ${esc(fullName)},</h2>
        <p style="margin:0 0 16px;color:#334155;line-height:1.6;">
          KurdEvents bilet kontrol (kapı) hesabın hazırlandı. Aşağıdaki bilgilerle giriş yap.
        </p>

        <table style="width:100%;border-collapse:collapse;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
          <tr>
            <td style="padding:10px 12px;color:#475569;font-size:13px;width:110px;">E-posta</td>
            <td style="padding:10px 12px;color:#0f172a;font-family:monospace;font-weight:600;">${esc(email)}</td>
          </tr>
          <tr>
            <td style="padding:10px 12px;color:#475569;font-size:13px;border-top:1px solid #e2e8f0;">Şifre</td>
            <td style="padding:10px 12px;color:#0f172a;font-family:monospace;font-weight:600;font-size:17px;border-top:1px solid #e2e8f0;letter-spacing:1px;">${esc(password)}</td>
          </tr>
        </table>

        <p style="margin:18px 0 8px;">
          <a href="${loginUrl}" style="display:inline-block;background:#1d4ed8;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:600;">
            Giriş yap ve kapı paneline git
          </a>
        </p>

        ${usageBlock()}

        <p style="margin:0 0 16px;color:#334155;font-size:14px;line-height:1.6;">
          Bu şifre e-postada açık yazdığı için ilk girişten sonra paneldeki <strong>Şifre Değiştir</strong> sekmesinden kendine yeni bir şifre koy.
        </p>
      `,
    });
  } catch (error) {
    console.error("Kontrolör giriş maili gönderilemedi:", (error as Error)?.message);
    return { sent: false, reason: (error as Error)?.message };
  }
}

/** Başvurusu onaylanan kontrolöre: hesabı kendi şifresiyle açılır, kullanım anlatılır. */
export async function sendControllerApprovedEmail(input: {
  email: string;
  fullName: string;
}): Promise<MailResult> {
  const email = String(input.email || "").trim();
  const fullName = String(input.fullName || "").trim() || "Kontrolör";
  if (!email) return { sent: false, reason: "E-posta zorunludur." };

  const loginUrl = `${getSiteUrl()}/giris?redirect=%2Fkontrol`;

  try {
    return await sendMail({
      email,
      fullName,
      subject: "KurdEvents kontrolörlük başvurun onaylandı",
      bodyHtml: `
        <h2 style="margin:0 0 12px;color:#0f172a;">Merhaba ${esc(fullName)},</h2>
        <p style="margin:0 0 16px;color:#334155;line-height:1.6;">
          Kontrolörlük başvurun onaylandı. Kendi e-posta ve şifrenle giriş yaptıktan sonra bilet kontrol paneli açılır.
        </p>
        <p style="margin:0 0 18px;">
          <a href="${loginUrl}" style="display:inline-block;background:#1d4ed8;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:600;">
            Giriş yap ve kapı paneline git
          </a>
        </p>
        ${usageBlock()}
      `,
    });
  } catch (error) {
    console.error("Kontrolör onay maili gönderilemedi:", (error as Error)?.message);
    return { sent: false, reason: (error as Error)?.message };
  }
}
