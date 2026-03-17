import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * GET ?event_id=xxx → { seatIds: string[] }
 * Etkinlik için satılmış (dolu) koltuk ID'lerini döndürür. Salon planında bu koltuklar gri / seçilemez gösterilir.
 */
export async function GET(request: NextRequest) {
  const eventId = request.nextUrl.searchParams.get("event_id");
  if (!eventId) {
    return NextResponse.json({ seatIds: [] });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !key) {
    return NextResponse.json({ seatIds: [] });
  }

  const supabase = createClient(supabaseUrl, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: orders } = await supabase
    .from("orders")
    .select("id")
    .eq("event_id", eventId)
    .in("status", ["completed"]);

  if (!orders?.length) {
    return NextResponse.json({ seatIds: [] });
  }

  const orderIds = orders.map((o) => o.id);
  const { data: orderSeats, error } = await supabase
    .from("order_seats")
    .select("seat_id")
    .in("order_id", orderIds);

  if (error) {
    console.error("sold-seats order_seats error:", error);
    return NextResponse.json({ seatIds: [] });
  }

  const seatIds = (orderSeats || []).map((s) => (s as { seat_id: string }).seat_id).filter(Boolean);
  const res = NextResponse.json({ seatIds: [...new Set(seatIds)] });
  res.headers.set("Cache-Control", "no-store, max-age=0");
  return res;
}
