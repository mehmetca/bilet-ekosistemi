import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireRole } from "@/lib/api-auth";
import { publicErrorMessage } from "@/lib/api-error";

export const dynamic = "force-dynamic";

type PayoutRow = {
  eventId: string;
  title: string;
  date: string;
  venue: string;
  currency: string;
  orders: number;
  tickets: number;
  gross: number;
  commissionRate: number | null;
  commissionGross: number;
  commissionTax: number;
  commissionNet: number;
  payout: number;
};

const round2 = (value: number) => Math.round(value * 100) / 100;

/**
 * Organizatörün kendi etkinliklerinden kazandığı para.
 * Komisyon oranı etkinlikte tanımlıysa brüt cirodan düşülür; oran yoksa
 * (kendi etkinliğimiz) tamamı organizatöre kalır.
 */
export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ["admin", "organizer"]);
  if (auth instanceof Response) return auth;

  try {
    const supabase = getSupabaseAdmin();
    const isAdmin = auth.roles.includes("admin");
    const userId = auth.user.id;

    let eventsQuery = supabase
      .from("events")
      .select(
        "id,title,date,time,venue,currency,commission_rate_percent,seller_user_id,created_by_user_id"
      )
      .order("date", { ascending: false });
    if (!isAdmin) {
      eventsQuery = eventsQuery.or(
        `created_by_user_id.eq.${userId},seller_user_id.eq.${userId}`
      );
    }

    const { data: events, error: eventsError } = await eventsQuery;
    if (eventsError) {
      return NextResponse.json({ error: publicErrorMessage("Etkinlikler okunamadı.", eventsError) }, { status: 500 });
    }
    if (!events || events.length === 0) {
      return NextResponse.json({ rows: [], totals: emptyTotals() });
    }

    const eventIds = events.map((event) => event.id as string);
    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select("event_id,quantity,total_price,status,is_test")
      .in("event_id", eventIds)
      .eq("status", "completed")
      .eq("is_test", false);
    if (ordersError) {
      return NextResponse.json({ error: publicErrorMessage("Siparişler okunamadı.", ordersError) }, { status: 500 });
    }

    const agg = new Map<string, { orders: number; tickets: number; gross: number }>();
    for (const order of orders || []) {
      const eventId = order.event_id as string;
      const current = agg.get(eventId) || { orders: 0, tickets: 0, gross: 0 };
      current.orders += 1;
      current.tickets += Number(order.quantity) || 0;
      current.gross = round2(current.gross + (Number(order.total_price) || 0));
      agg.set(eventId, current);
    }

    let totals = emptyTotals();
    const rows: PayoutRow[] = events.map((event) => {
      const sales = agg.get(event.id as string) || { orders: 0, tickets: 0, gross: 0 };
      const rate =
        event.commission_rate_percent === null || event.commission_rate_percent === undefined
          ? null
          : Number(event.commission_rate_percent);
      const commissionGross = rate && rate > 0 ? round2((sales.gross * rate) / 100) : 0;
      const commissionTax = round2((commissionGross * 19) / 119);
      const commissionNet = round2(commissionGross - commissionTax);
      const payout = round2(sales.gross - commissionGross);

      totals = {
        events: totals.events + 1,
        orders: totals.orders + sales.orders,
        tickets: totals.tickets + sales.tickets,
        gross: round2(totals.gross + sales.gross),
        commissionGross: round2(totals.commissionGross + commissionGross),
        payout: round2(totals.payout + payout),
      };

      return {
        eventId: event.id as string,
        title: String(event.title || "Etkinlik"),
        date: String(event.date || ""),
        venue: String(event.venue || ""),
        currency: String(event.currency || "EUR"),
        orders: sales.orders,
        tickets: sales.tickets,
        gross: sales.gross,
        commissionRate: rate,
        commissionGross,
        commissionTax,
        commissionNet,
        payout,
      };
    });

    return NextResponse.json({ rows, totals });
  } catch (error) {
    console.error("organizer payouts error:", error);
    return NextResponse.json({ error: "Kazanç özeti okunamadı." }, { status: 500 });
  }
}

function emptyTotals() {
  return { events: 0, orders: 0, tickets: 0, gross: 0, commissionGross: 0, payout: 0 };
}
