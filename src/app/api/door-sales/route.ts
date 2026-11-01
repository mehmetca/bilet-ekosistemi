import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { requireRole } from "@/lib/api-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { buildStaffAllowedEventIds } from "@/lib/staff-event-scope";
import { assignBestAvailableSeats, loadDoorSeatUniverse } from "@/lib/door-seat-assign";
import { generateTicketCode } from "@/lib/ticket-code";
import { isEventMarkedSoldOut } from "@/lib/event-visibility";
import { buildTicketMailPayloadForOrder, type TicketMailOrderRow } from "@/lib/order-ticket-mail";
import { sendTicketEmail, type SeatDetail } from "@/lib/ticket-email";
import { buildInvoiceMailAttachment } from "@/lib/invoice-mail";
import type { TicketLike } from "@/lib/ticket-seating-match";
import type { StaffRole } from "@/lib/server-staff-auth";

export const runtime = "nodejs";

type DoorPayment = "cash" | "card" | "free";

const MAX_DOOR_QUANTITY = 50;

function normPayment(value: unknown): DoorPayment | null {
  const s = String(value ?? "").trim().toLowerCase();
  if (s === "cash" || s === "nakit") return "cash";
  if (s === "card" || s === "kart") return "card";
  if (s === "free" || s === "davetiye" || s === "ucretsiz" || s === "ücretsiz") return "free";
  return null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function missingColumnsError(message: string): boolean {
  return /sales_channel|door_payment|sold_by|door_note|schema cache|PGRST204|Could not find the/i.test(
    message
  );
}

/**
 * Gişe (kapıda) satışı: ödemeli çevrimiçi akışa girmeden, yetkili kişinin
 * yüz yüze tahsil ettiği biletin sistemde kaydı. Stok, tekil kod ve bilet
 * maili çevrimiçi satışla aynı yollardan geçer.
 */
export async function POST(request: NextRequest) {
  try {
    // Admin kapıda satış yapmaz; satış gişe görevlisi ve organizatörün işidir.
    const auth = await requireRole(request, ["gate_sales", "organizer"]);
    if (auth instanceof NextResponse) return auth;

    const ip = getClientIp(request);
    if (!checkRateLimit(ip, { name: "door-sales", windowMs: 60_000, max: 30 })) {
      return NextResponse.json(
        { success: false, message: "Çok fazla istek. Lütfen biraz bekleyin." },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    const ticketId = String(body.ticket_id ?? "").trim();
    const quantity = Number.parseInt(String(body.quantity ?? ""), 10);
    const payment = normPayment(body.payment);
    const buyerName = String(body.buyer_name ?? "").trim().slice(0, 200);
    const buyerEmail = String(body.buyer_email ?? "").trim().toLowerCase();
    const note = String(body.note ?? "").trim().slice(0, 300);

    if (!ticketId) {
      return NextResponse.json(
        { success: false, message: "Bilet türü seçilmelidir." },
        { status: 400 }
      );
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_DOOR_QUANTITY) {
      return NextResponse.json(
        { success: false, message: `Adet 1 ile ${MAX_DOOR_QUANTITY} arasında olmalıdır.` },
        { status: 400 }
      );
    }
    if (!payment) {
      return NextResponse.json(
        { success: false, message: "Nakit, kart veya davetiye seçilmelidir." },
        { status: 400 }
      );
    }
    // Fatura (Rechnung) alıcı adı boş kesilemez → kapıda satışta ad soyad zorunlu.
    if (buyerName.split(/\s+/).filter(Boolean).length < 2) {
      return NextResponse.json(
        { success: false, message: "Müşterinin ad ve soyadını yazın; fatura bu isimle kesilir." },
        { status: 400 }
      );
    }
    if (buyerEmail && !EMAIL_RE.test(buyerEmail)) {
      return NextResponse.json(
        { success: false, message: "Geçerli bir e-posta adresi girin veya alanı boş bırakın." },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();

    const { data: ticket, error: ticketError } = await admin
      .from("tickets")
      .select("id, event_id, name, price, available")
      .eq("id", ticketId)
      .single();

    if (ticketError || !ticket) {
      return NextResponse.json(
        { success: false, message: "Bilet bulunamadı." },
        { status: 404 }
      );
    }

    const eventId = String((ticket as { event_id?: string }).event_id || "");
    const allowedEventIds = await buildStaffAllowedEventIds(
      admin,
      auth.roles as StaffRole[],
      auth.user.id
    );
    if (allowedEventIds !== null && !allowedEventIds.includes(eventId)) {
      return NextResponse.json(
        { success: false, message: "Bu etkinlikte gişe satışı yapma yetkiniz yok." },
        { status: 403 }
      );
    }

    const { data: eventRow } = await admin
      .from("events")
      .select("id, is_active, is_approved, is_draft, manual_sold_out, seating_plan_id, currency")
      .eq("id", eventId)
      .single();

    if (!eventRow) {
      return NextResponse.json(
        { success: false, message: "Etkinlik bulunamadı." },
        { status: 404 }
      );
    }
    // Kapı satışı taslak/onay bekleyen etkinlikte de çalışır; tek kilit etkinliğin kapatılmış olması.
    if ((eventRow as { is_active?: boolean | null }).is_active !== true) {
      return NextResponse.json(
        { success: false, message: "Bu etkinlik satışa açık değil." },
        { status: 403 }
      );
    }
    if (isEventMarkedSoldOut(eventRow)) {
      return NextResponse.json(
        { success: false, message: "Bu etkinlikte biletler tükendi olarak işaretli." },
        { status: 409 }
      );
    }

    const price = Number((ticket as { price?: number }).price) || 0;
    // Davetiye kasaya para girmez: tutar biletsiz sıfırlanır.
    const totalPrice = payment === "free" ? 0 : Math.round(price * quantity * 100) / 100;
    const currency = String((eventRow as { currency?: string }).currency || "EUR");
    const ticketTypeName = String((ticket as { name?: string }).name || "Standart");

    const seatIds: string[] = [];
    const seatingPlanId = (eventRow as { seating_plan_id?: string | null }).seating_plan_id;

    // Elle seçilen koltuklar (gişe): boşsa otomatik en iyi yan yana atamaya düşer.
    const requestedSeatIds = Array.isArray(body.seat_ids)
      ? [...new Set(body.seat_ids.map((id) => String(id ?? "").trim()).filter(Boolean))]
      : [];
    if (requestedSeatIds.length > 0 && requestedSeatIds.length !== quantity) {
      return NextResponse.json(
        { success: false, message: "Seçilen koltuk sayısı ile bilet adedi eşleşmiyor." },
        { status: 400 }
      );
    }
    if (requestedSeatIds.length > 0 && !seatingPlanId) {
      return NextResponse.json(
        { success: false, message: "Bu etkinliğin salon planı yok; koltuk seçilemez." },
        { status: 400 }
      );
    }

    if (seatingPlanId) {
      const { data: catalogRows } = await admin
        .from("tickets")
        .select("id, name, price, available")
        .eq("event_id", eventId);
      const catalogTickets: TicketLike[] = (catalogRows || []).map((t) => ({
        id: String((t as { id: string }).id),
        name: String((t as { name?: string }).name || ""),
        price: Number((t as { price?: number }).price) || 0,
        available: Number((t as { available?: number }).available) || 0,
      }));

      if (requestedSeatIds.length > 0) {
        const universe = await loadDoorSeatUniverse(
          admin,
          eventId,
          seatingPlanId,
          ticketId,
          ticketTypeName,
          catalogTickets
        );
        if (!universe) {
          return NextResponse.json(
            { success: false, message: "Bu bilet türü için salon planında sıra bulunamadı." },
            { status: 409 }
          );
        }
        const rowLabelById = new Map(universe.rows.map((r) => [r.id, r.row_label] as const));
        const nameById = new Map(
          universe.seats.map(
            (s) =>
              [
                s.id,
                `${rowLabelById.get(s.row_id) || "?"}-${s.seat_label}`,
              ] as const
          )
        );
        const blocked = requestedSeatIds.filter((id) => !universe.availableIds.has(id));
        if (blocked.length > 0) {
          const names = blocked.map((id) => nameById.get(id) || "bilinmeyen koltuk").join(", ");
          return NextResponse.json(
            {
              success: false,
              message: `Koltuk seçilemez (satılmış, ayrılmış veya bu bilet türüne ait değil): ${names}.`,
            },
            { status: 409 }
          );
        }
        seatIds.push(...requestedSeatIds);
      } else {
        const assigned = await assignBestAvailableSeats(
          admin,
          eventId,
          seatingPlanId,
          ticketId,
          ticketTypeName,
          quantity,
          catalogTickets
        );
        if (assigned.length !== quantity) {
          return NextResponse.json(
            {
              success: false,
              message: `Bu bilet türünde yan yana ${quantity} müsait koltuk yok.`,
            },
            { status: 409 }
          );
        }
        seatIds.push(...assigned);
      }
    }

    const { data: stockReserved, error: stockReserveError } = await admin.rpc(
      "reserve_ticket_stock",
      { p_ticket_id: ticketId, p_quantity: quantity }
    );
    if (stockReserveError) {
      console.error("[door-sales] reserve_ticket_stock:", stockReserveError);
      return NextResponse.json(
        { success: false, message: "Stok kontrolü yapılamadı. Lütfen tekrar deneyin." },
        { status: 500 }
      );
    }
    if (!stockReserved) {
      return NextResponse.json(
        { success: false, message: "Yetersiz stok. Adedi azaltın veya başka bilet türü seçin." },
        { status: 409 }
      );
    }

    const releaseStock = () =>
      admin.rpc("release_ticket_stock", { p_ticket_id: ticketId, p_quantity: quantity });

    const ticketCode = generateTicketCode();
    const orderRow: Record<string, unknown> = {
      event_id: eventId,
      ticket_id: ticketId,
      quantity,
      total_price: totalPrice,
      ticket_code: ticketCode,
      status: "completed",
      buyer_name: buyerName,
      buyer_email: buyerEmail || null,
      delivery_method: "e_ticket",
      sales_channel: "door",
      door_payment: payment,
      sold_by: auth.user.id,
      ...(note ? { door_note: note } : {}),
    };

    const { data: orderData, error: orderError } = await admin
      .from("orders")
      .insert(orderRow as never)
      .select()
      .single();

    if (orderError || !orderData) {
      await releaseStock();
      const message = String(orderError?.message || "");
      console.error("[door-sales] orders insert:", orderError);
      return NextResponse.json(
        {
          success: false,
          message: missingColumnsError(message)
            ? "Gişe kolonları veritabanında yok. 147_door_sales migration'ını uygulayın."
            : `Sipariş oluşturulamadı: ${message || "bilinmeyen hata"}`,
        },
        { status: missingColumnsError(message) ? 500 : 500 }
      );
    }

    const orderId = String((orderData as { id: string }).id);
    const seatDetails: SeatDetail[] = [];
    const ticketCodes: string[] = [];

    if (seatIds.length > 0) {
      for (const seatId of seatIds) {
        const { data: seatRow } = await admin
          .from("seats")
          .select("id, seat_label, row_id")
          .eq("id", seatId)
          .single();
        const rowId = (seatRow as { row_id?: string } | null)?.row_id;
        if (!rowId) continue;

        const { data: rowRow } = await admin
          .from("seating_plan_rows")
          .select("id, row_label, section_id")
          .eq("id", rowId)
          .single();
        const sectionId = (rowRow as { section_id?: string } | null)?.section_id;
        if (!sectionId) continue;

        const { data: sectionRow } = await admin
          .from("seating_plan_sections")
          .select("id, name")
          .eq("id", sectionId)
          .single();

        const seatTicketCode =
          seatDetails.length === 0 ? ticketCode : generateTicketCode();
        const detail: SeatDetail = {
          section_name: String((sectionRow as { name?: string } | null)?.name || ""),
          row_label: String((rowRow as { row_label?: string } | null)?.row_label || ""),
          seat_label: String((seatRow as { seat_label?: string } | null)?.seat_label || ""),
          ticket_code: seatTicketCode,
        };
        seatDetails.push(detail);
        ticketCodes.push(seatTicketCode);

        const { error: seatInsertError } = await admin.from("order_seats").insert({
          order_id: orderId,
          event_id: eventId,
          seat_id: seatId,
          section_name: detail.section_name,
          row_label: detail.row_label,
          seat_label: detail.seat_label,
          ticket_code: seatTicketCode,
        });

        if (seatInsertError) {
          const duplicateSeat = (seatInsertError as { code?: string }).code === "23505";
          await admin.from("orders").delete().eq("id", orderId);
          await releaseStock();
          return NextResponse.json(
            {
              success: false,
              message: duplicateSeat
                ? "Koltuklardan biri az önce satıldı. Lütfen tekrar deneyin."
                : seatInsertError.message,
            },
            { status: 409 }
          );
        }
      }

      if (seatDetails.length !== seatIds.length) {
        await admin.from("orders").delete().eq("id", orderId);
        await releaseStock();
        return NextResponse.json(
          { success: false, message: "Koltuk kayıtları tamamlanamadı. Tekrar deneyin." },
          { status: 500 }
        );
      }

      const { error: unitsError } = await admin.from("order_ticket_units").insert(
        seatDetails.map((seat) => ({
          order_id: orderId,
          event_id: eventId,
          ticket_code: seat.ticket_code,
        }))
      );
      if (unitsError) {
        console.error("[door-sales] order_ticket_units (seat):", unitsError);
      }
    } else {
      const generated = Array.from({ length: quantity }, (_, idx) =>
        idx === 0 ? ticketCode : generateTicketCode()
      );
      ticketCodes.push(...generated);
      const { error: unitsError } = await admin.from("order_ticket_units").insert(
        generated.map((code) => ({
          order_id: orderId,
          event_id: eventId,
          ticket_code: code,
        }))
      );
      if (unitsError) {
        console.error("[door-sales] order_ticket_units:", unitsError);
        await admin.from("orders").delete().eq("id", orderId);
        await releaseStock();
        return NextResponse.json(
          { success: false, message: "Bilet kodları oluşturulamadı. Tekrar deneyin." },
          { status: 500 }
        );
      }
    }

    let emailSent = false;
    let emailReason: string | null = null;
    if (buyerEmail) {
      try {
        const payload = await buildTicketMailPayloadForOrder(admin, {
          ...(orderData as TicketMailOrderRow),
          buyer_email: buyerEmail,
          buyer_name: orderRow.buyer_name as string,
        });
        const invoiceAttachment = await buildInvoiceMailAttachment(orderId);
        payload.invoicePdfBase64 = invoiceAttachment?.base64;
        payload.invoiceNumber = invoiceAttachment?.number;
        const result = await sendTicketEmail(payload);
        emailSent = Boolean(result?.sent);
        emailReason = emailSent ? null : String(result?.reason || "Mail gönderilemedi.");
        if (emailSent) {
          await admin.from("ticket_email_logs").insert({
            order_id: orderId,
            sent_by: auth.user.id,
            source: "admin",
            sent_at: new Date().toISOString(),
          });
        }
      } catch (error) {
        console.error("[door-sales] bilet maili:", error);
        emailReason = "Mail gönderilemedi, bilet yine de kesildi.";
      }
    }

    return NextResponse.json({
      success: true,
      orderId,
      orderNumber: String((orderData as { order_number?: string }).order_number || ""),
      ticketCodes,
      seatDetails: seatDetails.length > 0 ? seatDetails : undefined,
      quantity,
      totalPrice,
      currency,
      payment,
      emailSent,
      emailReason,
    });
  } catch (error) {
    console.error("[door-sales] beklenmeyen hata:", error);
    return NextResponse.json(
      { success: false, message: "Gişe satışı tamamlanamadı." },
      { status: 500 }
    );
  }
}

/**
 * Günün gişe kayıtları + nakit/kart toplamları.
 * GET /api/door-sales?event_id=<uuid>&date=YYYY-MM-DD
 * event_id yoksa: admin günün tüm kapı satışlarını, diğer roller yalnız yetkili etkinliklerin görür.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireRole(request, ["admin", "organizer", "gate_sales"]);
    if (auth instanceof NextResponse) return auth;

    const eventId = request.nextUrl.searchParams.get("event_id")?.trim() || "";

    const admin = getSupabaseAdmin();
    const allowedEventIds = await buildStaffAllowedEventIds(
      admin,
      auth.roles as StaffRole[],
      auth.user.id
    );
    if (eventId && allowedEventIds !== null && !allowedEventIds.includes(eventId)) {
      return NextResponse.json(
        { success: false, message: "Bu etkinliğin gişe verileri size açık değil." },
        { status: 403 }
      );
    }

    // from/to: tarayıcının yerel gün sınırından üretilen mutlak anlar (ISO).
    // Gün boşsa UTC bugüne düşülür.
    const rawDate = request.nextUrl.searchParams.get("date")?.trim();
    const day = /^\d{4}-\d{2}-\d{2}$/.test(rawDate || "")
      ? String(rawDate)
      : new Date().toISOString().slice(0, 10);
    const rawFrom = request.nextUrl.searchParams.get("from")?.trim();
    const rawTo = request.nextUrl.searchParams.get("to")?.trim();
    const from =
      rawFrom && !Number.isNaN(Date.parse(rawFrom)) ? rawFrom : `${day}T00:00:00.000Z`;
    const to =
      rawTo && !Number.isNaN(Date.parse(rawTo))
        ? rawTo
        : `${day}T23:59:59.999Z`;

    let ordersQuery = admin
      .from("orders")
      .select(
        "id, order_number, event_id, ticket_id, ticket_code, quantity, total_price, status, buyer_name, buyer_email, door_payment, door_note, created_at, sold_by"
      )
      .eq("sales_channel", "door")
      .gte("created_at", from)
      .lte("created_at", to)
      .order("created_at", { ascending: false })
      .limit(300);

    if (eventId) {
      ordersQuery = ordersQuery.eq("event_id", eventId);
    } else if (allowedEventIds !== null) {
      if (allowedEventIds.length === 0) {
        return NextResponse.json({
          success: true,
          day,
          sales: [],
          totals: { cash: 0, card: 0, gross: 0, orders: 0, tickets: 0, free: 0, cancelled: 0 },
        });
      }
      ordersQuery = ordersQuery.in("event_id", allowedEventIds);
    }

    const { data: rows, error } = await ordersQuery;

    if (error) {
      console.error("[door-sales] liste:", error);
      return NextResponse.json(
        {
          success: false,
          message:
            "Gişe listesi alınamadı. 147_door_sales migration'ını uygulayın.",
        },
        { status: 500 }
      );
    }

    const sales = (rows || []) as Array<Record<string, unknown>>;

    const ticketIds = [
      ...new Set(sales.map((s) => String(s.ticket_id || "")).filter(Boolean)),
    ];
    const sellerIds = [
      ...new Set(sales.map((s) => String(s.sold_by || "")).filter(Boolean)),
    ];
    const eventIds = [
      ...new Set(sales.map((s) => String(s.event_id || "")).filter(Boolean)),
    ];

    const [ticketNameRows, eventTitleRows, sellerNames] = await Promise.all([
      ticketIds.length
        ? admin.from("tickets").select("id, name").in("id", ticketIds)
        : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
      eventIds.length
        ? admin.from("events").select("id, title, date").in("id", eventIds)
        : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
      Promise.all(
        sellerIds.map(async (id) => {
          const { data } = await admin.rpc("staff_display_name", { p_user_id: id });
          return [id, String(data || "")] as const;
        })
      ),
    ]);

    const ticketNameById = new Map(
      ((ticketNameRows.data || []) as Array<Record<string, unknown>>).map((row) => [
        String(row.id),
        String(row.name || "Bilet"),
      ])
    );
    const eventById = new Map(
      ((eventTitleRows.data || []) as Array<Record<string, unknown>>).map((row) => [
        String(row.id),
        row,
      ])
    );
    const sellerNameById = new Map(sellerNames);

    const enriched: Array<Record<string, unknown>> = sales.map((s) => {
      const event = eventById.get(String(s.event_id || ""));
      return {
        ...s,
        ticket_name: ticketNameById.get(String(s.ticket_id || "")) || null,
        seller_name: sellerNameById.get(String(s.sold_by || "")) || null,
        event_title: event ? String(event.title || "") : null,
        event_date: event ? String(event.date || "") : null,
      };
    });

    const completed = enriched.filter((s) => s.status === "completed");
    const cash = completed.reduce(
      (sum, s) => sum + (s.door_payment === "cash" ? Number(s.total_price) || 0 : 0),
      0
    );
    const card = completed.reduce(
      (sum, s) => sum + (s.door_payment === "card" ? Number(s.total_price) || 0 : 0),
      0
    );
    const tickets = completed.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);
    const freeTickets = completed.reduce(
      (sum, s) => sum + (s.door_payment === "free" ? Number(s.quantity) || 0 : 0),
      0
    );

    const sellerTotals = new Map<string, { name: string; orders: number; tickets: number; gross: number }>();
    for (const s of completed) {
      const key = String(s.sold_by || "bilinmeyen");
      const current = sellerTotals.get(key) || {
        name: String(s.seller_name || "Bilinmeyen görevli"),
        orders: 0,
        tickets: 0,
        gross: 0,
      };
      current.orders += 1;
      current.tickets += Number(s.quantity) || 0;
      current.gross += Number(s.total_price) || 0;
      sellerTotals.set(key, current);
    }
    const bySeller = [...sellerTotals.values()].map((row) => ({
      ...row,
      gross: Math.round(row.gross * 100) / 100,
    }));

    return NextResponse.json({
      success: true,
      day,
      sales: enriched,
      bySeller,
      totals: {
        cash: Math.round(cash * 100) / 100,
        card: Math.round(card * 100) / 100,
        gross: Math.round((cash + card) * 100) / 100,
        orders: completed.length,
        tickets,
        free: freeTickets,
        cancelled: sales.length - completed.length,
      },
    });
  } catch (error) {
    console.error("[door-sales GET] beklenmeyen hata:", error);
    return NextResponse.json(
      { success: false, message: "Gişe listesi alınamadı." },
      { status: 500 }
    );
  }
}
