import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

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

    const selectFields = `
      id,
      event_id,
      ticket_id,
      quantity,
      total_price,
      status,
      created_at,
      events (
        title,
        date,
        time,
        venue
      ),
      tickets (
        name,
        type,
        price
      )
    `;

    const [byUserId, byEmail] = await Promise.all([
      supabase.from("orders").select(selectFields).eq("user_id", user.id).order("created_at", { ascending: false }),
      user.email
        ? supabase.from("orders").select(selectFields).eq("buyer_email", user.email).order("created_at", { ascending: false })
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
  } catch (err) {
    console.error("user orders API error:", err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
