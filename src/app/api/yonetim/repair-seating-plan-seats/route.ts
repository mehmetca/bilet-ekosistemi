import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/api-auth";
import { repairMissingSeatsForPlan } from "@/lib/seating-plans/repair-missing-seats";

/**
 * POST { seating_plan_id }
 * Eksik koltukları (boş veya eksik etiketli sıralar) şablona göre doldurur.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;

  try {
    const body = await request.json().catch(() => ({}));
    const planId = typeof body.seating_plan_id === "string" ? body.seating_plan_id.trim() : "";
    if (!planId) {
      return NextResponse.json({ error: "seating_plan_id gerekli" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: plan } = await supabase.from("seating_plans").select("id, name").eq("id", planId).maybeSingle();
    if (!plan) {
      return NextResponse.json({ error: "Plan bulunamadı" }, { status: 404 });
    }

    const result = await repairMissingSeatsForPlan(supabase, planId);
    return NextResponse.json({
      success: true,
      planId,
      planName: plan.name,
      ...result,
      message:
        result.seatsInserted > 0
          ? `${result.seatsInserted} koltuk eklendi (${result.rowsRepaired} sıra onarıldı).`
          : "Eksik koltuk bulunamadı; plan zaten dolu görünüyor.",
    });
  } catch (e) {
    console.error("repair-seating-plan-seats POST:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Sunucu hatası" },
      { status: 500 }
    );
  }
}
