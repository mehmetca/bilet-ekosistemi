import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

type SeatDetail = { section_name: string; row_label: string; seat_label: string; ticket_code?: string };

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
  seatDetails?: SeatDetail[];
  ticketCodes?: string[];
};

/** PostgREST şemasında orders→tickets FK yoksa gömülü `tickets(...)` tüm sorguyu düşürür; yönetim /api/orders gibi ticket ayrı çekilir. */
const SELECT_FIELDS = `
  id, event_id, ticket_id, quantity, total_price, status, created_at,
  ticket_code, buyer_name,
  events (title, date, time, venue, location, currency)
`;

/** RPC yerine doğrudan sorgu: muhasebe /api/orders ile aynı tabloyu kullanır; e-posta için user_id + ilike + eq birleşimi. */
async function fetchOrdersForUser(
  supabase: SupabaseClient,
  userId: string,
  email: string | null | undefined
): Promise<OrderRow[]> {
  const emailTrim = (email || "").trim();
  // PostgrestFilterBuilder thenable; Promise.all ile await (TS için ayrı tipleme gerekmez)
  const queryPromises = [
    supabase
      .from("orders")
      .select(SELECT_FIELDS)
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    ...(emailTrim
      ? [
          supabase
            .from("orders")
            .select(SELECT_FIELDS)
            .is("user_id", null)
            .ilike("buyer_email", emailTrim)
            .order("created_at", { ascending: false }),
          supabase
            .from("orders")
            .select(SELECT_FIELDS)
            .is("user_id", null)
            .eq("buyer_email", emailTrim)
            .order("created_at", { ascending: false }),
        ]
      : []),
  ];

  const results = await Promise.all(queryPromises);
  const seen = new Set<string>();
  const merged: OrderRow[] = [];
  for (const r of results) {
    if (r.error) {
      console.error("user orders query (satır atlanıyor):", r.error.message);
      continue;
    }
    for (const row of r.data || []) {
      const o = row as OrderRow;
      if (o.id && !seen.has(o.id)) {
        seen.add(o.id);
        merged.push(o);
      }
    }
  }

  merged.sort((a, b) => {
    const aT = new Date(a.created_at || 0).getTime();
    const bT = new Date(b.created_at || 0).getTime();
    return bT - aT;
  });

  const ticketIds = Array.from(
    new Set(merged.map((o) => o.ticket_id).filter((id): id is string => !!id))
  );
  let ticketMap = new Map<string, { name?: string; type?: string; price?: number }>();
  if (ticketIds.length > 0) {
    const { data: ticketRows, error: ticketErr } = await supabase
      .from("tickets")
      .select("id, name, type, price")
      .in("id", ticketIds);
    if (ticketErr) {
      console.error("user orders tickets lookup:", ticketErr.message);
    } else if (ticketRows) {
      ticketMap = new Map(
        ticketRows.map((row) => [
          row.id,
          { name: row.name, type: row.type, price: row.price },
        ])
      );
    }
  }
  for (const o of merged) {
    o.tickets = o.ticket_id ? ticketMap.get(o.ticket_id) ?? null : null;
  }

  const ids = merged.map((o) => o.id).filter(Boolean);
  if (ids.length > 0) {
    const { data: seatsRows, error: seatsErr } = await supabase
      .from("order_seats")
      .select("order_id, section_name, row_label, seat_label, ticket_code")
      .in("order_id", ids);
    if (seatsErr) {
      console.error("user orders order_seats:", seatsErr.message);
    }
    const seatsByOrder = new Map<string, SeatDetail[]>();
    for (const row of seatsRows || []) {
      const list = seatsByOrder.get(row.order_id) || [];
      list.push({
        section_name: row.section_name ?? "",
        row_label: row.row_label ?? "",
        seat_label: row.seat_label ?? "",
        ticket_code: row.ticket_code ?? undefined,
      });
      seatsByOrder.set(row.order_id, list);
    }
    for (const o of merged) {
      o.seatDetails = seatsByOrder.get(o.id) || undefined;
    }

    const { data: unitRows, error: unitsErr } = await supabase
      .from("order_ticket_units")
      .select("order_id, ticket_code, created_at")
      .in("order_id", ids)
      .order("created_at", { ascending: true });
    if (unitsErr) {
      if (!/order_ticket_units|schema cache|PGRST/i.test(String(unitsErr.message || ""))) {
        console.error("user orders order_ticket_units:", unitsErr.message);
      }
    } else {
      const unitsByOrder = new Map<string, string[]>();
      for (const row of unitRows || []) {
        const list = unitsByOrder.get(row.order_id) || [];
        const code = String(row.ticket_code || "").trim();
        if (code.length > 0) list.push(code);
        unitsByOrder.set(row.order_id, list);
      }
      for (const o of merged) {
        const codes = unitsByOrder.get(o.id) || [];
        o.ticketCodes = codes.length > 0 ? codes : undefined;
      }
    }
  }

  return merged;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
    }
    const {
      data: { user },
    } = await supabase.auth.getUser(token);
    if (!user) {
      return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
    }

    const orders = await fetchOrdersForUser(supabase, user.id, user.email);
    return NextResponse.json(orders);
  } catch (err) {
    console.error("user orders API error:", err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
