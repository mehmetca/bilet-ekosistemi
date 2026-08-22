import nodemailer from "nodemailer";

export async function POST(req) {
  const { email } = await req.json();

  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpFrom = process.env.SMTP_FROM;

  if (!smtpHost || !smtpPort || !smtpUser || !smtpPass || !smtpFrom) {
    console.error("SMTP ENV eksik:", {
      smtpHost,
      smtpPort,
      smtpUser,
      smtpPass,
      smtpFrom,
    });
    return new Response(JSON.stringify({ success: false, reason: "SMTP yapılandırması eksik." }), { status: 500 });
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: Number(smtpPort),
    secure: false,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  await transporter.sendMail({
    from: smtpFrom,
    to: email,
    subject: "KurdEvents’e Hoş Geldiniz!",
    html: `
      <p>Merhaba ${email},</p>
      <p>KurdEvents’e katıldığınız için teşekkür ederiz! Artık etkinliklere göz atabilir, bilet satın alabilir ve topluluğumuzun bir parçası olabilirsiniz.</p>
      <p>Hesabınız başarıyla oluşturuldu. Herhangi bir sorunuz olursa bize istediğiniz zaman ulaşabilirsiniz.</p>
      <p>Keyifli etkinlikler dileriz!<br><strong>KurdEvents Ekibi</strong></p>
    `,
  });

  return new Response(JSON.stringify({ success: true }));
}
