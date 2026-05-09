import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireRole } from "@/lib/api-auth";
import type { OrganizerTicketSummaryEvent, OrganizerTicketSummaryResponse } from "@/types/organizer-bilet-ozeti";

export const dynamic = "force-dynamic";

/** DB: order_status enum — yalnızca pending | completed | cancelled (bkz. migration 059). */
const PAID_STATUSES = ["completed"] as const;

function emptySummary(): OrganizerTicketSummaryResponse {
  return {
    summary: {
      soldTickets: 0,
      remainingTickets: 0,
      capacity: 0,
      grossRevenue: 0,
      shippingFeesTotal: 0,
      ticketRevenueApprox: 0,
    },
    events: [],
  };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireRole(request, ["admin", "organizer"]);
    if (auth instanceof NextResponse) return auth;

    const isAdmin = auth.roles.includes("admin");
    const isOrganizer = auth.roles.includes("organizer");

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return NextResponse.json({ error: "Sunucu yapılandırması eksik." }, { status: 500 });
    }

    const supabase = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    let eventIdFilter: string[] | null = null;
    if (!isAdmin && isOrganizer) {
      const { data: mine, error: evErr } = await supabase
        .from("events")
        .select("id")
        .eq("created_by_user_id", auth.user.id);
      if (evErr) {
        return NextResponse.json({ error: evErr.message }, { status: 500 });
      }
      eventIdFilter = (mine || []).map((e) => e.id);
      if (eventIdFilter.length === 0) {
        return NextResponse.json(emptySummary());
      }
    }

    let ticketsQuery = supabase.from("tickets").select("event_id, quantity, available");
    if (eventIdFilter) {
      ticketsQuery = ticketsQuery.in("event_id", eventIdFilter);
    }

    const { data: ticketRows, error: tErr } = await ticketsQuery;
    if (tErr) {
      return NextResponse.json({ error: tErr.message }, { status: 500 });
    }

    let ordersQuery = supabase
      .from("orders")
      .select("event_id, quantity, total_price, shipping_fee, status")
      .in("status", PAID_STATUSES);

    if (eventIdFilter) {
      ordersQuery = ordersQuery.in("event_id", eventIdFilter);
    }

    const { data: orderRows, error: oErr } = await ordersQuery;
    if (oErr) {
      return NextResponse.json({ error: oErr.message }, { status: 500 });
    }

    const eventIdsFromTickets = [...new Set((ticketRows || []).map((t) => t.event_id).filter(Boolean))] as string[];
    const eventIdsFromOrders = [...new Set((orderRows || []).map((o) => o.event_id).filter(Boolean))] as string[];
    const allEventIds = [...new Set([...eventIdsFromTickets, ...eventIdsFromOrders])];

    let eventMeta = new Map<string, { title: string; date: string | null }>();
    if (allEventIds.length > 0) {
      const { data: evs, error: metaErr } = await supabase
        .from("events")
        .select("id, title, date")
        .in("id", allEventIds);
      if (metaErr) {
        return NextResponse.json({ error: metaErr.message }, { status: 500 });
      }
      eventMeta = new Map(
        (evs || []).map((e) => [e.id as string, { title: (e.title as string) || "—", date: (e.date as string) ?? null }])
      );
    }

    const stockByEvent: Record<string, { capacity: number; remaining: number }> = {};
    for (const t of ticketRows || []) {
      const eid = t.event_id as string;
      if (!eid) continue;
      const cap = Number(t.quantity ?? 0);
      const rem = Number(t.available ?? 0);
      if (!stockByEvent[eid]) {
        stockByEvent[eid] = { capacity: 0, remaining: 0 };
      }
      stockByEvent[eid].capacity += cap;
      stockByEvent[eid].remaining += rem;
    }

    const ordersByEvent: Record<string, { sold: number; gross: number; shipping: number }> = {};
    for (const o of orderRows || []) {
      const eid = o.event_id as string;
      if (!eid) continue;
      if (!ordersByEvent[eid]) {
        ordersByEvent[eid] = { sold: 0, gross: 0, shipping: 0 };
      }
      ordersByEvent[eid].sold += Number(o.quantity ?? 0);
      ordersByEvent[eid].gross += Number(o.total_price ?? 0);
      ordersByEvent[eid].shipping += Number(o.shipping_fee ?? 0) || 0;
    }

    const events: OrganizerTicketSummaryEvent[] = allEventIds
      .map((eventId) => {
        const meta = eventMeta.get(eventId) || { title: "—", date: null };
        const stock = stockByEvent[eventId] || { capacity: 0, remaining: 0 };
        const ord = ordersByEvent[eventId] || { sold: 0, gross: 0, shipping: 0 };
        const gross = ord.gross;
        const ship = ord.shipping;
        return {
          eventId,
          title: meta.title,
          date: meta.date,
          soldTickets: ord.sold,
          remainingTickets: stock.remaining,
          capacity: stock.capacity,
          grossRevenue: gross,
          shippingFeesTotal: ship,
          ticketRevenueApprox: Math.max(0, gross - ship),
        };
      })
      .sort((a, b) => {
        const da = a.date || "";
        const db = b.date || "";
        return db.localeCompare(da);
      });

    const summary = events.reduce(
      (acc, e) => ({
        soldTickets: acc.soldTickets + e.soldTickets,
        remainingTickets: acc.remainingTickets + e.remainingTickets,
        capacity: acc.capacity + e.capacity,
        grossRevenue: acc.grossRevenue + e.grossRevenue,
        shippingFeesTotal: acc.shippingFeesTotal + e.shippingFeesTotal,
        ticketRevenueApprox: acc.ticketRevenueApprox + e.ticketRevenueApprox,
      }),
      {
        soldTickets: 0,
        remainingTickets: 0,
        capacity: 0,
        grossRevenue: 0,
        shippingFeesTotal: 0,
        ticketRevenueApprox: 0,
      }
    );

    return NextResponse.json({ summary, events } satisfies OrganizerTicketSummaryResponse);
  } catch (e) {
    console.error("organizer bilet-ozeti error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Özet alınamadı." },
      { status: 500 }
    );
  }
}
