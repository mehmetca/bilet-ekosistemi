import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { buildStaffAllowedEventIds } from "@/lib/staff-event-scope";
import type { StaffRole } from "@/lib/server-staff-auth";

/**
 * Personelin kapı panelinde seçebileceği etkinlikler.
 * GET /api/staff-events — admin hepsini, kontrolör/organizatör yalnız yetkili olduklarını görür.
 * ?sellable=1 → yalnız bilet türü tanımlı etkinlikler, ?from=YYYY-MM-DD → bu tarihten itibaren.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireRole(request, ["admin", "controller", "organizer", "gate_sales"]);
    if (auth instanceof NextResponse) return auth;

    const sellable = request.nextUrl.searchParams.get("sellable") === "1";
    const from = request.nextUrl.searchParams.get("from");

    const allowedEventIds = await buildStaffAllowedEventIds(
      auth.supabase,
      auth.roles as StaffRole[],
      auth.user.id
    );
    if (allowedEventIds !== null && allowedEventIds.length === 0) {
      return NextResponse.json({ success: true, events: [] });
    }

    let query = auth.supabase
      .from("events")
      .select("id,title,date,time,venue,seating_plan_id");
    if (allowedEventIds !== null) query = query.in("id", allowedEventIds);

    if (sellable) {
      let ticketQuery = getSupabaseAdmin().from("tickets").select("event_id");
      if (allowedEventIds !== null) ticketQuery = ticketQuery.in("event_id", allowedEventIds);
      const { data: ticketRows, error: ticketError } = await ticketQuery;
      if (ticketError) {
        console.error("staff-events tickets query error:", ticketError);
        return NextResponse.json({ success: false, message: "Etkinlikler alınamadı." }, { status: 500 });
      }
      const sellableIds = [...new Set((ticketRows ?? []).map((row) => String(row.event_id)))];
      if (sellableIds.length === 0) {
        return NextResponse.json({ success: true, events: [] });
      }
      query = query.in("id", sellableIds);
    }

    if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) query = query.gte("date", from);

    query = query.order("date", { ascending: sellable }).limit(100);

    const { data, error } = await query;
    if (error) {
      console.error("staff-events query error:", error);
      return NextResponse.json({ success: false, message: "Etkinlikler alınamadı." }, { status: 500 });
    }

    return NextResponse.json({ success: true, events: data ?? [] });
  } catch (error) {
    console.error("staff-events API error:", error);
    return NextResponse.json({ success: false, message: "Sunucu hatası." }, { status: 500 });
  }
}
