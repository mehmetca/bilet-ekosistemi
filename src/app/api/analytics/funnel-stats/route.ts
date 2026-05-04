import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireRole } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ["admin", "controller", "organizer"]);
  if (auth instanceof Response) return auth;

  try {
    const supabase = getSupabaseAdmin();
    const isOrganizerOnly =
      auth.roles.includes("organizer") &&
      !auth.roles.includes("admin") &&
      !auth.roles.includes("controller");

    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "7"; // son 7 gün
    const days = Math.min(90, Math.max(1, parseInt(period, 10) || 7));
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceStr = since.toISOString();

    let eventIds: string[] | null = null;
    if (isOrganizerOnly) {
      const { data: myEvents, error: eventsError } = await supabase
        .from("events")
        .select("id")
        .eq("created_by_user_id", auth.user.id);
      if (eventsError) {
        console.error("Funnel organizer events lookup error:", eventsError);
        return NextResponse.json(
          { message: "Huni verisi kapsamı doğrulanamadı." },
          { status: 500 }
        );
      }
      eventIds = (myEvents || []).map((event) => event.id);
      if (eventIds.length === 0) {
        return NextResponse.json({
          period: days,
          totals: { views: 0, intents: 0, completed: 0 },
          funnel: [],
          ab_breakdown: [],
        });
      }
    }

    let viewsQuery = supabase
      .from("event_views")
      .select("event_id, viewed_at, hero_variant")
      .gte("viewed_at", sinceStr);
    let intentsQuery = supabase
      .from("purchase_intents")
      .select("event_id, intent_at, hero_variant")
      .gte("intent_at", sinceStr);
    let ordersQuery = supabase
      .from("orders")
      .select("event_id, status, created_at")
      .gte("created_at", sinceStr);
    let eventsQuery = supabase
      .from("events")
      .select("id, title, date")
      .order("date", { ascending: false });

    if (eventIds) {
      viewsQuery = viewsQuery.in("event_id", eventIds);
      intentsQuery = intentsQuery.in("event_id", eventIds);
      ordersQuery = ordersQuery.in("event_id", eventIds);
      eventsQuery = eventsQuery.in("id", eventIds);
    }

    const [viewsRes, intentsRes, ordersRes, eventsRes] = await Promise.all([
      viewsQuery,
      intentsQuery,
      ordersQuery,
      eventsQuery,
    ]);

    const views = viewsRes.data || [];
    const intents = intentsRes.data || [];
    const orders = ordersRes.data || [];
    const events = eventsRes.data || [];

    const completedOrders = orders.filter(
      (o) => o.status === "completed" || o.status === "confirmed" || !o.status
    );

    const byEvent = new Map<
      string,
      { views: number; intents: number; completed: number; title: string; date: string }
    >();

    for (const e of events) {
      byEvent.set(e.id, {
        views: 0,
        intents: 0,
        completed: 0,
        title: e.title || "",
        date: e.date || "",
      });
    }

    for (const v of views) {
      const row = byEvent.get(v.event_id);
      if (row) row.views += 1;
    }
    for (const i of intents) {
      const row = byEvent.get(i.event_id);
      if (row) row.intents += 1;
    }
    for (const o of completedOrders) {
      const row = byEvent.get(o.event_id);
      if (row) row.completed += 1;
    }

    const totals = {
      views: views.length,
      intents: intents.length,
      completed: completedOrders.length,
    };

    const funnel = Array.from(byEvent.entries())
      .map(([id, data]) => ({ event_id: id, ...data }))
      .filter((r) => r.views > 0 || r.intents > 0 || r.completed > 0)
      .sort((a, b) => (b.views || 0) - (a.views || 0));

    // A/B test: hero_variant bazlı özet
    const byVariant = new Map<string, { views: number; intents: number }>();
    for (const v of views) {
      const hv = (v as { hero_variant?: string }).hero_variant || "unknown";
      const row = byVariant.get(hv) || { views: 0, intents: 0 };
      row.views += 1;
      byVariant.set(hv, row);
    }
    for (const i of intents) {
      const hv = (i as { hero_variant?: string }).hero_variant || "unknown";
      const row = byVariant.get(hv) || { views: 0, intents: 0 };
      row.intents += 1;
      byVariant.set(hv, row);
    }
    const abBreakdown = Array.from(byVariant.entries()).map(([variant, data]) => ({
      variant,
      ...data,
    }));

    return NextResponse.json({
      period: days,
      totals,
      funnel,
      ab_breakdown: abBreakdown,
    });
  } catch (e) {
    console.error("Funnel stats error:", e);
    return NextResponse.json(
      { message: "Huni verileri alınamadı." },
      { status: 500 }
    );
  }
}
