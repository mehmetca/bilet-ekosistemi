import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireRole } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

/** Organizatörün kendi etkinliklerine ait siparişleri döner (satılan bilet listesi / satış raporu için). */
export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ["admin", "organizer"]);
  if (auth instanceof Response) return auth;
  try {
    const supabase = getSupabaseAdmin();
    const isOrganizer = auth.roles.includes("organizer");
    const isAdmin = auth.roles.includes("admin");

    let eventIds: string[] = [];
    if (isOrganizer) {
      const { data: myEvents } = await supabase
        .from("events")
        .select("id")
        .eq("created_by_user_id", auth.user.id);
      eventIds = (myEvents || []).map((e) => e.id);
      if (eventIds.length === 0) {
        return NextResponse.json([]);
      }
    }

    let query = supabase
      .from("orders")
      .select(
        `
        id,
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
        events (
          title,
          date,
          time,
          venue
        )
      `
      )
      .order("created_at", { ascending: false });

    if (isOrganizer && eventIds.length > 0) {
      query = query.in("event_id", eventIds);
    }

    const { data: orders, error } = await query;

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }

    const list = orders || [];
    const ticketIds = [...new Set(list.map((o) => o.ticket_id).filter(Boolean))] as string[];

    let ticketMap: Map<string, { name?: string; type?: string; price?: number }> = new Map();
    if (ticketIds.length > 0) {
      const { data: ticketRows } = await supabase
        .from("tickets")
        .select("id, name, type, price")
        .in("id", ticketIds);
      if (ticketRows) {
        ticketMap = new Map(ticketRows.map((r) => [r.id, { name: r.name, type: r.type, price: r.price }]));
      }
    }

    const merged = list.map((order) => ({
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
