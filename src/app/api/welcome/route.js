import { BrevoClient } from "@getbrevo/brevo";

export async function POST(req) {
  const { email, firstName, lastName } = await req.json();

  const brevoApiKey = process.env.BREVO_API_KEY;
  const fromEmail = process.env.BREVO_FROM_EMAIL;
  const fromName = process.env.BREVO_FROM_NAME;

  if (!brevoApiKey || !fromEmail || !fromName) {
    console.error("Brevo ENV eksik:", {
      brevoApiKey,
      fromEmail,
      fromName,
    });
    return new Response(JSON.stringify({ success: false, reason: "Brevo yapılandırması eksik." }), { status: 500 });
  }

  const brevo = new BrevoClient({
    apiKey: brevoApiKey,
  });

  // Ad soyad varsa kullan, yoksa email ile hitap et
  const displayName = firstName && lastName ? `${firstName} ${lastName}` : email;

  const sendSmtpEmail = {
    to: [{
      email: email,
      name: displayName
    }],
    sender: {
      name: fromName,
      email: fromEmail
    },
    subject: "KurdEvents'e Hoş Geldiniz!",
    htmlContent: `
      <p>Merhaba ${displayName},</p>
      <p>KurdEvents'e katıldığınız için teşekkür ederiz! Artık etkinliklere göz atabilir, bilet satın alabilir ve topluluğumuzun bir parçası olabilirsiniz.</p>
      <p>Hesabınız başarıyla oluşturuldu. Herhangi bir sorunuz olursa bize istediğiniz zaman ulaşabilirsiniz.</p>
      <p>Keyifli etkinlikler dileriz!<br><strong>KurdEvents Ekibi</strong></p>
    `
  };

  await brevo.transactionalEmails.sendTransacEmail(sendSmtpEmail);

  return new Response(JSON.stringify({ success: true }));
}