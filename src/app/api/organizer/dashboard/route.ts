import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireRole } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

type DailySale = { date: string; revenue: number; tickets: number };
type TicketDistribution = { name: string; value: number; type: string };
type UpcomingEvent = {
  id: string;
  title: string;
  date: string;
  venue: string;
  location?: string;
  is_approved: boolean;
  rejected_at: string | null;
  sold: number;
  capacity: number;
};
type RecentOrder = {
  id: string;
  buyer_name: string | null;
  event_title: string;
  ticket_name: string;
  ticket_type: string;
  quantity: number;
  total_price: number;
  created_at: string;
};

export async function GET(request: NextRequest) {
  try {
    const auth = await requireRole(request, ["organizer"]);
    if (auth instanceof NextResponse) return auth;

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return NextResponse.json({ error: "Sunucu yapılandırması eksik." }, { status: 500 });
    }

    const supabase = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    let eventIds: string[] = [];
    {
      const { data: myEvents, error: eventsErr } = await supabase
        .from("events")
        .select("id")
        .eq("created_by_user_id", auth.user.id);
      if (eventsErr) {
        return NextResponse.json({ error: eventsErr.message }, { status: 500 });
      }
      eventIds = (myEvents || []).map((e) => e.id);
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const weekEnd = new Date();
    weekEnd.setHours(23, 59, 59, 999);
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekStart.getDate() - 7);
    weekStart.setHours(0, 0, 0, 0);

    let ordersQuery = supabase
      .from("orders")
      .select("id, event_id, quantity, total_price, created_at, checked_at, ticket_id, buyer_name")
      .in("status", ["completed"]);

    if (eventIds.length > 0) {
      ordersQuery = ordersQuery.in("event_id", eventIds);
    } else {
      return NextResponse.json({
        stats: {
          todayRevenue: 0,
          todayTickets: 0,
          totalRevenue: 0,
          totalTickets: 0,
          upcomingCount: 0,
          upcomingThisWeek: 0,
          checkinRate: 0,
          checkinTotal: 0,
          checkinCapacity: 0,
        },
        daily_sales: [] as DailySale[],
        ticket_distribution: [] as TicketDistribution[],
        upcoming_events: [] as UpcomingEvent[],
        recent_orders: [] as RecentOrder[],
      });
    }

    const { data: orders, error: ordersError } = await ordersQuery;
    if (ordersError) {
      return NextResponse.json({ error: ordersError.message }, { status: 500 });
    }
    const ordersList = orders || [];

    const todayOrders = ordersList.filter((o) => {
      const t = new Date(o.created_at).getTime();
      return t >= todayStart.getTime() && t < todayEnd.getTime();
    });
    const todayRevenue = todayOrders.reduce((s, o) => s + Number(o.total_price || 0), 0);
    const todayTickets = todayOrders.reduce((s, o) => s + Number(o.quantity || 0), 0);

    const totalRevenue = ordersList.reduce((s, o) => s + Number(o.total_price || 0), 0);
    const totalTickets = ordersList.reduce((s, o) => s + Number(o.quantity || 0), 0);

    const checkinTotal = ordersList.filter((o) => o.checked_at).reduce((s, o) => s + Number(o.quantity || 0), 0);
    const checkinCapacity = totalTickets;
    const checkinRate = checkinCapacity > 0 ? Math.round((checkinTotal / checkinCapacity) * 100) : 0;

    const ticketIds = [...new Set(ordersList.map((o) => o.ticket_id).filter(Boolean))] as string[];
    let ticketRows: { id: string; name: string; type: string }[] = [];
    if (ticketIds.length > 0) {
      const { data: t } = await supabase
        .from("tickets")
        .select("id, name, type")
        .in("id", ticketIds);
      ticketRows = t || [];
    }
    const ticketMap = new Map(ticketRows.map((r) => [r.id, { name: r.name, type: r.type || "normal" }]));

    const distributionMap: Record<string, number> = {};
    for (const o of ordersList) {
      const t = o.ticket_id ? ticketMap.get(o.ticket_id) : null;
      const label = t?.name || t?.type || "Bilet";
      const qty = Number(o.quantity || 0);
      distributionMap[label] = (distributionMap[label] || 0) + qty;
    }
    const ticket_distribution: TicketDistribution[] = Object.entries(distributionMap).map(([name, value]) => ({
      name,
      value,
      type: name,
    }));

    const dailyMap: Record<string, { revenue: number; tickets: number }> = {};
    for (let d = 0; d < 30; d++) {
      const date = new Date(thirtyDaysAgo);
      date.setDate(date.getDate() + d);
      const key = date.toISOString().slice(0, 10);
      dailyMap[key] = { revenue: 0, tickets: 0 };
    }
    for (const o of ordersList) {
      const key = new Date(o.created_at).toISOString().slice(0, 10);
      if (dailyMap[key] !== undefined) {
        dailyMap[key].revenue += Number(o.total_price || 0);
        dailyMap[key].tickets += Number(o.quantity || 0);
      }
    }
    const daily_sales: DailySale[] = Object.entries(dailyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, { revenue, tickets }]) => ({ date, revenue, tickets }));

    let eventsQuery = supabase
      .from("events")
      .select("id, title, date, venue, location, is_approved, rejected_at")
      .gte("date", new Date().toISOString().slice(0, 10))
      .order("date", { ascending: true })
      .limit(20);

    if (eventIds.length > 0) {
      eventsQuery = eventsQuery.in("id", eventIds);
    }

    const { data: upcomingEventsRows, error: eventsErr } = await eventsQuery;
    if (eventsErr) {
      return NextResponse.json({ error: eventsErr.message }, { status: 500 });
    }
    const eventsList = upcomingEventsRows || [];

    const eventIdsForCapacity = eventsList.map((e) => e.id);
    const { data: ticketAgg } = await supabase
      .from("tickets")
      .select("event_id, quantity, available")
      .in("event_id", eventIdsForCapacity.length ? eventIdsForCapacity : ["__none"]);

    const soldByEvent: Record<string, number> = {};
    const capacityByEvent: Record<string, number> = {};
    for (const t of ticketAgg || []) {
      const qty = Number(t.quantity ?? 0);
      const avail = Number(t.available ?? 0);
      const sold = qty - avail;
      soldByEvent[t.event_id] = (soldByEvent[t.event_id] || 0) + sold;
      capacityByEvent[t.event_id] = (capacityByEvent[t.event_id] || 0) + qty;
    }

    const upcoming_events: UpcomingEvent[] = eventsList.map((e) => ({
      id: e.id,
      title: e.title,
      date: e.date,
      venue: e.venue,
      location: e.location || undefined,
      is_approved: e.is_approved === true,
      rejected_at: e.rejected_at ?? null,
      sold: soldByEvent[e.id] || 0,
      capacity: capacityByEvent[e.id] || 0,
    }));

    const upcomingCount = upcoming_events.length;
    const upcomingThisWeek = upcoming_events.filter((e) => {
      const d = new Date(e.date);
      return d >= weekStart && d <= weekEnd;
    }).length;

    const recentOrdersQuery = supabase
      .from("orders")
      .select(`
        id, quantity, total_price, created_at, buyer_name, event_id, ticket_id,
        events(title)
      `)
      .in("status", ["completed"])
      .order("created_at", { ascending: false })
      .limit(15);

    if (eventIds.length > 0) {
      recentOrdersQuery.in("event_id", eventIds);
    }

    const { data: recentRows } = await recentOrdersQuery;
    const recentList = recentRows || [];
    const recentTicketIds = [...new Set(recentList.map((r) => r.ticket_id).filter(Boolean))] as string[];
    let recentTicketMap = new Map<string, { name: string; type: string }>();
    if (recentTicketIds.length > 0) {
      const { data: rt } = await supabase
        .from("tickets")
        .select("id, name, type")
        .in("id", recentTicketIds);
      recentTicketMap = new Map((rt || []).map((r) => [r.id, { name: r.name, type: r.type || "normal" }]));
    }

    const recent_orders: RecentOrder[] = recentList.map((o) => {
      const ev = o.events as { title?: string } | null;
      const tk = o.ticket_id ? recentTicketMap.get(o.ticket_id) : null;
      return {
        id: o.id,
        buyer_name: o.buyer_name ?? null,
        event_title: ev?.title ?? "—",
        ticket_name: tk?.name ?? "Bilet",
        ticket_type: tk?.type ?? "normal",
        quantity: Number(o.quantity || 0),
        total_price: Number(o.total_price || 0),
        created_at: o.created_at,
      };
    });

    return NextResponse.json({
      stats: {
        todayRevenue,
        todayTickets,
        totalRevenue,
        totalTickets,
        upcomingCount,
        upcomingThisWeek,
        checkinRate,
        checkinTotal,
        checkinCapacity,
      },
      daily_sales,
      ticket_distribution,
      upcoming_events,
      recent_orders,
    });
  } catch (e) {
    console.error("organizer dashboard error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Dashboard yüklenemedi." },
      { status: 500 }
    );
  }
}
