import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/api-auth";
import { draftToDbPlan } from "@/lib/salon-wizard-2/to-template";
import type { Wizard2Draft } from "@/lib/salon-wizard-2/types";
import { insertSeatsBatched } from "@/lib/seating-plans/insert-seats-batched";
import { countSeatsForPlan } from "@/lib/seating-plans/count-plan-seats";
import { repairMissingSeatsForPlan } from "@/lib/seating-plans/repair-missing-seats";

/**
 * Wizard 2 taslağını mekana oturum planı olarak yazar.
 * Eski `/api/salon-yapim-to-venue` yoluna dokunmaz.
 * Kısmi plan bırakmaz: bölüm/sıra/koltuk hatasında plan silinir.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;

  let planId: string | null = null;
  const supabase = getSupabaseAdmin();

  try {
    const body = await request.json().catch(() => ({}));
    const venueId = typeof body.venueId === "string" ? body.venueId.trim() : "";
    const draft = body.draft as Wizard2Draft | null;

    if (!venueId) return NextResponse.json({ error: "venueId gerekli" }, { status: 400 });
    if (!draft || !Array.isArray(draft.sections) || draft.sections.length === 0) {
      return NextResponse.json({ error: "draft.sections gerekli" }, { status: 400 });
    }

    const { data: venue } = await supabase.from("venues").select("id").eq("id", venueId).single();
    if (!venue) return NextResponse.json({ error: "Mekan bulunamadı" }, { status: 404 });

    const plan = draftToDbPlan(draft);
    if (!plan.sections.length) {
      return NextResponse.json({ error: "Plan geçerli bölüm içermiyor" }, { status: 400 });
    }

    const expectedSeatCount = plan.sections.reduce(
      (n, section) => n + section.rows.reduce((m, row) => m + row.seats.length, 0),
      0
    );

    const { data: existingPlans } = await supabase
      .from("seating_plans")
      .select("id")
      .eq("venue_id", venueId);
    const isFirst = !existingPlans?.length;

    const { data: planData, error: planErr } = await supabase
      .from("seating_plans")
      .insert({ venue_id: venueId, name: plan.planName, is_default: isFirst })
      .select()
      .single();

    if (planErr || !planData) {
      console.error("wizard-2 seating_plans insert:", planErr);
      return NextResponse.json({ error: planErr?.message || "Plan oluşturulamadı" }, { status: 500 });
    }

    planId = planData.id as string;
    let seatCount = 0;
    let blockedCount = 0;

    for (const section of plan.sections) {
      const { data: sectionData, error: sectionErr } = await supabase
        .from("seating_plan_sections")
        .insert({
          seating_plan_id: planId,
          name: section.name,
          sort_order: section.sort_order,
          ticket_type_label: section.ticket_type_label,
          section_align: section.section_align,
          corridor_mode: section.corridor_mode,
          corridor_after_seat_label: section.corridor_after_seat_label,
          corridor_gap_px: section.corridor_gap_px,
        })
        .select()
        .single();

      if (sectionErr || !sectionData) {
        throw new Error(`Bölüm yazılamadı (${section.name}): ${sectionErr?.message || "bilinmeyen hata"}`);
      }

      for (const row of section.rows) {
        const { data: rowData, error: rowErr } = await supabase
          .from("seating_plan_rows")
          .insert({
            section_id: sectionData.id,
            row_label: row.row_label,
            sort_order: row.sort_order,
            ticket_type_label: row.ticket_type_label,
          })
          .select()
          .single();

        if (rowErr || !rowData) {
          throw new Error(
            `Sıra yazılamadı (${section.name} ${row.row_label}): ${rowErr?.message || "bilinmeyen hata"}`
          );
        }

        const toInsert = row.seats.map((s) => ({
          row_id: rowData.id as string,
          seat_label: s.seat_label,
          sales_blocked: s.sales_blocked,
        }));
        seatCount += toInsert.length;
        blockedCount += toInsert.filter((s) => s.sales_blocked).length;

        try {
          await insertSeatsBatched(supabase, toInsert);
        } catch (seatErr) {
          throw new Error(
            `Koltuklar yazılamadı (${section.name} sıra ${row.row_label}): ${
              seatErr instanceof Error ? seatErr.message : "bilinmeyen hata"
            }`
          );
        }
      }
    }

    let actual = await countSeatsForPlan(supabase, planId);
    if (actual < expectedSeatCount) {
      const repaired = await repairMissingSeatsForPlan(supabase, planId);
      seatCount += repaired.seatsInserted;
      actual = await countSeatsForPlan(supabase, planId);
    }

    // Wizard bölüm içi sıralar aynı uzunlukta üretilir; tam eşleşme zorunlu.
    if (actual !== expectedSeatCount) {
      throw new Error(
        `Koltuk sayısı eşleşmedi (beklenen ${expectedSeatCount}, yazılan ${actual}). Plan geri alındı.`
      );
    }

    return NextResponse.json({
      success: true,
      seatingPlanId: planId,
      planName: plan.planName,
      venueId,
      seatCount: actual,
      blockedCount,
      message:
        "Wizard 2 planı mekana eklendi. Etkinlik oluştururken bu mekanı ve oturum planını seçebilirsiniz. Eski wizard değişmedi.",
    });
  } catch (e) {
    console.error("salon-yapim-wizard-2 to-venue POST error:", e);
    if (planId) {
      await supabase.from("seating_plans").delete().eq("id", planId);
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Sunucu hatası" },
      { status: 500 }
    );
  }
}
