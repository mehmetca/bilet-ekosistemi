import { MailerSend, EmailParams, Sender, Recipient } from "mailersend";

export async function POST(req) {
  const { email } = await req.json();

  const mailerSendApiKey = process.env.MAILERSEND_API_KEY;
  const fromEmail = process.env.MAILERSEND_FROM_EMAIL;
  const fromName = process.env.MAILERSEND_FROM_NAME;

  if (!mailerSendApiKey || !fromEmail || !fromName) {
    console.error("MailerSend ENV eksik:", {
      mailerSendApiKey,
      fromEmail,
      fromName,
    });
    return new Response(JSON.stringify({ success: false, reason: "MailerSend yapılandırması eksik." }), { status: 500 });
  }

  const mailerSend = new MailerSend({
    apiKey: mailerSendApiKey,
  });

  const sentFrom = new Sender(fromEmail, fromName);
  const recipients = [new Recipient(email, email)];

  const emailParams = new EmailParams()
    .setFrom(sentFrom)
    .setTo(recipients)
    .setSubject("KurdEvents'e Hoş Geldiniz!")
    .setHtml(`
      <p>Merhaba ${email},</p>
      <p>KurdEvents'e katıldığınız için teşekkür ederiz! Artık etkinliklere göz atabilir, bilet satın alabilir ve topluluğumuzun bir parçası olabilirsiniz.</p>
      <p>Hesabınız başarıyla oluşturuldu. Herhangi bir sorunuz olursa bize istediğiniz zaman ulaşabilirsiniz.</p>
      <p>Keyifli etkinlikler dileriz!<br><strong>KurdEvents Ekibi</strong></p>
    `);

  await mailerSend.email.send(emailParams);

  return new Response(JSON.stringify({ success: true }));
}