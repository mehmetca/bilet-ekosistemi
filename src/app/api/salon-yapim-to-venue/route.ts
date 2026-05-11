import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/api-auth";
import { wizardPlanToTemplate } from "@/lib/salon-yapim-to-db";
import type { WizardBlock } from "@/lib/salon-yapim-to-db";

/**
 * POST: Salon Yapım Wizard'daki planı belirtilen mekana oturum planı olarak ekler.
 * Etkinlik oluştururken bu mekan ve plan seçilebilir.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;

  try {
    const body = await request.json().catch(() => ({}));
    const venueId = typeof body.venueId === "string" ? body.venueId.trim() : "";
    const planName = typeof body.planName === "string" ? body.planName.trim() : "";
    const plan2Blocks = Array.isArray(body.plan2Blocks) ? body.plan2Blocks as WizardBlock[] : [];
    const settingsByBlockId =
      body.settingsByBlockId && typeof body.settingsByBlockId === "object"
        ? (body.settingsByBlockId as Record<string, {
            zone?: string;
            horizontalFlow?: WizardBlock["horizontalFlow"];
            verticalFlow?: WizardBlock["verticalFlow"];
          }>)
        : {};

    if (!venueId) return NextResponse.json({ error: "venueId gerekli" }, { status: 400 });
    if (!planName) return NextResponse.json({ error: "planName gerekli" }, { status: 400 });
    if (plan2Blocks.length === 0) return NextResponse.json({ error: "plan2Blocks boş olamaz" }, { status: 400 });

    const supabase = getSupabaseAdmin();

    const { data: venue } = await supabase.from("venues").select("id").eq("id", venueId).single();
    if (!venue) return NextResponse.json({ error: "Mekan bulunamadı" }, { status: 404 });

    const template = wizardPlanToTemplate(
      plan2Blocks.map((b) => ({
        ...b,
        zone: settingsByBlockId[b.id]?.zone ?? b.zone,
        horizontalFlow: settingsByBlockId[b.id]?.horizontalFlow ?? b.horizontalFlow,
        verticalFlow: settingsByBlockId[b.id]?.verticalFlow ?? b.verticalFlow,
      })),
      planName
    );
    if (!template.sections.length) {
      return NextResponse.json({ error: "Plan geçerli bölüm içermiyor (koridor hariç blok/sıra/segment ekleyin)" }, { status: 400 });
    }

    const { data: existingPlans } = await supabase
      .from("seating_plans")
      .select("id")
      .eq("venue_id", venueId);
    const isFirst = !existingPlans?.length;

    const { data: planData, error: planErr } = await supabase
      .from("seating_plans")
      .insert({ venue_id: venueId, name: template.planName, is_default: isFirst })
      .select()
      .single();

    if (planErr || !planData) {
      console.error("seating_plans insert error:", planErr);
      return NextResponse.json({ error: planErr?.message || "Plan oluşturulamadı" }, { status: 500 });
    }

    const planId = planData.id;

    for (const section of template.sections) {
      const { data: sectionData, error: sectionErr } = await supabase
        .from("seating_plan_sections")
        .insert({
          seating_plan_id: planId,
          name: section.name,
          sort_order: section.sort_order,
          ticket_type_label: section.ticket_type_label ?? null,
        })
        .select()
        .single();

      if (sectionErr || !sectionData) {
        console.error("Section insert failed:", section.name, sectionErr);
        continue;
      }

      for (let ri = 0; ri < section.rows.length; ri++) {
        const row = section.rows[ri];
        const { data: rowData, error: rowErr } = await supabase
          .from("seating_plan_rows")
          .insert({
            section_id: sectionData.id,
            row_label: row.row_label,
            sort_order: row.sort_order,
          })
          .select()
          .single();

        if (rowErr || !rowData) {
          console.error("Row insert failed:", section.name, row.row_label, rowErr);
          continue;
        }

        const toInsert = row.seat_labels.map((seat_label) => ({ row_id: rowData.id, seat_label }));
        for (let chunk = 0; chunk < toInsert.length; chunk += 50) {
          const batch = toInsert.slice(chunk, chunk + 50);
          const { error: seatErr } = await supabase.from("seats").insert(batch);
          if (seatErr) console.error("Seats insert failed:", section.name, row.row_label, seatErr);
        }
      }
    }

    return NextResponse.json({
      success: true,
      seatingPlanId: planId,
      planName: template.planName,
      venueId,
      message: "Plan mekana eklendi. Etkinlik oluştururken bu mekanı ve oturum planını seçebilirsiniz.",
    });
  } catch (e) {
    console.error("salon-yapim-to-venue POST error:", e);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
