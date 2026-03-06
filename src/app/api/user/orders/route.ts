import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type OrderRow = {
  id: string;
  event_id: string;
  ticket_id: string | null;
  quantity: number;
  total_price: number;
  status: string;
  created_at: string;
  ticket_code?: string;
  buyer_name?: string;
  events?: { title?: string; date?: string; time?: string; venue?: string; location?: string; currency?: string } | null;
  tickets?: { name?: string; type?: string; price?: number } | null;
};

export async function GET(request: NextRequest) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return NextResponse.json({ error: "Sunucu yapılandırma hatası" }, { status: 500 });
    }
    const supabase = createClient(url, key);
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
    }
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) {
      return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
    }

    // Veritabanı fonksiyonu ile siparişleri al (user_id + buyer_email eşleşmesi)
    const { data: rows, error } = await supabase.rpc("get_user_orders", {
      p_user_id: user.id,
      p_email: user.email || "",
    });

    if (error) {
      console.error("get_user_orders error:", error);
      // Fallback: eski yöntem
      const selectFields = `
        id, event_id, ticket_id, quantity, total_price, status, created_at,
        ticket_code, buyer_name,
        events (title, date, time, venue, location, currency),
        tickets (name, type, price)
      `;
      const [byUserId, byEmail] = await Promise.all([
        supabase.from("orders").select(selectFields).eq("user_id", user.id).order("created_at", { ascending: false }),
        user.email
          ? supabase.from("orders").select(selectFields).ilike("buyer_email", user.email).order("created_at", { ascending: false })
          : { data: [] as unknown[] },
      ]);
      const seen = new Set<string>();
      const merged: unknown[] = [];
      for (const o of [...(byUserId.data || []), ...(byEmail.data || [])]) {
        const id = (o as { id?: string }).id;
        if (id && !seen.has(id)) {
          seen.add(id);
          merged.push(o);
        }
      }
      merged.sort((a, b) => {
        const aT = new Date((a as { created_at?: string }).created_at || 0).getTime();
        const bT = new Date((b as { created_at?: string }).created_at || 0).getTime();
        return bT - aT;
      });
      return NextResponse.json(merged);
    }

    // Fonksiyon düz dizi döndürüyor (events/tickets join değil) - frontend formatına çevir
    const orders: OrderRow[] = (rows || []).map((r: Record<string, unknown>) => ({
      id: r.id,
      event_id: r.event_id,
      ticket_id: r.ticket_id,
      quantity: r.quantity,
      total_price: r.total_price,
      status: r.status,
      created_at: r.created_at,
      ticket_code: r.ticket_code,
      buyer_name: r.buyer_name,
      events: {
        title: r.event_title,
        date: r.event_date,
        time: r.event_time,
        venue: r.event_venue,
        location: r.event_location,
        currency: r.event_currency,
      },
      tickets: {
        name: r.ticket_name || r.ticket_name_type,
        type: r.ticket_name_type,
        price: r.ticket_price,
      },
    }));

    return NextResponse.json(orders);
  } catch (err) {
    console.error("user orders API error:", err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
