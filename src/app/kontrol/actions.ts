"use server";

import { createClient } from "@supabase/supabase-js";

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
  const ticketCode = rawCode.trim().toUpperCase();
  const supabase = createAdminSupabase();
  
  try {
    if (!ticketCode) {
      return { valid: false, reason: "invalid", message: "Bilet kodu zorunludur." };
    }

    // Ticket kodunu kontrol et
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
