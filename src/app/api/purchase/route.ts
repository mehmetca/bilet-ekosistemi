import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from "crypto";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { fetchAllSeatsByRowIds } from "@/lib/fetch-all-seats-by-row-ids";
import { parsePhysicalDelivery, shippingFeeForPhysicalDelivery } from "@/lib/checkout-shipping";
import { createSupabaseServerClient } from "@/lib/supabase-ssr";
import { getStripe } from "@/lib/stripe-server";
import type { TicketType } from "@/types/database";
import {
  resolveTicketForPlanRow,
  type TicketLike,
} from "@/lib/ticket-seating-match";
import { isEventPubliclyVisible } from "@/lib/event-visibility";
import { getFulfillmentAuthToken } from "@/lib/fulfillment-auth";
import { BrevoClient } from "@getbrevo/brevo";
import {
  escapeHtml,
  sendTicketEmail,
  type SeatDetail,
  type TicketUnitDetail,
} from "@/lib/ticket-email";

/** Kriptografik güvenli bilet kodu: BLT- + 8 karakter (0/O/1/I yok, tahmin edilemez). */
function generateTicketCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "BLT-";
  const bytes = randomBytes(8);
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(bytes[i]! % chars.length);
  }
  return code;
}




async function getEventSummary(
  supabase: any,
  eventId: string | null | undefined
): Promise<{ title?: string; date?: string; time?: string; venue?: string; location?: string }> {
  if (!eventId) return {};

  const { data } = await supabase
    .from("events")
    .select("title, date, time, venue, location")
    .eq("id", eventId)
    .single();
  const row = data || {};

  return {
    title: row.title,
    date: row.date,
    time: row.time,
    venue: row.venue,
    location: row.location,
  };
}

/**
 * Fiyat kategorisine göre bilet: yalnızca o bilet türüne eşlenen sıralardan
 * en iyi müsait yan yana N koltuğu döner.
 * Eski hata: bölüm adı "Balkon Sol" tüm balkon sıralarını (VIP+normal) açıyordu.
 */
async function assignBestAvailableSeats(
  supabase: SupabaseClient,
  eventId: string,
  seatingPlanId: string,
  ticketId: string,
  ticketTypeName: string,
  quantity: number,
  catalogTickets: TicketLike[]
): Promise<string[]> {
  const targetTicketId = String(ticketId || "").trim();
  if (!targetTicketId) return [];

  const ticketsForMatch: TicketLike[] =
    catalogTickets.length > 0
      ? catalogTickets
      : [{ id: targetTicketId, name: ticketTypeName }];

  const { data: allSections } = await supabase
    .from("seating_plan_sections")
    .select("id, name, sort_order, ticket_type_label")
    .eq("seating_plan_id", seatingPlanId)
    .order("sort_order", { ascending: true });

  if (!allSections?.length) return [];

  const sectionById = new Map(
    allSections.map((s) => [
      s.id,
      {
        id: s.id,
        name: String(s.name || ""),
        sort_order: (s as { sort_order?: number }).sort_order ?? 0,
        ticket_type_label: String((s as { ticket_type_label?: string | null }).ticket_type_label || ""),
      },
    ])
  );

  const { data: allRows } = await supabase
    .from("seating_plan_rows")
    .select("id, section_id, row_label, sort_order, ticket_type_label")
    .in(
      "section_id",
      allSections.map((s) => s.id)
    )
    .order("sort_order", { ascending: true });

  if (!allRows?.length) return [];

  // Yalnızca bu katalog biletine çözümlenen sıralar
  const matchedRows = allRows.filter((r) => {
    const sec = sectionById.get(String((r as { section_id: string }).section_id));
    if (!sec) return false;
    const resolved = resolveTicketForPlanRow(
      {
        sectionName: sec.name,
        sectionTicketTypeLabel: sec.ticket_type_label,
        rowTicketTypeLabel: String((r as { ticket_type_label?: string | null }).ticket_type_label || ""),
      },
      ticketsForMatch
    );
    return resolved?.id === targetTicketId;
  });

  if (!matchedRows.length) return [];

  const sectionOrder = new Map(
    [...sectionById.values()].map((s) => [s.id, s.sort_order] as const)
  );
  const rowById = new Map(
    matchedRows.map((r) => [
      r.id,
      {
        id: r.id,
        section_id: String((r as { section_id: string }).section_id),
        row_label: String((r as { row_label?: string }).row_label || ""),
        sort_order: (r as { sort_order?: number }).sort_order ?? 0,
      },
    ])
  );

  const rowIds = matchedRows.map((r) => r.id as string);
  let seats: { id: string; row_id: string; seat_label: string; sales_blocked?: boolean | null }[];
  try {
    seats = await fetchAllSeatsByRowIds(supabase, rowIds, "id, row_id, seat_label, sales_blocked");
  } catch {
    return [];
  }
  if (!seats.length) return [];

  const soldSet = new Set<string>();
  const { data: completedOrders } = await supabase
    .from("orders")
    .select("id")
    .eq("event_id", eventId)
    .eq("status", "completed");
  if (completedOrders?.length) {
    const { data: orderSeats } = await supabase
      .from("order_seats")
      .select("seat_id")
      .in(
        "order_id",
        completedOrders.map((o: { id: string }) => o.id)
      );
    (orderSeats || []).forEach((s: { seat_id: string }) => soldSet.add(s.seat_id));
  }

  // Aktif hold'lu koltukları kategori atamasından çıkar (başkasının sepetindeki koltuğu çalma)
  const heldSet = new Set<string>();
  const nowIso = new Date().toISOString();
  const { data: activeHolds } = await supabase
    .from("seat_holds")
    .select("seat_id")
    .eq("event_id", eventId)
    .gt("held_until", nowIso);
  (activeHolds || []).forEach((h: { seat_id: string }) => heldSet.add(h.seat_id));

  type SeatInfo = {
    id: string;
    row_id: string;
    seat_label: string;
    section_sort: number;
    row_sort: number;
  };
  const available: SeatInfo[] = [];
  for (const s of seats) {
    if (s.sales_blocked) continue;
    if (soldSet.has(s.id)) continue;
    if (heldSet.has(s.id)) continue;
    const row = rowById.get(s.row_id);
    if (!row) continue;
    available.push({
      id: s.id,
      row_id: s.row_id,
      seat_label: s.seat_label,
      section_sort: sectionOrder.get(row.section_id) ?? 0,
      row_sort: row.sort_order,
    });
  }

  available.sort((a, b) => {
    if (a.section_sort !== b.section_sort) return a.section_sort - b.section_sort;
    if (a.row_sort !== b.row_sort) return a.row_sort - b.row_sort;
    const na = parseInt(a.seat_label, 10);
    const nb = parseInt(b.seat_label, 10);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
    return String(a.seat_label).localeCompare(String(b.seat_label));
  });

  const byRow = new Map<string, SeatInfo[]>();
  for (const s of available) {
    const list = byRow.get(s.row_id) || [];
    list.push(s);
    byRow.set(s.row_id, list);
  }

  for (const list of byRow.values()) {
    if (list.length < quantity) continue;
    for (let i = 0; i <= list.length - quantity; i++) {
      const slice = list.slice(i, i + quantity);
      const consecutive = slice.every((s, j) => {
        if (j === 0) return true;
        const prev = parseInt(slice[j - 1]!.seat_label, 10);
        const curr = parseInt(s.seat_label, 10);
        if (!Number.isNaN(prev) && !Number.isNaN(curr)) return curr === prev + 1;
        return true;
      });
      if (consecutive) return slice.map((s) => s.id);
    }
  }

  return available.slice(0, quantity).map((s) => s.id);
}


