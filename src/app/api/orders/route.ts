import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireRole } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ["admin", "organizer"]);
  if (auth instanceof Response) return auth;
  try {
    const supabase = getSupabaseAdmin();
    const isOrganizerOnly = auth.roles.includes("organizer") && !auth.roles.includes("admin");

    let organizerEventIds: string[] | null = null;
    if (isOrganizerOnly) {
      const { data: myEvents, error: eventsError } = await supabase
        .from("events")
        .select("id")
        .eq("created_by_user_id", auth.user.id);

      if (eventsError) {
        console.error("Organizer events lookup error:", eventsError);
        return NextResponse.json(
          { message: "Sipariş kapsamı doğrulanamadı." },
          { status: 500 }
        );
      }

      organizerEventIds = (myEvents || []).map((event) => event.id);
      if (organizerEventIds.length === 0) {
        return NextResponse.json([]);
      }
    }

    let query = supabase
      .from("orders")
      .select(
        `
          id,
          order_number,
          ticket_code,
          quantity,
          total_price,
          buyer_name,
          buyer_email,
          created_at,
          checked_at,
          status,
          event_id,
          ticket_id,
          events(
            title,
            date,
            time,
            venue
          ),
          order_seats(
            id,
            seat_id,
            section_name,
            row_label,
            seat_label,
            ticket_code
          )
        `
      )
      .order("created_at", { ascending: false });

    if (organizerEventIds) {
      query = query.in("event_id", organizerEventIds);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }

    const orders = data || [];
    const ticketIds = Array.from(
      new Set(
        orders
          .map((order) => order.ticket_id)
          .filter((ticketId): ticketId is string => !!ticketId)
      )
    );

    let ticketMap = new Map<string, { name?: string; type?: string; price?: number }>();
    if (ticketIds.length > 0) {
      const { data: ticketRows, error: ticketError } = await supabase
        .from("tickets")
        .select("id, name, type, price")
        .in("id", ticketIds);

      if (!ticketError && ticketRows) {
        ticketMap = new Map(
          ticketRows.map((row) => [
            row.id,
            { name: row.name, type: row.type, price: row.price },
          ])
        );
      }
    }

    const merged = orders.map((order) => ({
      ...order,
      tickets: order.ticket_id ? ticketMap.get(order.ticket_id) || null : null,
    }));

    return NextResponse.json(merged);
  } catch {
    return NextResponse.json(
      { message: "Siparişler alınırken bir hata oluştu." },
      { status: 500 }
    );
  }
}
