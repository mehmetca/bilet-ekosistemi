import { BrevoClient } from "@getbrevo/brevo";
import { loadMessagesWithEnFallback } from "@/i18n/load-messages";
import { routing } from "@/i18n/routing";

export async function POST(req) {
  const { email, firstName, lastName, locale } = await req.json();

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

  // Kayıt akışının diline göre mesaj metnini yükle; bilinmeyen dil → site varsayılanı.
  const resolvedLocale =
    locale && routing.locales.includes(locale) ? locale : routing.defaultLocale;

  let welcomeEmail = {};
  try {
    const messages = await loadMessagesWithEnFallback(resolvedLocale);
    if (
      messages.welcomeEmail &&
      typeof messages.welcomeEmail === "object" &&
      !Array.isArray(messages.welcomeEmail)
    ) {
      welcomeEmail = messages.welcomeEmail;
    }
  } catch (_) {
    // Çeviri yüklenemezse aşağıdaki varsayılan metinler kullanılır.
  }

  // Ad soyad varsa kullan, yoksa email ile hitap et
  const displayName = firstName && lastName ? `${firstName} ${lastName}` : email;

  const subject = welcomeEmail.subject || "Welcome to KurdEvents!";
  const greeting = (welcomeEmail.greeting || "Hello {name},").replace(/\{name\}/g, displayName);
  const intro = welcomeEmail.intro || "";
  const accountCreated = welcomeEmail.accountCreated || "";
  const closing = welcomeEmail.closing || "";
  const team = welcomeEmail.team || "KurdEvents Team";

  const htmlContent = `
    <p>${greeting}</p>
    <p>${intro}</p>
    <p>${accountCreated}</p>
    <p>${closing}<br><strong>${team}</strong></p>
  `;

  const sendSmtpEmail = {
    to: [{
      email: email,
      name: displayName
    }],
    sender: {
      name: fromName,
      email: fromEmail
    },
    subject,
    htmlContent
  };

  await brevo.transactionalEmails.sendTransacEmail(sendSmtpEmail);

  return new Response(JSON.stringify({ success: true }));
}
