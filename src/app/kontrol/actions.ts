"use server";

import { createClient } from "@supabase/supabase-js";
import { extractTicketCode } from "@/lib/ticket-code";

export type CheckResult =
  | {
      valid: true;
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
      eventTitle?: string;
      eventDate?: string;
      eventTime?: string;
      venue?: string;
      buyerName?: string;
      buyerEmail?: string;
      quantity?: number;
    };

function createAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

export async function checkTicket(input: string | FormData): Promise<CheckResult> {
  const rawCode =
    typeof input === "string" ? input : String(input.get("ticket_code") || "");
  const ticketCode = extractTicketCode(rawCode);
  const supabase = createAdminSupabase();
  
  try {
    if (!ticketCode) {
      return { valid: false, reason: "invalid", message: "Bilet kodu zorunludur." };
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
          .select("buyer_name, buyer_email, events(title, date, time, location)")
          .eq("id", orderSeat.order_id)
          .single();
        const o = orderRow as { buyer_name?: string; buyer_email?: string; events?: { title?: string; date?: string; time?: string; location?: string } } | null;
        return {
          valid: false,
          reason: "used",
          message: "Bu bilet daha önce kullanılmıştır.",
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
        .select("status, buyer_name, buyer_email, events(*)")
        .eq("id", orderSeat.order_id)
        .single();
      const ord = orderWithEvent as Record<string, unknown> | null;
      if (!ord) return { valid: false, reason: "not_found" };
      const status = ord.status as string;
      if (status !== "confirmed" && status !== "completed") {
        return { valid: false, reason: "invalid", message: "Bilet onaylanmamış" };
      }
      const ev = ord.events as { date?: string; time?: string; title?: string; location?: string } | null;
      const eventDate = new Date(`${ev?.date ?? ""} ${ev?.time || "23:59"}`);
      if (eventDate.getTime() && eventDate < new Date()) {
        return { valid: false, reason: "invalid", message: "Etkinlik tarihi geçmiş" };
      }
      return {
        valid: true,
        eventTitle: ev?.title,
        eventDate: ev?.date,
        eventTime: ev?.time,
        venue: ev?.location,
        buyerName: (ord.buyer_name as string) || "Bilinmiyor",
        buyerEmail: (ord.buyer_email as string) || "Bilinmiyor",
        quantity: 1,
      };
    }

    // Sipariş bazlı bilet kodu (orders) – eski tek bilet
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

    // Bilet durumunu kontrol et
    if (ticket.checked_at) {
      return {
        valid: false,
        reason: "used",
        message: "Bu bilet daha önce kullanılmıştır.",
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
      return { valid: false, reason: "invalid", message: "Bilet onaylanmamış" };
    }

    // Some schemas do not include payment_status; only enforce when present.
    if (
      "payment_status" in ticket &&
      ticket.payment_status &&
      ticket.payment_status !== "paid"
    ) {
      return { valid: false, reason: "invalid", message: "Ödeme yapılmamış" };
    }

    // Etkinlik tarih/saatini kontrol et (saat yoksa gün sonu varsayılır)
    const eventDate = new Date(
      `${ticket.events.date} ${ticket.events.time || "23:59"}`
    );
    const now = new Date();
    
    if (eventDate < now) {
      return { valid: false, reason: "invalid", message: "Etkinlik tarihi geçmiş" };
    }

    return {
      valid: true,
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

export async function validateTicket(ticketCode: string) {
  const supabase = createAdminSupabase();
  
  try {
    const normalizedCode = ticketCode.trim().toUpperCase();

    // Biletin daha önce kullanılıp kullanılmadığını kontrol et
    const { data: validation, error } = await supabase
      .from("ticket_validations")
      .select("*")
      .ilike("ticket_code", normalizedCode)
      .eq("is_validated", true)
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("Validation check error:", error);
      return { success: false, error: "Doğrulama hatası" };
    }

    if (validation) {
      return { success: false, error: "Bilet daha önce kullanılmış" };
    }

    // Bilet doğrulamasını kaydet
    const { error: insertError } = await supabase
      .from("ticket_validations")
      .insert({
        ticket_code: normalizedCode,
        validated_at: new Date().toISOString(),
        is_validated: true,
      });

    if (insertError) {
      console.error("Validation insert error:", insertError);
      return { success: false, error: "Doğrulama kaydedilemedi" };
    }

    return { success: true, message: "Bilet başarıyla doğrulandı" };
  } catch (error) {
    console.error("Ticket validation server error:", error);
    return { success: false, error: "Sunucu hatası" };
  }
}
