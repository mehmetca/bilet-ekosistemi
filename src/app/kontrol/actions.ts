"use server";

import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { extractTicketCode } from "@/lib/ticket-code";
import { assertStaffFromCookies } from "@/lib/server-staff-auth";
import { checkControllerEventAccess } from "@/lib/controller-event-access";

export type CheckResult =
  | {
      valid: true;
      eventId: string;
      eventTitle: string;
      eventDate: string;
      eventTime: string;
      venue: string;
      buyerName: string;
      buyerEmail: string;
      quantity: number;
    }
  | {
      valid: false;
      reason: "not_found" | "used" | "invalid" | "error";
      message?: string;
      eventId?: string;
      eventTitle?: string;
      eventDate?: string;
      eventTime?: string;
      venue?: string;
      buyerName?: string;
      buyerEmail?: string;
      quantity?: number;
    };

/** API route tarafından auth sonrası çağrılır. */
export async function checkTicketCore(input: string | FormData): Promise<CheckResult> {
  const rawCode =
    typeof input === "string" ? input : String(input.get("ticket_code") || "");
  const ticketCode = extractTicketCode(rawCode);

  try {
    const supabase = getSupabaseAdmin();
    if (!ticketCode) {
      return { valid: false, reason: "invalid", message: "Bilet kodu zorunludur." };
    }

    // Önce adet-bazlı bilet birim kodu (koltuksuz çoklu alım)
    const { data: ticketUnit, error: ticketUnitError } = await supabase
      .from("order_ticket_units")
      .select("id, order_id, checked_at")
      .ilike("ticket_code", ticketCode)
      .maybeSingle();

    if (!ticketUnitError && ticketUnit) {
      if (ticketUnit.checked_at) {
        const { data: orderRow } = await supabase
          .from("orders")
          .select("event_id, buyer_name, buyer_email, events(title, date, time, location)")
          .eq("id", ticketUnit.order_id)
          .single();
        const o = orderRow as { event_id?: string; buyer_name?: string; buyer_email?: string; events?: { title?: string; date?: string; time?: string; location?: string } } | null;
        return {
          valid: false,
          reason: "used",
          message: "Bu bilet daha önce kullanılmıştır.",
          eventId: o?.event_id,
          eventTitle: o?.events?.title,
          eventDate: o?.events?.date,
          eventTime: o?.events?.time,
          venue: o?.events?.location,
          buyerName: o?.buyer_name || "Bilinmiyor",
          buyerEmail: o?.buyer_email || "Bilinmiyor",
          quantity: 1,
        };
      }

      const { data: orderWithEvent } = await supabase
        .from("orders")
        .select("event_id, status, buyer_name, buyer_email, events(*)")
        .eq("id", ticketUnit.order_id)
        .single();
      const ord = orderWithEvent as Record<string, unknown> | null;
      if (!ord) return { valid: false, reason: "not_found" };
      const status = ord.status as string;
      if (status !== "confirmed" && status !== "completed") {
        return { valid: false, reason: "invalid", message: "Bilet onaylanmamış", eventId: ord.event_id as string };
      }
      const ev = ord.events as { date?: string; time?: string; title?: string; location?: string } | null;
      const eventDate = new Date(`${ev?.date ?? ""} ${ev?.time || "23:59"}`);
      if (eventDate.getTime() && eventDate < new Date()) {
        return { valid: false, reason: "invalid", message: "Etkinlik tarihi geçmiş", eventId: ord.event_id as string };
      }
      return {
        valid: true,
        eventId: ord.event_id as string,
        eventTitle: ev?.title,
        eventDate: ev?.date,
        eventTime: ev?.time,
        venue: ev?.location,
        buyerName: (ord.buyer_name as string) || "Bilinmiyor",
        buyerEmail: (ord.buyer_email as string) || "Bilinmiyor",
        quantity: 1,
      };
    }

    // Önce koltuk bazlı bilet kodu (order_seats) – her koltuk ayrı kod
    const { data: orderSeat, error: seatError } = await supabase
      .from("order_seats")
      .select("id, order_id, checked_at")
      .ilike("ticket_code", ticketCode)
      .maybeSingle();

    if (!seatError && orderSeat) {
      if (orderSeat.checked_at) {
        const { data: orderRow } = await supabase
          .from("orders")
          .select("event_id, buyer_name, buyer_email, events(title, date, time, location)")
          .eq("id", orderSeat.order_id)
          .single();
        const o = orderRow as { event_id?: string; buyer_name?: string; buyer_email?: string; events?: { title?: string; date?: string; time?: string; location?: string } } | null;
        return {
          valid: false,
          reason: "used",
          message: "Bu bilet daha önce kullanılmıştır.",
          eventId: o?.event_id,
          eventTitle: o?.events?.title,
          eventDate: o?.events?.date,
          eventTime: o?.events?.time,
          venue: o?.events?.location,
          buyerName: o?.buyer_name || "Bilinmiyor",
          buyerEmail: o?.buyer_email || "Bilinmiyor",
          quantity: 1,
        };
      }
      const { data: orderWithEvent } = await supabase
        .from("orders")
        .select("event_id, status, buyer_name, buyer_email, events(*)")
        .eq("id", orderSeat.order_id)
        .single();
      const ord = orderWithEvent as Record<string, unknown> | null;
      if (!ord) return { valid: false, reason: "not_found" };
      const status = ord.status as string;
      if (status !== "confirmed" && status !== "completed") {
        return { valid: false, reason: "invalid", message: "Bilet onaylanmamış", eventId: ord.event_id as string };
      }
      const ev = ord.events as { date?: string; time?: string; title?: string; location?: string } | null;
      const eventDate = new Date(`${ev?.date ?? ""} ${ev?.time || "23:59"}`);
      if (eventDate.getTime() && eventDate < new Date()) {
        return { valid: false, reason: "invalid", message: "Etkinlik tarihi geçmiş", eventId: ord.event_id as string };
      }
      return {
        valid: true,
        eventId: ord.event_id as string,
        eventTitle: ev?.title,
        eventDate: ev?.date,
        eventTime: ev?.time,
        venue: ev?.location,
        buyerName: (ord.buyer_name as string) || "Bilinmiyor",
        buyerEmail: (ord.buyer_email as string) || "Bilinmiyor",
        quantity: 1,
      };
    }

    // Sipariş bazlı bilet kodu (orders) – sadece legacy tek biletler
    const { data: ticket, error } = await supabase
      .from("orders")
      .select(`
        *,
        events (*)
      `)
      .ilike("ticket_code", ticketCode)
      .single();

    if (error) {
      console.error("Ticket check error:", error);
      return { valid: false, reason: "not_found" };
    }

    if (!ticket) {
      return { valid: false, reason: "not_found" };
    }

    const [{ data: linkedSeats }, { data: linkedUnits }] = await Promise.all([
      supabase.from("order_seats").select("id").eq("order_id", ticket.id).limit(1),
      supabase.from("order_ticket_units").select("id").eq("order_id", ticket.id).limit(1),
    ]);
    if ((linkedSeats && linkedSeats.length > 0) || (linkedUnits && linkedUnits.length > 0)) {
      return {
        valid: false,
        reason: "invalid",
        message: "Bu siparişte her bilet için ayrı kod var. Lütfen tekil bilet kodunu okutun.",
        eventId: ticket.event_id,
      };
    }

    // Bilet durumunu kontrol et
    if (ticket.checked_at) {
      return {
        valid: false,
        reason: "used",
        message: "Bu bilet daha önce kullanılmıştır.",
        eventId: ticket.event_id,
        eventTitle: ticket.events?.title,
        eventDate: ticket.events?.date,
        eventTime: ticket.events?.time,
        venue: ticket.events?.location,
        buyerName: ticket.buyer_name || "Bilinmiyor",
        buyerEmail: ticket.buyer_email || "Bilinmiyor",
        quantity: ticket.quantity,
      };
    }

    if (ticket.status !== "confirmed" && ticket.status !== "completed") {
      return { valid: false, reason: "invalid", message: "Bilet onaylanmamış", eventId: ticket.event_id };
    }

    // Some schemas do not include payment_status; only enforce when present.
    if (
      "payment_status" in ticket &&
      ticket.payment_status &&
      ticket.payment_status !== "paid"
    ) {
      return { valid: false, reason: "invalid", message: "Ödeme yapılmamış", eventId: ticket.event_id };
    }

    // Etkinlik tarih/saatini kontrol et (saat yoksa gün sonu varsayılır)
    const eventDate = new Date(
      `${ticket.events.date} ${ticket.events.time || "23:59"}`
    );
    const now = new Date();
    
    if (eventDate < now) {
      return { valid: false, reason: "invalid", message: "Etkinlik tarihi geçmiş", eventId: ticket.event_id };
    }

    return {
      valid: true,
      eventId: ticket.event_id,
      eventTitle: ticket.events.title,
      eventDate: ticket.events.date,
      eventTime: ticket.events.time,
      venue: ticket.events.location,
      buyerName: ticket.buyer_name || "Bilinmiyor",
      buyerEmail: ticket.buyer_email || "Bilinmiyor",
      quantity: ticket.quantity,
    };
  } catch (error) {
    console.error("Ticket check server error:", error);
    return { valid: false, reason: "error", message: "Sunucu hatası" };
  }
}

