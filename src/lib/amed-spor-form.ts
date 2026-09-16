import { BrevoClient } from "@getbrevo/brevo";
import type { SupabaseClient } from "@supabase/supabase-js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type AmedSporFormAttendee = {
  full_name: string;
  email: string;
  phone: string;
  id_country: string;
  passo_number: string;
};

/**
 * Amed Spor özel formunun ödemeye kadar taşınan, JSON olarak saklanabilir payload'ı.
 * Ödeme başarılı olduktan sonra event_form_responses'a yazılır.
 */
export type AmedSporFormPayload = {
  eventId: string;
  ticketCount: number;
  attendees: AmedSporFormAttendee[];
  seating_preference: "vip" | "loca";
  has_accommodation: boolean;
  has_flight: boolean;
  organization: string | null;
  language_preference: string;
  accept_phone_contact: boolean;
  additional_notes: string | null;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function parseNotifyEmails(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const email = item.trim().toLowerCase();
    if (EMAIL_RE.test(email) && !out.includes(email)) out.push(email);
  }
  return out;
}

type NotifyOpts = {
  to: string[];
  eventTitle: string;
  eventDate: string;
  attendees: AmedSporFormAttendee[];
  seating_preference: string;
  has_accommodation: boolean;
  accommodation_fee: number;
  has_flight: boolean;
  flight_fee: number;
  totalAmount: number;
  currency: string;
  organization: string | null;
  language_preference: string;
  additional_notes: string | null;
  paid: boolean;
};

