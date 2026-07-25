import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireRole } from "@/lib/api-auth";
import { deleteSeatingPlanFully } from "@/lib/seating-plans/delete-seating-plan";

export const dynamic = "force-dynamic";

/**
 * POST { seating_plan_id }
 * Salonu + bölüm/sıra/koltuk (+ holds) siler; bağlı etkinliklerin seating_plan_id'sini temizler.
 * Satılmış koltuk varsa 409.
 */
export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ["admin", "organizer"]);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json().catch(() => ({}));
    const planId = typeof body.seating_plan_id === "string" ? body.seating_plan_id.trim() : "";
    if (!planId) {
      return NextResponse.json({ error: "seating_plan_id gerekli" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const isAdmin = auth.roles.includes("admin");

    if (!isAdmin) {
      const { data: mine } = await supabase
        .from("events")
        .select("id")
        .eq("seating_plan_id", planId)
        .eq("created_by_user_id", auth.user.id)
        .limit(1);
      const { data: plan } = await supabase
        .from("seating_plans")
        .select("id, venue_id")
        .eq("id", planId)
        .maybeSingle();
      // Organizatör: ya kendi etkinliğine bağlı plan, ya hiç etkinliğe bağlı olmayan taslak plan
      const { count } = await supabase
        .from("events")
        .select("id", { count: "exact", head: true })
        .eq("seating_plan_id", planId);
      const unused = (count ?? 0) === 0;
      if (!plan || (!mine?.length && !unused)) {
        return NextResponse.json({ error: "Bu salonu silme yetkiniz yok." }, { status: 403 });
      }
    }

    const result = await deleteSeatingPlanFully(supabase, planId);
    return NextResponse.json({
      success: true,
      ...result,
      message: `"${result.planName}" silindi (${result.seatsDeleted} koltuk, ${result.rowsDeleted} sıra, ${result.sectionsDeleted} bölüm).`,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Sunucu hatası";
    const status = msg.includes("satılmış koltuk") ? 409 : 500;
    console.error("delete-seating-plan POST:", e);
    return NextResponse.json({ error: msg }, { status });
  }
}