async function getAdminNotificationConfig(supabase: SupabaseClient): Promise<{
  enabled: boolean;
  email: string;
}> {
  let enabled = true;
  let email =
    (process.env.ADMIN_ORDER_ALERT_EMAIL || "").trim() || "info@kurdevents.com";

  try {
    const { data } = await supabase
      .from("site_settings")
      .select("key, value")
      .in("key", ["enable_notifications", "contact_email"]);

    const byKey = new Map(
      ((data || []) as Array<{ key: string; value: unknown }>).map((row) => [row.key, row.value])
    );

    if (typeof byKey.get("enable_notifications") === "boolean") {
      enabled = Boolean(byKey.get("enable_notifications"));
    }

    const contact = byKey.get("contact_email");
    if (typeof contact === "string" && contact.trim()) {
      email = contact.trim();
    }
  } catch {
    /* varsayılanlar */
  }

  return { enabled, email };
}

async function sendAdminOrderNotification(payload: {
  buyerName: string;
  buyerEmail: string;
  quantity: number;
  ticketCode: string;
  ticketType: string;
  totalPrice: number;
  currency?: string;
  eventTitle?: string;
  eventDate?: string;
  eventTime?: string;
  venue?: string;
  seatDetails?: SeatDetail[];
  ticketCodes?: string[];
  physicalDelivery?: "none" | "standard" | "express";
  buyerAddress?: string | null;
  buyerPlz?: string | null;
  buyerCity?: string | null;
  shippingFee?: number;
  adminEmail: string;
}) {
  try {
    const brevoApiKey = process.env.BREVO_API_KEY;
    const fromEmail = process.env.BREVO_FROM_EMAIL;
    const fromName = process.env.BREVO_FROM_NAME;

    if (!brevoApiKey || !fromEmail || !fromName) {
      return { sent: false, reason: "Brevo yapılandırması eksik." };
    }

    const currency = (payload.currency || "EUR").toUpperCase();
    const isPhysical =
      payload.physicalDelivery &&
      payload.physicalDelivery !== "none" &&
      payload.buyerAddress &&
      payload.buyerPlz &&
      payload.buyerCity;

    const seatLines =
      payload.seatDetails && payload.seatDetails.length > 0
        ? payload.seatDetails
            .map(
              (s) =>
                `${escapeHtml(s.section_name)} / ${escapeHtml(s.row_label)} / ${escapeHtml(s.seat_label)}`
            )
            .join("<br/>")
        : "";

    const codes =
      payload.ticketCodes && payload.ticketCodes.length > 0
        ? payload.ticketCodes.map(escapeHtml).join(", ")
        : escapeHtml(payload.ticketCode);

    const subject = isPhysical
      ? `Yeni sipariş (fiziksel): ${payload.ticketCode}`
      : `Yeni sipariş: ${payload.ticketCode}`;

    const html = `
      <div style="font-family:Arial,sans-serif;color:#0f172a;">
        <h2 style="margin:0 0 10px;">Yeni sipariş bildirimi</h2>
        <p style="margin:0 0 8px;"><strong>Etkinlik:</strong> ${escapeHtml(payload.eventTitle || "-")}</p>
        <p style="margin:0 0 8px;"><strong>Tarih/Saat:</strong> ${escapeHtml(payload.eventDate || "-")} ${escapeHtml(payload.eventTime || "")}</p>
        <p style="margin:0 0 8px;"><strong>Mekan:</strong> ${escapeHtml(payload.venue || "-")}</p>
        <p style="margin:0 0 8px;"><strong>Bilet türü:</strong> ${escapeHtml(payload.ticketType)}</p>
        <p style="margin:0 0 8px;"><strong>Adet:</strong> ${payload.quantity}</p>
        <p style="margin:0 0 8px;"><strong>Tutar:</strong> ${escapeHtml(currency)} ${Number(payload.totalPrice || 0).toFixed(2)}</p>
        <p style="margin:0 0 8px;"><strong>Bilet kodu(ları):</strong> ${codes}</p>
        ${seatLines ? `<p style="margin:0 0 8px;"><strong>Koltuklar:</strong><br/>${seatLines}</p>` : ""}
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:12px 0;" />
        <p style="margin:0 0 8px;"><strong>Alıcı:</strong> ${escapeHtml(payload.buyerName)}</p>
        <p style="margin:0 0 8px;"><strong>E-posta:</strong> ${escapeHtml(payload.buyerEmail)}</p>
        ${isPhysical
          ? `
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:12px 0;" />
        <p style="margin:0 0 8px;"><strong>Teslimat:</strong> ${escapeHtml(payload.physicalDelivery)}</p>
        <p style="margin:0 0 8px;"><strong>Kargo ücreti:</strong> ${escapeHtml(currency)} ${Number(payload.shippingFee || 0).toFixed(2)}</p>
        <p style="margin:0;"><strong>Adres:</strong> ${escapeHtml(payload.buyerAddress)}, ${escapeHtml(payload.buyerPlz)} ${escapeHtml(payload.buyerCity)}</p>
        `
          : `<p style="margin:0;"><strong>Teslimat:</strong> E-bilet</p>`
        }
      </div>
    `;

    const brevo = new BrevoClient({
      apiKey: brevoApiKey,
    });

    const sendSmtpEmail = {
      to: [{
        email: payload.adminEmail,
        name: "Admin"
      }],
      sender: {
        name: fromName,
        email: fromEmail
      },
      subject: subject,
      htmlContent: html
    };

    await brevo.transactionalEmails.sendTransacEmail(sendSmtpEmail);
    return { sent: true };
  } catch (error: any) {
    return { sent: false, reason: error.message };
  }
}

