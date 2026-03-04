import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { message: "Sunucu yapılandırması eksik." },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "7"; // son 7 gün
    const days = Math.min(90, Math.max(1, parseInt(period, 10) || 7));
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceStr = since.toISOString();

    const [viewsRes, intentsRes, ordersRes, eventsRes] = await Promise.all([
      supabase
        .from("event_views")
        .select("event_id, viewed_at, hero_variant")
        .gte("viewed_at", sinceStr),
      supabase
        .from("purchase_intents")
        .select("event_id, intent_at, hero_variant")
        .gte("intent_at", sinceStr),
      supabase
        .from("orders")
        .select("event_id, status, created_at")
        .gte("created_at", sinceStr),
      supabase.from("events").select("id, title, date").order("date", { ascending: false }),
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
