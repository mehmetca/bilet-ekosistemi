import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import type { Ticket } from "@/types/database";

/**
 * GET ?event_id=… — etkinlik bilet satırları (stok dahil).
 * Satış sayfasında canlı yenileme için; Data Cache kullanılmaz.
 */
export async function GET(request: NextRequest) {
  const eventId = request.nextUrl.searchParams.get("event_id")?.trim();
  if (!eventId) {
    return NextResponse.json({ tickets: [] }, { status: 400 });
  }
  try {
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("tickets")
      .select("*")
      .eq("event_id", eventId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      console.error("event-tickets live fetch error:", error.message);
      return NextResponse.json({ tickets: [] }, { status: 500 });
    }

    const tickets = (data || []) as Ticket[];
    const res = NextResponse.json({ tickets });
    res.headers.set("Cache-Control", "no-store, max-age=0");
    return res;
  } catch {
    return NextResponse.json({ tickets: [] }, { status: 500 });
  }
}
