import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";

/**
 * Theater Duisburg oturum planını (bölümler, sıralar, koltuklar) veritabanında oluşturur.
 * Sadece admin veya controller.
 * POST body: { venueId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireRole(request, ["admin", "controller"]);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json().catch(() => ({}));
    const venueId = body?.venueId ?? "";
    if (!venueId || typeof venueId !== "string") {
      return NextResponse.json(
        { error: "venueId zorunludur." },
        { status: 400 }
      );
    }

    const { data: planId, error } = await auth.supabase.rpc(
      "create_theater_duisburg_plan",
      { p_venue_id: venueId }
    );

    if (error) {
      console.error("create_theater_duisburg_plan error:", error);
      return NextResponse.json(
        { error: "Plan oluşturulamadı: " + error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ planId: planId ?? null });
  } catch (e) {
    console.error("theater-duisburg-plan POST error:", e);
    return NextResponse.json(
      { error: "Sunucu hatası" },
      { status: 500 }
    );
  }
}
