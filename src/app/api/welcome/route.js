import nodemailer from "nodemailer";

export async function POST(req) {
  const { email } = await req.json();

  const transporter = nodemailer.createTransport({
    host: "jh9dmbc2y3ug.eig6.mail-manager-smtp.amazonaws.com",
    port: 587,
    secure: false,
    auth: {
      user: "inp-bsnoaimja3rlfjsyfttoeeyw",
      pass: "+u*E+=7b!|ZiI(Bo)QPXpMzJpKvgE3L=",
    },
  });

  await transporter.sendMail({
    from: "noreply@kurdevents.de",
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
