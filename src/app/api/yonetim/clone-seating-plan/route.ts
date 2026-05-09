import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

type CloneBody = {
  source_plan_id?: string;
  /** İsteğe bağlı; verilmezse kaynak planın mekanı kullanılır */
  venue_id?: string | null;
  /** Yeni plan adı (örn. "Salon 1 · Konser · 2025-06-15 20:00") */
  name?: string | null;
};

/**
 * Oturum planının derin kopyası: bölüm, sıra, koltuk (yeni UUID'ler).
 * Her etkinlik/seans kendi koltuk envanterine sahip olur; organizatörler birbirini engellemez.
 */
export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ["admin", "organizer"]);
  if (auth instanceof NextResponse) return auth;

  let body: CloneBody;
  try {
    body = (await request.json()) as CloneBody;
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  const sourcePlanId = (body.source_plan_id || "").trim();
  if (!sourcePlanId) {
    return NextResponse.json({ error: "source_plan_id gerekli." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: sourcePlan, error: planErr } = await supabase
    .from("seating_plans")
    .select("id, venue_id, name")
    .eq("id", sourcePlanId)
    .maybeSingle();

  if (planErr) {
    return NextResponse.json({ error: planErr.message }, { status: 500 });
  }
  if (!sourcePlan) {
    return NextResponse.json({ error: "Kaynak oturum planı bulunamadı." }, { status: 404 });
  }

  const venueId = (body.venue_id || "").trim() || (sourcePlan as { venue_id: string }).venue_id;
  if (venueId !== (sourcePlan as { venue_id: string }).venue_id) {
    return NextResponse.json(
      { error: "Salon kopyası yalnızca kaynakla aynı mekanda oluşturulabilir." },
      { status: 400 }
    );
  }

  const baseName = (sourcePlan as { name: string }).name || "Salon";
  const newNameRaw = (body.name || "").trim() || `${baseName} (etkinlik kopyası)`;
  const newName = newNameRaw.slice(0, 200);

  const { data: newPlan, error: insertPlanErr } = await supabase
    .from("seating_plans")
    .insert({
      venue_id: venueId,
      name: newName,
      is_default: false,
    })
    .select("id")
    .single();

  if (insertPlanErr || !newPlan) {
    return NextResponse.json(
      { error: insertPlanErr?.message || "Yeni plan oluşturulamadı." },
      { status: 500 }
    );
  }

  const newPlanId = (newPlan as { id: string }).id;

  const { data: sections, error: secErr } = await supabase
    .from("seating_plan_sections")
    .select(
      "id, name, sort_order, ticket_type_label, corridor_mode, corridor_gap_px, corridor_after_seat_label, section_align"
    )
    .eq("seating_plan_id", sourcePlanId)
    .order("sort_order");

  if (secErr) {
    await supabase.from("seating_plans").delete().eq("id", newPlanId);
    return NextResponse.json({ error: secErr.message }, { status: 500 });
  }

  const sectionIdMap = new Map<string, string>();

  for (const sec of sections || []) {
    const s = sec as Record<string, unknown>;
    const { data: inserted, error } = await supabase
      .from("seating_plan_sections")
      .insert({
        seating_plan_id: newPlanId,
        name: s.name,
        sort_order: s.sort_order ?? 0,
        ticket_type_label: s.ticket_type_label ?? null,
        corridor_mode: s.corridor_mode ?? "none",
        corridor_gap_px: s.corridor_gap_px ?? 0,
        corridor_after_seat_label: s.corridor_after_seat_label ?? null,
        section_align: s.section_align ?? null,
      })
      .select("id")
      .single();

    if (error || !inserted) {
      await supabase.from("seating_plans").delete().eq("id", newPlanId);
      return NextResponse.json({ error: error?.message || "Bölüm kopyalanamadı." }, { status: 500 });
    }
    sectionIdMap.set(String(s.id), (inserted as { id: string }).id);
  }

  const oldSectionIds = [...sectionIdMap.keys()];
  if (oldSectionIds.length === 0) {
    return NextResponse.json({ plan_id: newPlanId, message: "Boş plan kopyalandı." });
  }

  const { data: rows, error: rowsErr } = await supabase
    .from("seating_plan_rows")
    .select("id, section_id, row_label, sort_order, ticket_type_label")
    .in("section_id", oldSectionIds)
    .order("sort_order");

  if (rowsErr) {
    await supabase.from("seating_plans").delete().eq("id", newPlanId);
    return NextResponse.json({ error: rowsErr.message }, { status: 500 });
  }

  const rowIdMap = new Map<string, string>();

  for (const row of rows || []) {
    const r = row as Record<string, unknown>;
    const newSectionId = sectionIdMap.get(String(r.section_id));
    if (!newSectionId) continue;

    const { data: insertedRow, error } = await supabase
      .from("seating_plan_rows")
      .insert({
        section_id: newSectionId,
        row_label: r.row_label,
        sort_order: r.sort_order ?? 0,
        ticket_type_label: r.ticket_type_label ?? null,
      })
      .select("id")
      .single();

    if (error || !insertedRow) {
      await supabase.from("seating_plans").delete().eq("id", newPlanId);
      return NextResponse.json({ error: error?.message || "Sıra kopyalanamadı." }, { status: 500 });
    }
    rowIdMap.set(String(r.id), (insertedRow as { id: string }).id);
  }

  const oldRowIds = [...rowIdMap.keys()];
  if (oldRowIds.length === 0) {
    return NextResponse.json({ plan_id: newPlanId });
  }

  const { data: seats, error: seatsErr } = await supabase
    .from("seats")
    .select("row_id, seat_label, x, y, sales_blocked")
    .in("row_id", oldRowIds);

  if (seatsErr) {
    await supabase.from("seating_plans").delete().eq("id", newPlanId);
    return NextResponse.json({ error: seatsErr.message }, { status: 500 });
  }

  const seatPayload = (seats || [])
    .map((st) => {
      const s = st as Record<string, unknown>;
      const nr = rowIdMap.get(String(s.row_id));
      if (!nr) return null;
      return {
        row_id: nr,
        seat_label: s.seat_label,
        x: s.x ?? null,
        y: s.y ?? null,
        sales_blocked: s.sales_blocked === true,
      };
    })
    .filter(Boolean) as Record<string, unknown>[];

  if (seatPayload.length > 0) {
    const { error: insSeatsErr } = await supabase.from("seats").insert(seatPayload);
    if (insSeatsErr) {
      await supabase.from("seating_plans").delete().eq("id", newPlanId);
      return NextResponse.json({ error: insSeatsErr.message }, { status: 500 });
    }
  }

  const res = NextResponse.json({ plan_id: newPlanId });
  res.headers.set("Cache-Control", "no-store, max-age=0");
  return res;
}
