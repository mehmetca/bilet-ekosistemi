import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { buildStaffAllowedEventIds } from "@/lib/staff-event-scope";
import type { StaffRole } from "@/lib/server-staff-auth";

/**
 * Personelin kapı panelinde seçebileceği etkinlikler.
 * GET /api/staff-events — admin hepsini, kontrolör/organizatör yalnız yetkili olduklarını görür.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireRole(request, ["admin", "controller", "organizer"]);
    if (auth instanceof NextResponse) return auth;

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
      .select("id,title,date,time,venue")
      .order("date", { ascending: false })
      .limit(100);
    if (allowedEventIds !== null) query = query.in("id", allowedEventIds);

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
