import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

/** Organizatörün kendi etkinliklerine ait siparişleri döner (satılan bilet listesi / satış raporu için). */
export async function GET(request: NextRequest) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return NextResponse.json({ message: "Sunucu yapılandırması eksik." }, { status: 500 });
    }
    const supabase = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
    }
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) {
      return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
    }

    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["admin", "organizer"])
      .maybeSingle();

    const isOrganizer = roleRow?.role === "organizer";
    const isAdmin = roleRow?.role === "admin";

    if (!isOrganizer && !isAdmin) {
      return NextResponse.json({ error: "Organizatör yetkisi gerekli" }, { status: 403 });
    }

    let eventIds: string[] = [];
    if (isOrganizer) {
      const { data: myEvents } = await supabase
        .from("events")
        .select("id")
        .eq("created_by_user_id", user.id);
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
