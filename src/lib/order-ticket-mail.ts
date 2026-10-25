import type { SupabaseClient } from "@supabase/supabase-js";
import type { SeatDetail, TicketMailPayload } from "@/lib/ticket-email";

export type TicketMailOrderRow = {
  id: string;
  event_id: string;
  ticket_id?: string | null;
  ticket_code?: string | null;
  quantity: number;
  total_price: number;
  buyer_name?: string | null;
  buyer_email?: string | null;
};

/** Sipariş + etkinlik + koltuk/birim kodlarından mail/PDF payload'ı kurar. */
export async function buildTicketMailPayloadForOrder(
  supabase: SupabaseClient,
  order: TicketMailOrderRow
): Promise<TicketMailPayload> {
  const [eventRes, ticketRes, seatRes, unitRes] = await Promise.all([
    supabase
      .from("events")
      .select("title, date, time, venue, location")
      .eq("id", order.event_id)
      .maybeSingle(),
    order.ticket_id
      ? supabase
          .from("tickets")
          .select("name, ticket_type")
          .eq("id", order.ticket_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("order_seats")
      .select("section_name, row_label, seat_label, ticket_code")
      .eq("order_id", order.id)
      .order("id", { ascending: true }),
    supabase
      .from("order_ticket_units")
      .select("ticket_code")
      .eq("order_id", order.id)
      .order("created_at", { ascending: true }),
  ]);

  const eventRow = (eventRes.data || {}) as Record<string, string | null>;
  const ticketRow = (ticketRes.data || {}) as Record<string, string | null>;

  const seatDetails: SeatDetail[] = ((seatRes.data || []) as Array<Record<string, string | null>>).map(
    (row) => ({
      section_name: row.section_name ?? "",
      row_label: row.row_label ?? "",
      seat_label: row.seat_label ?? "",
      ticket_code: row.ticket_code ?? "",
    })
  );

  const ticketCodes = ((unitRes.data || []) as Array<Record<string, string | null>>)
    .map((row) => String(row.ticket_code || "").trim())
    .filter((code) => code.length > 0);

  const ticketTypeDisplay =
    seatDetails.length > 0
      ? [...new Set(seatDetails.map((seat) => seat.section_name))].join(", ")
      : ticketRow.name || ticketRow.ticket_type || "Standart";

  return {
    buyerEmail: order.buyer_email || "",
    buyerName: order.buyer_name || "Müşteri",
    ticketCode: order.ticket_code || ticketCodes[0] || "",
    quantity: Number(order.quantity || 0),
    ticketType: ticketTypeDisplay,
    totalPrice: Number(order.total_price || 0),
    eventTitle: eventRow.title || undefined,
    eventDate: eventRow.date || undefined,
    eventTime: eventRow.time || undefined,
    venue: eventRow.venue || undefined,
    location: eventRow.location || undefined,
    seatDetails: seatDetails.length > 0 ? seatDetails : undefined,
    ticketCodes: ticketCodes.length > 0 ? ticketCodes : undefined,
  };
}