async function sendFormNotification(opts: NotifyOpts): Promise<{ sent: boolean; reason?: string }> {
  const brevoApiKey = process.env.BREVO_API_KEY;
  const fromEmail = process.env.BREVO_FROM_EMAIL;
  const fromName = process.env.BREVO_FROM_NAME;

  if (!brevoApiKey || !fromEmail || !fromName) {
    return { sent: false, reason: "Brevo yapılandırması eksik." };
  }
  if (opts.to.length < 1) {
    return { sent: false, reason: "En az 1 bildirim e-postası gerekli." };
  }

  const rows = opts.attendees
    .map(
      (a, i) =>
        `<tr>
          <td style="padding:6px 8px;border:1px solid #e2e8f0;">${i + 1}</td>
          <td style="padding:6px 8px;border:1px solid #e2e8f0;">${escapeHtml(a.full_name)}</td>
          <td style="padding:6px 8px;border:1px solid #e2e8f0;">${escapeHtml(a.email)}</td>
          <td style="padding:6px 8px;border:1px solid #e2e8f0;">${escapeHtml(a.phone)}</td>
          <td style="padding:6px 8px;border:1px solid #e2e8f0;">${escapeHtml(a.id_country || "-")}</td>
          <td style="padding:6px 8px;border:1px solid #e2e8f0;">${escapeHtml(a.passo_number || "-")}</td>
        </tr>`
    )
    .join("");

  const seatingLabel = opts.seating_preference === "loca" ? "Özel Loca" : "VIP Tribünü";

  const html = `
    <div style="font-family:Arial,sans-serif;color:#0f172a;">
      <h2 style="margin:0 0 10px;">Yeni Amed Spor form kaydı</h2>
      <p style="margin:0 0 8px;"><strong>Etkinlik:</strong> ${escapeHtml(opts.eventTitle)}</p>
      <p style="margin:0 0 8px;"><strong>Tarih:</strong> ${escapeHtml(opts.eventDate)}</p>
      <p style="margin:0 0 8px;"><strong>Tribün Tercihi:</strong> ${escapeHtml(seatingLabel)}</p>
      <p style="margin:0 0 8px;"><strong>Konaklama:</strong> ${opts.has_accommodation ? `Evet (+${opts.accommodation_fee} ${opts.currency} / kişi)` : "Hayır"}</p>
      <p style="margin:0 0 8px;"><strong>Uçak Bileti:</strong> ${opts.has_flight ? `Evet (+${opts.flight_fee} ${opts.currency} / kişi)` : "Hayır"}</p>
      <p style="margin:0 0 8px;"><strong>Toplam Tutar:</strong> ${opts.totalAmount > 0 ? `${opts.totalAmount} ${opts.currency}` : "Ücretsiz"}</p>
      <p style="margin:0 0 8px;"><strong>Ödeme:</strong> ${opts.paid ? "Ödendi" : "Ücretsiz"}</p>
      <p style="margin:0 0 8px;"><strong>Kuruluş:</strong> ${escapeHtml(opts.organization || "-")}</p>
      <p style="margin:0 0 8px;"><strong>Dil:</strong> ${escapeHtml(opts.language_preference)}</p>

      <p style="margin:0 0 12px;"><strong>Not:</strong> ${escapeHtml(opts.additional_notes || "-")}</p>
      <table style="border-collapse:collapse;width:100%;font-size:14px;">
        <thead>
          <tr style="background:#f1f5f9;">
            <th style="padding:6px 8px;border:1px solid #e2e8f0;text-align:left;">#</th>
            <th style="padding:6px 8px;border:1px solid #e2e8f0;text-align:left;">Ad Soyad</th>
            <th style="padding:6px 8px;border:1px solid #e2e8f0;text-align:left;">E-posta</th>
            <th style="padding:6px 8px;border:1px solid #e2e8f0;text-align:left;">Telefon</th>
            <th style="padding:6px 8px;border:1px solid #e2e8f0;text-align:left;">Kimlik / Ülke</th>
            <th style="padding:6px 8px;border:1px solid #e2e8f0;text-align:left;">Passo No</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;

  const brevo = new BrevoClient({ apiKey: brevoApiKey });
  const emailPromise = brevo.transactionalEmails.sendTransacEmail({
    to: opts.to.map((email) => ({ email, name: "Amed Spor" })),
    sender: { name: fromName, email: fromEmail },
    subject: `Amed Spor form: ${opts.eventTitle} (${opts.attendees.length} kişi - ${seatingLabel})`,
    htmlContent: html,
  });
  await Promise.race([
    emailPromise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("E-posta gönderimi zaman aşımına uğradı")), 15_000)
    ),
  ]);

  return { sent: true };
}

/**
 * Amed Spor formunu veritabanına yazar + admin'e bildirim gönderir.
 * `purchaseId` doluysa kayıt siparişe bağlanır (ödeme sonrası akış);
 * boşsa ücretsiz başvuru olarak kaydedilir.
 */
export async function persistAmedSporForm(
  supabase: SupabaseClient,
  payload: AmedSporFormPayload,
  purchaseId: string | null
): Promise<{ ok: boolean; message?: string; mailSent?: boolean }> {
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, title, date, currency, price_from, accommodation_price, flight_price")
    .eq("id", payload.eventId)
    .maybeSingle();

  if (eventError || !event) {
    return { ok: false, message: "Etkinlik bulunamadı." };
  }

  const accommodationFee = payload.has_accommodation
    ? Math.max(0, Number(event.accommodation_price) || 0)
    : 0;
  const flightFee = payload.has_flight ? Math.max(0, Number(event.flight_price) || 0) : 0;
  const basePrice = Math.max(0, Number(event.price_from) || 0);
  const packageUnitPrice = basePrice + accommodationFee + flightFee;
  const currency = String(event.currency || "EUR");
  const count = Math.max(1, payload.attendees.length);

  const rows = payload.attendees.map((a) => ({
    event_id: payload.eventId,
    purchase_id: purchaseId,
    full_name: a.full_name,
    email: a.email,
    phone: a.phone,
    id_country: a.id_country || null,
    passo_number: a.passo_number || null,
    seating_preference: payload.seating_preference,
    has_accommodation: payload.has_accommodation,
    accommodation_fee: accommodationFee,
    has_flight: payload.has_flight,
    flight_fee: flightFee,
    organization: payload.organization,
    language_preference: payload.language_preference,
    accept_phone_contact: payload.accept_phone_contact,
    additional_notes: payload.additional_notes,
  }));

  const { error: insertError } = await supabase.from("event_form_responses").insert(rows);
  if (insertError) {
    return { ok: false, message: insertError.message || "Form kaydedilemedi." };
  }

  const { data: settingsRows } = await supabase
    .from("site_settings")
    .select("key, value")
    .eq("key", "amed_spor_form_notify_emails");

  const notifyEmails = parseNotifyEmails(settingsRows?.[0]?.value);
  let mailSent = false;
  try {
    const mailResult = await sendFormNotification({
      to: notifyEmails,
      eventTitle: String(event.title || ""),
      eventDate: String(event.date || ""),
      attendees: payload.attendees,
      seating_preference: payload.seating_preference,
      has_accommodation: payload.has_accommodation,
      accommodation_fee: accommodationFee,
      has_flight: payload.has_flight,
      flight_fee: flightFee,
      totalAmount: packageUnitPrice * count,
      currency,
      organization: payload.organization,
      language_preference: payload.language_preference,
      additional_notes: payload.additional_notes,
      paid: Boolean(purchaseId),
    });
    mailSent = mailResult.sent;
  } catch (mailErr) {
    console.error("Amed form mail error:", mailErr);
  }

  return { ok: true, mailSent };
}
