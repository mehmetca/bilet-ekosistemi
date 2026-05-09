import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireRole } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

/**
 * Bu oturum planına bağlı tüm etkinliklerde, iptal edilmemiş siparişlerde yer alan koltuk id'leri.
 * Planı paylaşan farklı organizatörlerin satışları da dahildir (silme çakışmasını önlemek için).
 */
export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ["admin", "organizer"]);
  if (auth instanceof NextResponse) return auth;

  const isAdmin = auth.roles.includes("admin");
  const seatingPlanId = request.nextUrl.searchParams.get("seating_plan_id")?.trim();
  if (!seatingPlanId) {
    return NextResponse.json({ error: "seating_plan_id gerekli." }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: "Sunucu yapılandırması eksik." }, { status: 500 });
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  if (!isAdmin) {
    const { data: mine, error: evErr } = await supabase
      .from("events")
      .select("id")
      .eq("seating_plan_id", seatingPlanId)
      .eq("created_by_user_id", auth.user.id)
      .limit(1);
    if (evErr) {
      return NextResponse.json({ error: evErr.message }, { status: 500 });
    }
    if (!mine?.length) {
      return NextResponse.json({ error: "Bu oturum planına erişim yetkiniz yok." }, { status: 403 });
    }
  }

  const { data: events, error: eventsErr } = await supabase
    .from("events")
    .select("id")
    .eq("seating_plan_id", seatingPlanId);
  if (eventsErr) {
    return NextResponse.json({ error: eventsErr.message }, { status: 500 });
  }

  const eventIds = (events || []).map((e) => e.id).filter(Boolean);
  if (eventIds.length === 0) {
    return NextResponse.json({ seatIds: [] });
  }

  const { data: orders, error: ordersErr } = await supabase
    .from("orders")
    .select("id")
    .in("event_id", eventIds)
    .neq("status", "cancelled");
  if (ordersErr) {
    return NextResponse.json({ error: ordersErr.message }, { status: 500 });
  }

  const orderIds = (orders || []).map((o) => o.id).filter(Boolean);
  if (orderIds.length === 0) {
    return NextResponse.json({ seatIds: [] });
  }

  const { data: orderSeats, error: osErr } = await supabase
    .from("order_seats")
    .select("seat_id")
    .in("order_id", orderIds);
  if (osErr) {
    return NextResponse.json({ error: osErr.message }, { status: 500 });
  }

  const seatIds = [...new Set((orderSeats || []).map((r) => (r as { seat_id: string }).seat_id).filter(Boolean))];
  const res = NextResponse.json({ seatIds });
  res.headers.set("Cache-Control", "no-store, max-age=0");
  return res;
}