/** Yalnızca admin/controller/organizer — çerez oturumu gerekir. */
export async function checkTicket(input: string | FormData): Promise<CheckResult> {
  const auth = await assertStaffFromCookies();
  if (auth.ok === false) {
    return {
      valid: false,
      reason: "error",
      message:
        auth.reason === "unauthenticated"
          ? "Bilet kontrolü için giriş yapmanız gerekiyor."
          : "Bu işlem için yetkiniz yok.",
    };
  }
  const result = await checkTicketCore(input);
  if (auth.roles.includes("controller") && !auth.roles.includes("admin")) {
    if (!result.eventId && (result.valid || ("reason" in result && result.reason === "used"))) {
      return {
        valid: false,
        reason: "error",
        message: "Etkinlik yetkisi doğrulanamadı.",
      };
    }
    if (result.eventId) {
      const access = await checkControllerEventAccess(
        getSupabaseAdmin(),
        auth.user.id,
        result.eventId
      );
      if ("reason" in access) {
        return {
          valid: false,
          reason: "error",
          message:
            access.reason === "unassigned"
              ? "Bu etkinlik için kontrolör olarak görevlendirilmemişsiniz."
              : "Etkinlik yetkiniz doğrulanamadı.",
        };
      }
    }
  }
  return result;
}