export async function POST(request: NextRequest) {
  try {
    // Rate limit: IP başına dakikada 10 satın alma isteği
    const ip = getClientIp(request);
    if (!checkRateLimit(ip, { name: "purchase", windowMs: 60_000, max: 10 })) {
      return NextResponse.json(
        { success: false, message: "Çok fazla istek. Lütfen 1 dakika bekleyin." },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }

    const formData = await request.formData();
    const ticketId = formData.get("ticket_id") as string;
    const quantity = parseInt(formData.get("quantity") as string, 10);
    if (!Number.isInteger(quantity) || quantity !== quantity) {
      return NextResponse.json(
        { success: false, message: "Geçersiz adet değeri." },
        { status: 400 }
      );
    }
    const buyerName = (formData.get("buyer_name") as string)?.trim();
    if (buyerName && buyerName.length > 200) {
      return NextResponse.json(
        { success: false, message: "İsim çok uzun (max 200 karakter)." },
        { status: 400 }
      );
    }
    const buyerEmail = (formData.get("buyer_email") as string)?.trim();
    const buyerAddress = (formData.get("buyer_address") as string)?.trim() || null;
    const buyerPlz = (formData.get("buyer_plz") as string)?.trim() || null;
    const buyerCity = (formData.get("buyer_city") as string)?.trim() || null;
    const physicalDelivery = parsePhysicalDelivery(formData.get("physical_delivery") as string | null);
    const shippingFee = shippingFeeForPhysicalDelivery(physicalDelivery);
    const stripeSessionId = ((formData.get("stripe_session_id") as string | null) || "").trim();
    let seatIds: string[] = [];
    const seatHoldSessionIdRaw = (formData.get("seat_hold_session_id") as string | null) ?? null;
    const seatHoldSessionId =
      seatHoldSessionIdRaw && seatHoldSessionIdRaw.trim().length > 0
        ? seatHoldSessionIdRaw.trim()
        : null;
    try {
      const raw = formData.get("seat_ids") as string | null;
      if (raw) {
        const parsed = JSON.parse(raw);
        seatIds = Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
      }
    } catch {
      /* ignore */
    }
    if (seatIds.length > 0 && seatIds.length !== quantity) {
      return NextResponse.json(
        { success: false, message: "Koltuk sayısı ile adet uyuşmuyor." },
        { status: 400 }
      );
    }
    if (seatIds.length > 0) {
      const uniqueSeatIds = Array.from(new Set(seatIds));
      if (uniqueSeatIds.length !== seatIds.length) {
        return NextResponse.json(
          { success: false, message: "Ayni koltuk bir sipariste birden fazla secilemez." },
          { status: 400 }
        );
      }
      seatIds = uniqueSeatIds;
    }

    if (!ticketId || !quantity || !buyerName || !buyerEmail) {
      return NextResponse.json(
        { success: false, message: "Lütfen tüm alanları doldurun." },
        { status: 400 }
      );
    }

    if (!stripeSessionId) {
      return NextResponse.json(
        { success: false, message: "Ödeme oturumu doğrulanamadı. Lütfen ödemeyi tekrar başlatın." },
        { status: 402 }
      );
    }

    // Yalnızca sunucu fulfillment (webhook / ensure-fulfillment) sipariş üretebilir
    const expectedFulfillmentToken = getFulfillmentAuthToken();
    const providedFulfillmentToken = String(formData.get("fulfillment_token") || "").trim();
    if (
      !expectedFulfillmentToken ||
      !providedFulfillmentToken ||
      providedFulfillmentToken !== expectedFulfillmentToken
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Sipariş yalnızca ödeme doğrulama akışı üzerinden oluşturulabilir.",
        },
        { status: 403 }
      );
    }

    if (quantity < 1) {
      return NextResponse.json(
        { success: false, message: "Miktar en az 1 olmalıdır." },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(buyerEmail)) {
      return NextResponse.json(
        { success: false, message: "Geçerli bir e-posta adresi girin." },
        { status: 400 }
      );
    }

    if (shippingFee > 0) {
      if (!buyerAddress || !buyerPlz || !buyerCity) {
        return NextResponse.json(
          { success: false, message: "Basılı bilet gönderimi için adres, posta kodu ve şehir alanlarının tamamı zorunludur." },
          { status: 400 }
        );
      }
    }

    let supabase: SupabaseClient;
    try {
      supabase = getSupabaseAdmin();
    } catch {
      return NextResponse.json(
        { success: false, message: "Sunucu yapılandırması eksik. Lütfen yöneticiye bildirin." },
        { status: 500 }
      );
    }

    // Site ayarından maksimum bilet adedini al (varsayılan 10; tablo yoksa 10 kullanılır)
    let maxTicketQuantity = 10;
    try {
      const { data: settingsRow } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "max_ticket_quantity")
        .maybeSingle();
      if (settingsRow && typeof (settingsRow as { value?: number }).value === "number") {
        maxTicketQuantity = Math.max(1, Math.min(100, (settingsRow as { value: number }).value));
      }
    } catch {
      /* tablo yok veya hata: varsayılan 10 */
    }
    if (quantity > maxTicketQuantity) {
      return NextResponse.json(
        { success: false, message: `Sipariş başına en fazla ${maxTicketQuantity} bilet alabilirsiniz.` },
        { status: 400 }
      );
    }

    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    const claimedClientUserId = ((formData.get("client_user_id") as string) || "").trim() || null;
    let userId: string | null = null;
    if (token) {
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        userId = user.id;
        if (claimedClientUserId && claimedClientUserId !== user.id) {
          return NextResponse.json(
            { success: false, message: "Oturum ile hesap bilgisi uyuşmuyor. Sayfayı yenileyip tekrar deneyin." },
            { status: 403 }
          );
        }
      }
    }
    // İstemci Authorization göndermese bile tarayıcı çerez oturumu varsa siparişi hesaba bağla
    if (!userId) {
      try {
        const serverAuth = await createSupabaseServerClient();
        const { data: { session } } = await serverAuth.auth.getSession();
        const u = session?.user;
        if (u?.id) {
          userId = u.id;
          if (claimedClientUserId && claimedClientUserId !== u.id) {
            return NextResponse.json(
              { success: false, message: "Oturum ile hesap bilgisi uyuşmuyor. Sayfayı yenileyip tekrar deneyin." },
              { status: 403 }
            );
          }
        }
      } catch {
        /* çerez oturumu okunamadı */
      }
    }

    // Get ticket details
    const { data: ticket, error: ticketError } = await supabase
      .from("tickets")
      .select("*")
      .eq("id", ticketId)
      .single();

    if (ticketError || !ticket) {
      return NextResponse.json(
        { success: false, message: "Bilet bulunamadı." },
        { status: 404 }
      );
    }

    // Sadece onaylanmış etkinliklerde bilet satışı; otomatik koltuk ataması için seating_plan_id gerekir
    const { data: eventRow } = await supabase
      .from("events")
      .select("id, is_active, is_approved, is_draft, seating_plan_id, checkout_processing_fee, currency")
      .eq("id", ticket.event_id)
      .single();
    if (!eventRow || !isEventPubliclyVisible(eventRow)) {
      return NextResponse.json(
        { success: false, message: "Bu etkinlik satışa açık değil." },
        { status: 403 }
      );
    }

    const seatingPlanId = (eventRow as { seating_plan_id?: string }).seating_plan_id;
    const ticketTypeName = (ticket.name || ticket.ticket_type || "").toString().trim();
    const orderTicketTier: TicketType =
      String((ticket as { type?: string }).type || "").toLowerCase().trim() === "vip"
        ? "vip"
        : "normal";

    const { data: catalogTicketRows } = await supabase
      .from("tickets")
      .select("id, name, price, available")
      .eq("event_id", ticket.event_id);
    const catalogTickets: TicketLike[] = (catalogTicketRows || []).map((t) => ({
      id: String(t.id),
      name: String(t.name || ""),
      price: Number(t.price) || 0,
      available: Number(t.available) || 0,
    }));

    // Yer seçimi geldiğinde, tüm koltuklar etkinliğin bağlı olduğu salon planına ait olmalı
    // ve seçilen bilet kategorisine eşleşmeli.
    if (seatIds.length > 0 && seatingPlanId) {
      const { data: seatRows, error: seatRowsError } = await supabase
        .from("seats")
        .select("id, row_id, sales_blocked")
        .in("id", seatIds);
      if (seatRowsError || !seatRows || seatRows.length !== seatIds.length) {
        return NextResponse.json(
          { success: false, message: "Secilen koltuklardan bazilari gecersiz." },
          { status: 400 }
        );
      }
      const anyBlocked = seatRows.some((s) => (s as { sales_blocked?: boolean | null }).sales_blocked === true);
      if (anyBlocked) {
        return NextResponse.json(
          { success: false, message: "Secilen koltuklardan biri satisa kapali." },
          { status: 400 }
        );
      }

      const rowIds = Array.from(new Set(seatRows.map((s) => (s as { row_id: string }).row_id).filter(Boolean)));
      const { data: planRows, error: planRowsError } = await supabase
        .from("seating_plan_rows")
        .select("id, section_id, ticket_type_label")
        .in("id", rowIds);
      if (planRowsError || !planRows || planRows.length !== rowIds.length) {
        return NextResponse.json(
          { success: false, message: "Secilen koltuk satiri gecersiz." },
          { status: 400 }
        );
      }

      const sectionIds = Array.from(new Set(planRows.map((r) => (r as { section_id: string }).section_id).filter(Boolean)));
      const { data: sections, error: sectionsError } = await supabase
        .from("seating_plan_sections")
        .select("id, seating_plan_id, name, ticket_type_label")
        .in("id", sectionIds);
      if (sectionsError || !sections || sections.length !== sectionIds.length) {
        return NextResponse.json(
          { success: false, message: "Secilen koltuk bolumu gecersiz." },
          { status: 400 }
        );
      }

      const sectionById = new Map(
        sections.map((s) => [
          s.id,
          {
            seating_plan_id: (s as { seating_plan_id: string | null }).seating_plan_id,
            name: String((s as { name?: string }).name || ""),
            ticket_type_label: String((s as { ticket_type_label?: string | null }).ticket_type_label || ""),
          },
        ])
      );
      const invalidSeat = planRows.some(
        (row) => sectionById.get((row as { section_id: string }).section_id)?.seating_plan_id !== seatingPlanId
      );
      if (invalidSeat) {
        return NextResponse.json(
          { success: false, message: "Secilen koltuklar bu etkinlige ait degil." },
          { status: 400 }
        );
      }

      const rowById = new Map(
        planRows.map((r) => [
          r.id as string,
          {
            section_id: String((r as { section_id: string }).section_id),
            ticket_type_label: String((r as { ticket_type_label?: string | null }).ticket_type_label || ""),
          },
        ])
      );
      for (const seat of seatRows) {
        const row = rowById.get(String((seat as { row_id: string }).row_id));
        const sec = row ? sectionById.get(row.section_id) : null;
        if (!row || !sec) {
          return NextResponse.json(
            { success: false, message: "Secilen koltuk satiri gecersiz." },
            { status: 400 }
          );
        }
        const resolved = resolveTicketForPlanRow(
          {
            sectionName: sec.name,
            sectionTicketTypeLabel: sec.ticket_type_label,
            rowTicketTypeLabel: row.ticket_type_label,
          },
          catalogTickets
        );
        if (!resolved || resolved.id !== ticket.id) {
          return NextResponse.json(
            {
              success: false,
              message:
                "Seçilen koltuk bu bilet kategorisine ait değil. Lütfen haritadan doğru kategori koltuklarını seçin.",
            },
            { status: 400 }
          );
        }
      }
    }

    // Fiyat kategorisine göre bilet (seat_ids yok): oturum planı varsa en iyi müsait N koltuğu ata
    if (seatIds.length === 0 && quantity >= 1 && seatingPlanId) {
      const assigned = await assignBestAvailableSeats(
        supabase,
        ticket.event_id,
        seatingPlanId,
        ticket.id,
        ticketTypeName,
        quantity,
        catalogTickets
      );
      if (assigned.length >= quantity) {
        seatIds = assigned.slice(0, quantity);
      } else {
        return NextResponse.json(
          {
            success: false,
            message: assigned.length > 0
              ? `Bu kategoride yan yana ${quantity} koltuk bulunamadı. En fazla ${assigned.length} müsait koltuk var. Lütfen "Yer seçerek bilet al" ile koltuk seçin.`
              : "Bu etkinlikte oturum planı var; koltuk ataması yapılamadı (yeterli müsait koltuk yok veya plan tanımlı değil). Lütfen \"Yer seçerek bilet al\" kullanın.",
          },
          { status: 400 }
        );
      }
    }

    // Grup indirimli bilet: minimum adet (açıklamadaki "Min. X adet." ile uyumlu)
    const desc = (ticket.description || "").toString();
    const minAdetMatch = desc.match(/Min\.\s*(\d+)\s*adet/i);
    const minQuantity = minAdetMatch ? Math.max(1, parseInt(minAdetMatch[1], 10)) : 1;
    if (quantity < minQuantity) {
      return NextResponse.json(
        { success: false, message: `Bu bilet türünden en az ${minQuantity} adet alınmalıdır.` },
        { status: 400 }
      );
    }

    const ticketSubtotal = Number(ticket.price) * quantity;
    const includeProcessingFee = formData.get("include_checkout_processing_fee") === "true";
    const serverProcessingFee = Math.max(
      0,
      Number((eventRow as { checkout_processing_fee?: number | string | null }).checkout_processing_fee) || 0
    );
    const lineProcessingFee =
      includeProcessingFee && serverProcessingFee > 0 ? serverProcessingFee * quantity : 0;
    const totalPrice = ticketSubtotal + lineProcessingFee + shippingFee;
    const ticketCode = generateTicketCode(); // sipariş ana kodu (yer seçilmediyse veya tek bilet)

    if (Number(ticket.available || 0) < quantity) {
      return NextResponse.json(
        { success: false, message: `Yetersiz stok. Kalan bilet: ${ticket.available || 0}` },
        { status: 400 }
      );
    }

    let verifiedStripeSession: {
      payment_intent?: string | null;
      amount_total?: number | null;
      currency?: string | null;
    };
    try {
      const stripe = getStripe();
      const session = await stripe.checkout.sessions.retrieve(stripeSessionId);
      const stripePaid =
        session.status === "complete" &&
        (session.payment_status === "paid" || session.payment_status === "no_payment_required");
      if (!stripePaid) {
        return NextResponse.json(
          { success: false, message: "Ödeme tamamlanmadan sipariş oluşturulamaz." },
          { status: 402 }
        );
      }
      verifiedStripeSession = {
        payment_intent:
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id ?? null,
        amount_total: session.amount_total,
        currency: session.currency,
      };
    } catch (stripeError) {
      console.error("Stripe session verification failed in purchase:", stripeError);
      return NextResponse.json(
        { success: false, message: "Ödeme oturumu doğrulanamadı." },
        { status: 402 }
      );
    }

    const paidAmountCents = Number(verifiedStripeSession.amount_total || 0);
    const currentOrderAmountCents = Math.round(totalPrice * 100);
    const expectedCurrency = String(
      (eventRow as { currency?: string | null }).currency || "EUR"
    ).toLowerCase();

    // Checkout intent varsa tutar/e-posta/sepet satırı bağını doğrula
    const { data: checkoutIntent } = await supabase
      .from("stripe_checkout_intents")
      .select("total_amount_cents, currency, buyer_email, cart_json")
      .eq("stripe_session_id", stripeSessionId)
      .maybeSingle();

    if (!checkoutIntent) {
      return NextResponse.json(
        { success: false, message: "Ödeme oturumu kaydı bulunamadı." },
        { status: 402 }
      );
    }

    {
      const intentTotal = Number((checkoutIntent as { total_amount_cents?: number }).total_amount_cents || 0);
      const intentCurrency = String((checkoutIntent as { currency?: string }).currency || "").toLowerCase();
      const intentEmail = String((checkoutIntent as { buyer_email?: string }).buyer_email || "").toLowerCase();
      if (paidAmountCents !== intentTotal) {
        return NextResponse.json(
          { success: false, message: "Ödeme tutarı sepet kaydı ile uyuşmuyor." },
          { status: 402 }
        );
      }
      if (intentCurrency && intentCurrency !== expectedCurrency) {
        return NextResponse.json(
          { success: false, message: "Para birimi sepet kaydı ile uyuşmuyor." },
          { status: 402 }
        );
      }
      if (intentEmail && intentEmail !== buyerEmail.toLowerCase()) {
        return NextResponse.json(
          { success: false, message: "Alıcı e-postası ödeme oturumu ile uyuşmuyor." },
          { status: 402 }
        );
      }

      const cartJson = (checkoutIntent as { cart_json?: unknown }).cart_json;
      const cartLines = Array.isArray(cartJson) ? cartJson : [];
      type CartLine = { ticketId?: string; quantity?: number; seatIds?: string[] };
      const matchingLines = (cartLines as CartLine[]).filter(
        (line) => String(line?.ticketId || "") === ticketId
      );
      if (matchingLines.length === 0) {
        return NextResponse.json(
          { success: false, message: "Bu bilet ödeme sepetinde yok." },
          { status: 402 }
        );
      }

      const seatsMatchLine = (line: CartLine) => {
        const lineSeats = Array.isArray(line.seatIds) ? line.seatIds.map(String) : [];
        // Haritadan seçilmiş koltuklar: birebir eşleşmeli
        if (lineSeats.length > 0) {
          if (seatIds.length !== lineSeats.length) return false;
          const wanted = new Set(lineSeats);
          return seatIds.every((id) => wanted.has(id));
        }
        // Kategori / genel giriş: adet eşleşir; koltuklar sonradan atanmış olabilir
        const lineQty = Math.max(1, Number(line.quantity) || 1);
        return lineQty === quantity;
      };

      if (!matchingLines.some(seatsMatchLine)) {
        return NextResponse.json(
          { success: false, message: "Sepet satırı (adet/koltuk) ödeme kaydı ile uyuşmuyor." },
          { status: 402 }
        );
      }
    }

    if (
      paidAmountCents <= 0 ||
      currentOrderAmountCents <= 0 ||
      (verifiedStripeSession.currency || "").toLowerCase() !== expectedCurrency
    ) {
      return NextResponse.json(
        { success: false, message: "Ödeme tutarı veya para birimi siparişle uyuşmuyor." },
        { status: 402 }
      );
    }

    // Aynı oturum+aynı bilet kombinasyonu daha önce tamamlanda sipariş üretme.
    // Not: Bu kontrolü ödeme tutarı dağıtım kontrolünden önce yapıyoruz.
    // Aksi halde duplicate finalize çağrısı idempotent olarak başarılı dönmek yerine
    // "sipariş tutarı aşılıyor" hatasına düşebiliyor.
    const { data: existingCompletedOrders, error: existingCompletedOrdersError } = await supabase
      .from("orders")
      .select("id, quantity, total_price, ticket_code, buyer_name")
      .eq("stripe_session_id", stripeSessionId)
      .eq("ticket_id", ticketId)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(1);

    if (existingCompletedOrdersError) {
      console.error("Existing order lookup failed:", existingCompletedOrdersError);
      return NextResponse.json(
        { success: false, message: "Ödeme oturumu kontrol edilemedi." },
        { status: 500 }
      );
    }

    const existingOrder = existingCompletedOrders?.[0] as
      | {
          id: string;
          quantity: number;
          total_price: number | string;
          ticket_code: string | null;
          buyer_name: string | null;
        }
      | undefined;

    if (existingOrder) {
      if (seatIds.length > 0) {
        const { data: existingSeatRows, error: existingSeatRowsError } = await supabase
          .from("order_seats")
          .select("seat_id, section_name, row_label, seat_label, ticket_code")
          .eq("order_id", existingOrder.id);
        if (existingSeatRowsError) {
          console.error("Existing seat order lookup failed:", existingSeatRowsError);
          return NextResponse.json(
            { success: false, message: "Ödeme oturumu kontrol edilemedi." },
            { status: 500 }
          );
        }

        const existingSeatIds = new Set((existingSeatRows || []).map((row) => row.seat_id));
        const requestedSeatIds = new Set(seatIds);
        const seatsMatch =
          existingSeatIds.size === requestedSeatIds.size &&
          [...requestedSeatIds].every((id) => existingSeatIds.has(id));

        if (seatsMatch) {
          const existingSeatDetails = (existingSeatRows || []).map((s) => ({
            section_name: s.section_name ?? "",
            row_label: s.row_label ?? "",
            seat_label: s.seat_label ?? "",
            ticket_code: s.ticket_code ?? "",
          }));
          const existingSeatCodes = existingSeatDetails
            .map((s) => s.ticket_code || "")
            .filter((c) => c.length > 0);
          return NextResponse.json({
            success: true,
            message: "Siparişiniz başarıyla oluşturuldu!",
            ticketCode: existingOrder.ticket_code || "",
            emailSent: true,
            orderDetails: {
              buyerName: existingOrder.buyer_name || buyerName,
              quantity: Number(existingOrder.quantity || 0),
              ticketType: existingSeatDetails.length > 0
                ? [...new Set(existingSeatDetails.map((s) => s.section_name))].join(", ")
                : (ticket.name || ticket.ticket_type || "Standart"),
              ticketTier: orderTicketTier,
              price: Number(existingOrder.total_price),
              seatDetails: existingSeatDetails.length > 0 ? existingSeatDetails : undefined,
              ticketCodes: existingSeatCodes.length > 0 ? existingSeatCodes : undefined,
            },
          });
        }
      } else if (Number(existingOrder.quantity || 0) === quantity) {
        const { data: existingUnitRows, error: existingUnitRowsError } = await supabase
          .from("order_ticket_units")
          .select("ticket_code")
          .eq("order_id", existingOrder.id)
          .order("created_at", { ascending: true });

        if (
          existingUnitRowsError &&
          !/order_ticket_units|schema cache|PGRST/i.test(String(existingUnitRowsError.message || ""))
        ) {
          console.error("Existing ticket units lookup failed:", existingUnitRowsError);
          return NextResponse.json(
            { success: false, message: "Ödeme oturumu kontrol edilemedi." },
            { status: 500 }
          );
        }

        const existingTicketCodes = (existingUnitRows || [])
          .map((r) => String(r.ticket_code || "").trim())
          .filter((code) => code.length > 0);

        return NextResponse.json({
          success: true,
          message: "Siparişiniz başarıyla oluşturuldu!",
          ticketCode: existingOrder.ticket_code || "",
          emailSent: true,
          orderDetails: {
            buyerName: existingOrder.buyer_name || buyerName,
            quantity: Number(existingOrder.quantity || 0),
            ticketType: ticket.name || ticket.ticket_type || "Standart",
            ticketTier: orderTicketTier,
            price: Number(existingOrder.total_price),
            ticketCodes:
              existingTicketCodes.length > 0
                ? existingTicketCodes
                : existingOrder.ticket_code
                  ? [existingOrder.ticket_code]
                  : undefined,
          },
        });
      }
    }

    const { data: sessionOrders, error: sessionOrdersError } = await supabase
      .from("orders")
      .select("id, total_price")
      .eq("stripe_session_id", stripeSessionId);
    if (sessionOrdersError) {
      console.error("Stripe session order lookup failed:", sessionOrdersError);
      return NextResponse.json(
        { success: false, message: "Ödeme oturumu kontrol edilemedi." },
        { status: 500 }
      );
    }

    const alreadyAllocatedCents = (sessionOrders || []).reduce(
      (sum, order) => sum + Math.round(Number(order.total_price || 0) * 100),
      0
    );
    if (alreadyAllocatedCents + currentOrderAmountCents > paidAmountCents) {
      return NextResponse.json(
        { success: false, message: "Bu ödeme oturumu için sipariş tutarı aşılıyor." },
        { status: 409 }
      );
    }

    // Yer seçerek bilet: koltukların daha önce satılmamış olduğunu kontrol et (bir bilet bir defa satılır)
    if (seatIds.length > 0) {
      // Aktif hold varsa, sadece hold sahibi bu koltuğu satin alabilsin.
      const nowIso = new Date().toISOString();
      const { data: activeHolds } = await supabase
        .from("seat_holds")
        .select("seat_id, user_id, session_id, held_until")
        .eq("event_id", ticket.event_id)
        .in("seat_id", seatIds)
        .gt("held_until", nowIso);
      const blockedByOther = (activeHolds || []).some((h) => {
        const hold = h as { user_id?: string | null; session_id?: string | null };
        const ownedByUser = Boolean(userId && hold.user_id === userId);
        const ownedBySession = Boolean(seatHoldSessionId && hold.session_id === seatHoldSessionId);
        return !ownedByUser && !ownedBySession;
      });
      if (blockedByOther) {
        return NextResponse.json(
          { success: false, message: "Seçilen koltuklardan biri su anda baska bir kullanici tarafindan rezerve." },
          { status: 409 }
        );
      }

      const { data: completedOrders } = await supabase
        .from("orders")
        .select("id")
        .eq("event_id", ticket.event_id)
        .eq("status", "completed");
      if (completedOrders?.length) {
        const { data: orderSeats } = await supabase
          .from("order_seats")
          .select("seat_id")
          .in("order_id", completedOrders.map((o) => o.id));
        const soldSet = new Set((orderSeats || []).map((s) => (s as { seat_id: string }).seat_id));
        const alreadySold = seatIds.filter((id) => soldSet.has(id));
        if (alreadySold.length > 0) {
          return NextResponse.json(
            { success: false, message: "Seçilen koltuklardan biri veya birkaçı zaten satılmış. Lütfen salon planından müsait koltuk seçin." },
            { status: 400 }
          );
        }
      }
    }

    const { data: stockReserved, error: stockReserveError } = await supabase.rpc("reserve_ticket_stock", {
      p_ticket_id: ticketId,
      p_quantity: quantity,
    });
    if (stockReserveError) {
      console.error("API Stock reserve error:", stockReserveError);
      return NextResponse.json(
        { success: false, message: "Stok kontrolü yapılamadı. Lütfen tekrar deneyin." },
        { status: 500 }
      );
    }
    if (!stockReserved) {
      return NextResponse.json(
        { success: false, message: "Yetersiz stok. Lütfen bilet adedini güncelleyin." },
        { status: 409 }
      );
    }

    const orderRowBase: Record<string, unknown> = {
      event_id: ticket.event_id,
      ticket_id: ticketId,
      quantity: quantity,
      total_price: totalPrice,
      ticket_code: ticketCode,
      status: "completed",
      buyer_name: buyerName,
      buyer_email: buyerEmail,
      stripe_session_id: stripeSessionId,
      stripe_payment_intent_id: verifiedStripeSession.payment_intent || null,
      stripe_amount_total: paidAmountCents,
      stripe_currency: verifiedStripeSession.currency || null,
      ...(buyerAddress ? { buyer_address: buyerAddress } : {}),
      ...(buyerPlz ? { buyer_plz: buyerPlz } : {}),
      ...(buyerCity ? { buyer_city: buyerCity } : {}),
      ...(userId ? { user_id: userId } : {}),
    };

    const orderRowWithShipping = {
      ...orderRowBase,
      shipping_fee: shippingFee,
      delivery_method: physicalDelivery === "none" ? "e_ticket" : physicalDelivery,
    };

    let { data: orderData, error: orderError } = await supabase
      .from("orders")
      .insert(orderRowWithShipping as never)
      .select()
      .single();

    const errText = orderError ? String(orderError.message || "") : "";
    const shippingColumnsMissing =
      orderError &&
      (/delivery_method|shipping_fee|schema cache|PGRST204|Could not find the/i.test(errText) ||
        (orderError as { code?: string }).code === "PGRST204");

    if (shippingColumnsMissing) {
      console.warn(
        "[purchase] orders.shipping kolonları yok veya şema önbelleği eski; kargo alanları olmadan tekrar deneniyor. Migration 085 uygulayıp şemayı yenileyin:",
        errText
      );
      const retry = await supabase.from("orders").insert(orderRowBase as never).select().single();
      orderData = retry.data;
      orderError = retry.error;
    }

    if (orderError) {
      console.error("API Order error:", orderError);
      await supabase.rpc("release_ticket_stock", {
        p_ticket_id: ticketId,
        p_quantity: quantity,
      });

      // Unique (stripe_session_id, ticket_id) yarışında mevcut siparişi idempotent dön
      if ((orderError as { code?: string }).code === "23505") {
        const { data: racedOrders } = await supabase
          .from("orders")
          .select("id, quantity, total_price, ticket_code, buyer_name")
          .eq("stripe_session_id", stripeSessionId)
          .eq("ticket_id", ticketId)
          .eq("status", "completed")
          .order("created_at", { ascending: false })
          .limit(1);
        const raced = racedOrders?.[0] as
          | {
              id: string;
              quantity: number;
              total_price: number | string;
              ticket_code: string | null;
              buyer_name: string | null;
            }
          | undefined;
        if (raced) {
          const { data: racedSeats } = await supabase
            .from("order_seats")
            .select("section_name, row_label, seat_label, ticket_code")
            .eq("order_id", raced.id);
          const { data: racedUnits } = await supabase
            .from("order_ticket_units")
            .select("ticket_code")
            .eq("order_id", raced.id);
          const seatDetailsRaced = (racedSeats || []).map((s) => ({
            section_name: String((s as { section_name?: string }).section_name || ""),
            row_label: String((s as { row_label?: string }).row_label || ""),
            seat_label: String((s as { seat_label?: string }).seat_label || ""),
            ticket_code: String((s as { ticket_code?: string }).ticket_code || ""),
          }));
          const unitCodes = (racedUnits || [])
            .map((u) => String((u as { ticket_code?: string }).ticket_code || ""))
            .filter(Boolean);
          return NextResponse.json({
            success: true,
            message: "Siparişiniz başarıyla oluşturuldu!",
            ticketCode: raced.ticket_code || "",
            emailSent: true,
            orderDetails: {
              buyerName: raced.buyer_name || buyerName,
              quantity: Number(raced.quantity || 0),
              ticketType: ticket.name || ticket.ticket_type || "Standart",
              ticketTier: orderTicketTier,
              price: Number(raced.total_price),
              seatDetails: seatDetailsRaced.length > 0 ? seatDetailsRaced : undefined,
              ticketCodes:
                unitCodes.length > 0
                  ? unitCodes
                  : seatDetailsRaced.map((s) => s.ticket_code).filter(Boolean),
            },
          });
        }
      }

      return NextResponse.json(
        { success: false, message: `Sipariş oluşturulamadı: ${orderError.message}. Tekrar deneyin.` },
        { status: 500 }
      );
    }

    const seatDetails: SeatDetail[] = [];
    const ticketUnits: TicketUnitDetail[] = [];
    if (orderData?.id && seatIds.length > 0) {
      for (const seatId of seatIds) {
        const { data: seatRow } = await supabase
          .from("seats")
          .select("id, seat_label, row_id")
          .eq("id", seatId)
          .single();
        if (!seatRow?.row_id) continue;
        const { data: rowRow } = await supabase
          .from("seating_plan_rows")
          .select("id, row_label, section_id")
          .eq("id", seatRow.row_id)
          .single();
        if (!rowRow?.section_id) continue;
        const { data: sectionRow } = await supabase
          .from("seating_plan_sections")
          .select("id, name")
          .eq("id", rowRow.section_id)
          .single();
        const section_name = sectionRow?.name ?? "";
        const row_label = rowRow?.row_label ?? "";
        const seat_label = seatRow?.seat_label ?? "";
        const seatTicketCode = generateTicketCode();
        seatDetails.push({ section_name, row_label, seat_label, ticket_code: seatTicketCode });
        ticketUnits.push({ ticket_code: seatTicketCode });
        const { error: seatInsertError } = await supabase.from("order_seats").insert({
          order_id: orderData.id,
          event_id: ticket.event_id,
          seat_id: seatId,
          section_name,
          row_label,
          seat_label,
          ticket_code: seatTicketCode,
        });
        if (seatInsertError) {
          const isDuplicateSeat = seatInsertError.code === "23505";
          await supabase.from("orders").delete().eq("id", orderData.id);
          await supabase.rpc("release_ticket_stock", {
            p_ticket_id: ticketId,
            p_quantity: quantity,
          });
          return NextResponse.json(
            {
              success: false,
              message: isDuplicateSeat
                ? "Seçilen koltuklardan biri veya birkaçı zaten satılmış. Lütfen salon planından müsait koltuk seçin."
                : seatInsertError.message,
            },
            { status: 400 }
          );
        }
      }
      if (seatDetails.length !== seatIds.length) {
        console.error("[purchase] order_seats eksik:", {
          expected: seatIds.length,
          inserted: seatDetails.length,
          orderId: orderData.id,
        });
        await supabase.from("orders").delete().eq("id", orderData.id);
        await supabase.rpc("release_ticket_stock", {
          p_ticket_id: ticketId,
          p_quantity: quantity,
        });
        return NextResponse.json(
          {
            success: false,
            message:
              "Koltuk kayıtları tamamlanamadı. Lütfen tekrar deneyin veya yer seçerek bilet alın.",
          },
          { status: 500 }
        );
      }
    }

    if (orderData?.id && seatIds.length === 0) {
      const generatedCodes = Array.from({ length: quantity }, (_, idx) =>
        idx === 0 ? ticketCode : generateTicketCode()
      );
      const unitRows = generatedCodes.map((code) => ({
        order_id: orderData.id,
        event_id: ticket.event_id,
        ticket_code: code,
      }));

      const { error: ticketUnitsError } = await supabase
        .from("order_ticket_units")
        .insert(unitRows);

      if (ticketUnitsError) {
        console.error("API order_ticket_units insert error:", ticketUnitsError);
        await supabase.from("orders").delete().eq("id", orderData.id);
        await supabase.rpc("release_ticket_stock", {
          p_ticket_id: ticketId,
          p_quantity: quantity,
        });
        const missingUnitsTable = /order_ticket_units|schema cache|PGRST|Could not find the table/i.test(
          String(ticketUnitsError.message || "")
        );
        return NextResponse.json(
          {
            success: false,
            message: missingUnitsTable
              ? "Bilet birim tablosu bulunamadı. Lütfen migration 104_order_ticket_units.sql uygulayın."
              : "Tekil bilet kodları oluşturulamadı. Lütfen tekrar deneyin.",
          },
          { status: 500 }
        );
      }

      for (const code of generatedCodes) ticketUnits.push({ ticket_code: code });
    }

    const ticketCodes = ticketUnits.map((u) => u.ticket_code).filter((c) => c.length > 0);

    const eventSummary = await getEventSummary(supabase, ticket.event_id);
    const ticketTypeDisplay =
      seatDetails.length > 0
        ? [...new Set(seatDetails.map((s) => s.section_name))].join(", ")
        : (ticket.name || ticket.ticket_type || "Standart");
    const emailResult = await sendTicketEmail({
      buyerEmail,
      buyerName,
      ticketCode,
      quantity,
      ticketType: ticketTypeDisplay,
      totalPrice,
      eventTitle: eventSummary.title,
      eventDate: eventSummary.date,
      eventTime: eventSummary.time,
      venue: eventSummary.venue,
      location: eventSummary.location || ticket.city || ticket.location,
      seatDetails: seatDetails.length > 0 ? seatDetails : undefined,
      ticketCodes: ticketCodes.length > 0 ? ticketCodes : undefined,
    });

    if (!emailResult.sent) {
      console.error("Bilet e-postası gönderilemedi:", emailResult.reason);
    } else if (orderData?.id) {
      const { error: emailLogError } = await supabase.from("ticket_email_logs").insert({
        order_id: orderData.id,
        sent_by: null,
        source: "purchase",
      });
      if (emailLogError) {
        console.error("ticket_email_logs insert error:", emailLogError);
      }
    }

    try {
      const notif = await getAdminNotificationConfig(supabase);
      if (notif.enabled) {
        const adminResult = await sendAdminOrderNotification({
          buyerName,
          buyerEmail,
          quantity,
          ticketCode,
          ticketType: ticketTypeDisplay,
          totalPrice,
          currency: (eventRow as { currency?: string | null }).currency || "EUR",
          eventTitle: eventSummary.title,
          eventDate: eventSummary.date,
          eventTime: eventSummary.time,
          venue: eventSummary.venue,
          seatDetails: seatDetails.length > 0 ? seatDetails : undefined,
          ticketCodes: ticketCodes.length > 0 ? ticketCodes : undefined,
          physicalDelivery,
          buyerAddress,
          buyerPlz,
          buyerCity,
          shippingFee,
          adminEmail: notif.email,
        });
        if (!adminResult.sent) {
          console.error("Admin sipariş bildirimi gönderilemedi:", adminResult.reason);
        }
      }
    } catch (err) {
      console.error("Admin sipariş bildirimi gönderilemedi:", err);
    }

    return NextResponse.json({
      success: true,
      message: "Siparişiniz başarıyla oluşturuldu!",
      ticketCode,
      emailSent: emailResult.sent,
      emailError: emailResult.sent ? undefined : emailResult.reason,
      orderDetails: {
        buyerName,
        quantity,
        ticketType: ticketTypeDisplay,
        ticketTier: orderTicketTier,
        price: totalPrice,
        seatDetails: seatDetails.length > 0 ? seatDetails : undefined,
        ticketCodes: ticketCodes.length > 0 ? ticketCodes : undefined,
      },
    });

  } catch (error) {
    console.error("API Purchase error:", error);
    return NextResponse.json(
      { success: false, message: "Bilet satın alınırken bir hata oluştu. Lütfen tekrar deneyin." },
      { status: 500 }
    );
  }
}