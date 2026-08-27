import { NextRequest, NextResponse } from "next/server";
import { BrevoClient } from "@getbrevo/brevo";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LANG_OK = new Set(["kurmanci", "türkçe", "ingilizce", "deutsch"]);
const ACCOM_OK = new Set(["otel", "diger", "kendi_ayarim"]);
const MEAL_OK = new Set(["yok", "vejetaryen", "vegan", "helal", "glutensiz", "diger"]);

type Attendee = {
  full_name?: string;
  email?: string;
  phone?: string;
};

type FormBody = {
  eventId?: string;
  ticketCount?: number;
  attendees?: Attendee[];
  organization?: string | null;
  language_preference?: string;
  accept_phone_contact?: boolean;
  accommodation_preference?: string | null;
  meal_preferences?: string | null;
  meal_other_text?: string | null;
  additional_notes?: string | null;
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

async function sendFormNotification(opts: {
  to: string[];
  eventTitle: string;
  eventDate: string;
  attendees: Array<{ full_name: string; email: string; phone: string }>;
  organization: string | null;
  language_preference: string;
  accommodation_preference: string | null;
  meal_preferences: string | null;
  meal_other_text: string | null;
  additional_notes: string | null;
  requiresPayment: boolean;
}) {
  const brevoApiKey = process.env.BREVO_API_KEY;
  const fromEmail = process.env.BREVO_FROM_EMAIL;
  const fromName = process.env.BREVO_FROM_NAME;

  if (!brevoApiKey || !fromEmail || !fromName) {
    return { sent: false, reason: "Brevo yapılandırması eksik." };
  }
  if (opts.to.length < 2) {
    return { sent: false, reason: "En az 2 bildirim e-postası gerekli." };
  }

  const rows = opts.attendees
    .map(
      (a, i) =>
        `<tr>
          <td style="padding:6px 8px;border:1px solid #e2e8f0;">${i + 1}</td>
          <td style="padding:6px 8px;border:1px solid #e2e8f0;">${escapeHtml(a.full_name)}</td>
          <td style="padding:6px 8px;border:1px solid #e2e8f0;">${escapeHtml(a.email)}</td>
          <td style="padding:6px 8px;border:1px solid #e2e8f0;">${escapeHtml(a.phone)}</td>
        </tr>`
    )
    .join("");

  const html = `
    <div style="font-family:Arial,sans-serif;color:#0f172a;">
      <h2 style="margin:0 0 10px;">Yeni Amed Spor form kaydı</h2>
      <p style="margin:0 0 8px;"><strong>Etkinlik:</strong> ${escapeHtml(opts.eventTitle)}</p>
      <p style="margin:0 0 8px;"><strong>Tarih:</strong> ${escapeHtml(opts.eventDate)}</p>
      <p style="margin:0 0 8px;"><strong>Ödeme:</strong> ${opts.requiresPayment ? "Gerekli (sepete yönlendirildi)" : "Yok / ücretsiz"}</p>
      <p style="margin:0 0 8px;"><strong>Kuruluş:</strong> ${escapeHtml(opts.organization || "-")}</p>
      <p style="margin:0 0 8px;"><strong>Dil:</strong> ${escapeHtml(opts.language_preference)}</p>
      <p style="margin:0 0 8px;"><strong>Konaklama:</strong> ${escapeHtml(opts.accommodation_preference || "-")}</p>
      <p style="margin:0 0 8px;"><strong>Yemek:</strong> ${escapeHtml(opts.meal_preferences || "-")}${
        opts.meal_other_text ? ` (${escapeHtml(opts.meal_other_text)})` : ""
      }</p>
      <p style="margin:0 0 12px;"><strong>Not:</strong> ${escapeHtml(opts.additional_notes || "-")}</p>
      <table style="border-collapse:collapse;width:100%;font-size:14px;">
        <thead>
          <tr style="background:#f1f5f9;">
            <th style="padding:6px 8px;border:1px solid #e2e8f0;text-align:left;">#</th>
            <th style="padding:6px 8px;border:1px solid #e2e8f0;text-align:left;">Ad Soyad</th>
            <th style="padding:6px 8px;border:1px solid #e2e8f0;text-align:left;">E-posta</th>
            <th style="padding:6px 8px;border:1px solid #e2e8f0;text-align:left;">Telefon</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;

  const brevo = new BrevoClient({ apiKey: brevoApiKey });
  // E-posta gönderiminin yanıtı uzun sürerse isteği asla bloke etmesin:
  // 15 sn içinde sonuçlanmazsa başarısız say ve yanıtı geciktirme.
  const emailPromise = brevo.transactionalEmails.sendTransacEmail({
    to: opts.to.map((email) => ({ email, name: "Amed Spor" })),
    sender: { name: fromName, email: fromEmail },
    subject: `Amed Spor form: ${opts.eventTitle} (${opts.attendees.length} kişi)`,
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

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as FormBody;
    const eventId = typeof body.eventId === "string" ? body.eventId.trim() : "";
    const ticketCount = Math.max(1, Math.min(10, Math.floor(Number(body.ticketCount) || 1)));
    const attendeesRaw = Array.isArray(body.attendees) ? body.attendees : [];

    if (!eventId) {
      return NextResponse.json({ success: false, message: "Etkinlik gerekli." }, { status: 400 });
    }

    if (attendeesRaw.length !== ticketCount) {
      return NextResponse.json(
        { success: false, message: "Bilet sayısı ile kişi bilgileri eşleşmiyor." },
        { status: 400 }
      );
    }

    const attendees: Array<{ full_name: string; email: string; phone: string }> = [];
    for (const a of attendeesRaw) {
      const full_name = String(a?.full_name || "").trim();
      const email = String(a?.email || "").trim().toLowerCase();
      const phone = String(a?.phone || "").trim();
      if (!full_name || !email || !phone) {
        return NextResponse.json(
          { success: false, message: "Her kişi için ad soyad, e-posta ve telefon zorunludur." },
          { status: 400 }
        );
      }
      if (!EMAIL_RE.test(email)) {
        return NextResponse.json(
          { success: false, message: `Geçersiz e-posta: ${email}` },
          { status: 400 }
        );
      }
      attendees.push({ full_name, email, phone });
    }

    const language_preference = String(body.language_preference || "").trim();
    if (!LANG_OK.has(language_preference)) {
      return NextResponse.json({ success: false, message: "Dil tercihi geçersiz." }, { status: 400 });
    }

    const accommodation_preference = String(body.accommodation_preference || "").trim() || null;
    if (accommodation_preference && !ACCOM_OK.has(accommodation_preference)) {
      return NextResponse.json(
        { success: false, message: "Konaklama tercihi geçersiz." },
        { status: 400 }
      );
    }

    const meal_preferences = String(body.meal_preferences || "yok").trim() || "yok";
    if (!MEAL_OK.has(meal_preferences)) {
      return NextResponse.json({ success: false, message: "Yemek tercihi geçersiz." }, { status: 400 });
    }

    const organization = String(body.organization || "").trim() || null;
    const meal_other_text = String(body.meal_other_text || "").trim() || null;
    const additional_notes = String(body.additional_notes || "").trim() || null;
    const accept_phone_contact = body.accept_phone_contact !== false;

    const supabase = getSupabaseAdmin();

    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id, title, date, time, venue, location, currency, price_from, is_active, is_approved, is_draft")
      .eq("id", eventId)
      .maybeSingle();

    if (eventError || !event) {
      return NextResponse.json({ success: false, message: "Etkinlik bulunamadı." }, { status: 404 });
    }

    if (event.is_draft || !event.is_active || event.is_approved === false) {
      return NextResponse.json(
        { success: false, message: "Bu etkinlik için form kabul edilmiyor." },
        { status: 400 }
      );
    }

    const { data: tickets, error: ticketsError } = await supabase
      .from("tickets")
      .select("id, name, price, quantity, available")
      .eq("event_id", eventId)
      .order("price", { ascending: true });

    if (ticketsError) {
      return NextResponse.json({ success: false, message: "Biletler okunamadı." }, { status: 500 });
    }

    // Stokta kalan (available > 0) bilet satırları.
    const ticketList = (tickets || []).filter((t) => Number(t.available ?? 0) > 0);
    // Amed Spor: fiyat kaynağı etkinliğin "Başlangıç fiyatı" (price_from) alanıdır.
    // Ticket fiyatına bakmayız; 0/boş ise form ücretsizdir (fiyat satırı görünmez).
    const requiresPayment = Number(event.price_from) > 0;
    const cartTicket = ticketList[0] || null;

    if (ticketList.length === 0) {
      return NextResponse.json(
        { success: false, message: "Bu etkinlik için satışa sunulan bilet bulunamadı." },
        { status: 400 }
      );
    }

    if (requiresPayment && !cartTicket) {
      return NextResponse.json(
        { success: false, message: "Ödeme için bilet tanımı bulunamadı." },
        { status: 400 }
      );
    }

    const insertRows = attendees.map((attendee) => ({
      event_id: eventId,
      full_name: attendee.full_name,
      email: attendee.email,
      phone: attendee.phone,
      organization,
      language_preference,
      accept_phone_contact,
      accommodation_preference,
      meal_preferences,
      meal_other_text,
      additional_notes,
    }));

    const { error: insertError } = await supabase.from("event_form_responses").insert(insertRows);
    if (insertError) {
      console.error("Amed form insert error:", insertError);
      return NextResponse.json(
        { success: false, message: insertError.message || "Form kaydedilemedi." },
        { status: 500 }
      );
    }

    // Form kaydı başarılı: her katılımcı için bir bilet düşülür.
    // Amed Spor: formu dolduran her isim stoktan bir bilet harcar.
    if (cartTicket) {
      const decrement = Math.max(1, attendees.length);
      const currentStock = Number(cartTicket.available ?? cartTicket.quantity ?? 0);
      const nextStock = Math.max(0, currentStock - decrement);
      const { error: stockError } = await supabase
        .from("tickets")
        .update({ available: nextStock })
        .eq("id", cartTicket.id);
      if (stockError) {
        console.error("Amed form stock decrement error:", stockError);
      } else {
        // Yanıttaki "kalan bilet" rakamı güncel olsun.
        cartTicket.available = nextStock;
      }
    }

    const { data: settingsRows } = await supabase
      .from("site_settings")
      .select("key, value")
      .eq("key", "amed_spor_form_notify_emails");

    const notifyEmails = parseNotifyEmails(settingsRows?.[0]?.value);
    let mailResult: { sent: boolean; reason?: string } = { sent: false, reason: "Alıcı yok" };
    try {
      mailResult = await sendFormNotification({
        to: notifyEmails,
        eventTitle: String(event.title || ""),
        eventDate: String(event.date || ""),
        attendees,
        organization,
        language_preference,
        accommodation_preference,
        meal_preferences,
        meal_other_text,
        additional_notes,
        requiresPayment,
      });
    } catch (mailErr: unknown) {
      const reason = mailErr instanceof Error ? mailErr.message : "Mail gönderilemedi";
      console.error("Amed form mail error:", mailErr);
      mailResult = { sent: false, reason };
    }

    return NextResponse.json({
      success: true,
      requiresPayment,
      mailSent: mailResult.sent,
      mailReason: mailResult.reason || null,
      ticket: cartTicket
        ? {
            id: cartTicket.id,
            name: cartTicket.name,
            price: Number(event.price_from ?? cartTicket.price ?? 0),
            quantity: Number(cartTicket.quantity || 0),
            available: Number(cartTicket.available ?? cartTicket.quantity ?? 0),
          }
        : null,
      event: {
        id: event.id,
        title: event.title,
        date: event.date,
        time: event.time,
        venue: event.venue,
        location: event.location,
        currency: event.currency || "EUR",
      },
      ticketCount,
    });
  } catch (e) {
    console.error("Amed form POST error:", e);
    return NextResponse.json({ success: false, message: "Sunucu hatası" }, { status: 500 });
  }
}
