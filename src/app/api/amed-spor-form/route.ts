import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/api-auth";
import {
  persistAmedSporForm,
  type AmedSporFormAttendee,
  type AmedSporFormPayload,
} from "@/lib/amed-spor-form";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LANG_OK = new Set(["kurmanci", "türkçe", "ingilizce", "deutsch"]);

type Attendee = {
  full_name?: string;
  email?: string;
  phone?: string;
  id_country?: string;
  passo_number?: string;
};

type FormBody = {
  eventId?: string;
  ticketCount?: number;
  attendees?: Attendee[];
  seating_preference?: string;
  has_accommodation?: boolean;
  has_flight?: boolean;
  organization?: string | null;
  language_preference?: string;
  accept_phone_contact?: boolean;
  additional_notes?: string | null;
};

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

    const attendees: AmedSporFormAttendee[] = [];
    for (const a of attendeesRaw) {
      const full_name = String(a?.full_name || "").trim();
      const email = String(a?.email || "").trim().toLowerCase();
      const phone = String(a?.phone || "").trim();
      const id_country = String(a?.id_country || "").trim();
      const passo_number = String(a?.passo_number || "").trim();
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
      if (!id_country || !passo_number) {
        return NextResponse.json(
          { success: false, message: "Her kişi için kimlik/pasaport ülkesi ve Passo numarası zorunludur." },
          { status: 400 }
        );
      }
      attendees.push({ full_name, email, phone, id_country, passo_number });
    }

    const language_preference = String(body.language_preference || "").trim();
    if (!LANG_OK.has(language_preference)) {
      return NextResponse.json({ success: false, message: "Dil tercihi geçersiz." }, { status: 400 });
    }

    const seating_preference = body.seating_preference === "loca" ? "loca" : "vip";
    const has_accommodation = Boolean(body.has_accommodation);
    const has_flight = Boolean(body.has_flight);
    const organization = String(body.organization || "").trim() || null;
    const additional_notes = String(body.additional_notes || "").trim() || null;
    const accept_phone_contact = body.accept_phone_contact !== false;

    const supabase = getSupabaseAdmin();

    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("*")
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

    const maxAttendees = Math.max(1, Math.min(10, Number(event.custom_form_max_attendees) || 3));
    if (ticketCount > maxAttendees) {
      return NextResponse.json(
        { success: false, message: `Bu etkinlik için en fazla ${maxAttendees} kişi başvurabilirsiniz.` },
        { status: 400 }
      );
    }

    const basePrice = Math.max(0, Number(event.price_from) || 0);
    const accommodationFee = has_accommodation ? Math.max(0, Number(event.accommodation_price) || 0) : 0;
    const flightFee = has_flight ? Math.max(0, Number(event.flight_price) || 0) : 0;
    const packageUnitPrice = basePrice + accommodationFee + flightFee;
    const requiresPayment = packageUnitPrice > 0;
    const currency = String(event.currency || "EUR");

    const formPayload: AmedSporFormPayload = {
      eventId,
      ticketCount,
      attendees,
      seating_preference,
      has_accommodation,
      has_flight,
      organization,
      language_preference,
      accept_phone_contact,
      additional_notes,
    };

    // Ücretsiz başvuru: sepet/ödeme adımı yok → hemen kaydet.
    if (!requiresPayment) {
      const persisted = await persistAmedSporForm(supabase, formPayload, null);
      if (!persisted.ok) {
        return NextResponse.json(
          { success: false, message: persisted.message || "Form kaydedilemedi." },
          { status: 500 }
        );
      }
      return NextResponse.json({
        success: true,
        requiresPayment: false,
        mailSent: persisted.mailSent,
        formPayload,
        event: {
          id: event.id,
          title: event.title,
          date: event.date,
          time: event.time,
          venue: event.venue,
          location: event.location,
          currency,
        },
        ticketCount,
      });
    }

    // Ücretli başvuru: sepete eklenecek bilet varyantını bul/oluştur; kayıt ödeme sonrası yapılır.
    const { data: tickets, error: ticketsError } = await supabase
      .from("tickets")
      .select("id, name, price, quantity, available")
      .eq("event_id", eventId)
      .order("price", { ascending: true });

    if (ticketsError) {
      return NextResponse.json({ success: false, message: "Biletler okunamadı." }, { status: 500 });
    }

    const ticketList = (tickets || []).filter((t) => Number(t.available ?? 0) > 0);

    if (ticketList.length === 0) {
      return NextResponse.json(
        { success: false, message: "Satışa açık bilet bulunamadı." },
        { status: 400 }
      );
    }

    const seatingLabel = seating_preference === "loca" ? "Özel Loca" : "VIP Tribünü";
    const addOnList: string[] = [];
    if (has_accommodation && accommodationFee > 0) addOnList.push("Konaklama");
    if (has_flight && flightFee > 0) addOnList.push("Uçak");
    const suffix = addOnList.length > 0 ? ` (+${addOnList.join(", ")})` : "";
    const packageName = `Amedspor - ${seatingLabel}${suffix}`;

    let cartTicket =
      ticketList.find(
        (t) => t.name === packageName && Math.abs(Number(t.price) - packageUnitPrice) < 0.01
      ) || null;

    if (!cartTicket) {
      const { data: newTicket, error: createTicketError } = await supabase
        .from("tickets")
        .insert({
          event_id: eventId,
          name: packageName,
          type: seating_preference === "loca" ? "vip" : "normal",
          price: packageUnitPrice,
          quantity: Number(event.max_tickets || 1000),
          available: Number(event.max_tickets || 1000),
          description: `${event.title} - ${packageName}`,
        })
        .select()
        .single();

      if (!createTicketError && newTicket) {
        cartTicket = newTicket;
      } else {
        cartTicket = ticketList[0] || null;
      }
    }

    return NextResponse.json({
      success: true,
      requiresPayment: true,
      ticket: cartTicket
        ? {
            id: cartTicket.id,
            name: packageName,
            price: packageUnitPrice,
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
        currency,
      },
      ticketCount,
      formPayload,
    });
  } catch (e) {
    console.error("Amed form POST error:", e);
    return NextResponse.json({ success: false, message: "Sunucu hatası" }, { status: 500 });
  }
}

/**
 * Amed Spor kayıtlarını (event_form_responses) siler.
 * Sadece admin: satır bazlı (responseIds) veya tüm maç (eventId).
 * Service-role istemcisiyle yapıldığı için kayıtlar veritabanından kalıcı silinir.
 */
export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { supabase } = auth;

  let body: { eventId?: string; responseIds?: string[] };
  try {
    body = (await request.json()) as { eventId?: string; responseIds?: string[] };
  } catch {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }

  const eventId = typeof body?.eventId === "string" ? body.eventId.trim() : "";
  const responseIds = Array.isArray(body?.responseIds)
    ? body.responseIds.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    : [];

  let query = supabase.from("event_form_responses").delete();

  if (responseIds.length > 0) {
    query = query.in("id", responseIds);
  } else if (eventId) {
    query = query.eq("event_id", eventId);
  } else {
    return NextResponse.json(
      { error: "Silinecek kayıt belirtilmedi (eventId veya responseIds gerekli)." },
      { status: 400 }
    );
  }

  const { data, error } = await query.select();

  if (error) {
    console.error("Amed form kayıt silme hatası:", error.message);
    return NextResponse.json(
      { error: "Kayıtlar silinemedi: " + (error.message || "bilinmeyen hata") },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, deleted: (data || []).length });
}
