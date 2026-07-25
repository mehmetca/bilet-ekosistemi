import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllRowsBySectionIds, fetchAllSeatsByRowIds } from "@/lib/fetch-all-seats-by-row-ids";

export type DeleteSeatingPlanResult = {
  planId: string;
  planName: string;
  sectionsDeleted: number;
  rowsDeleted: number;
  seatsDeleted: number;
  eventsUnlinked: number;
};

/**
 * Salon (oturum planı) ve tüm alt kayıtlarını siler.
 * - Satılmış koltuk (iptal edilmemiş sipariş) varsa engeller.
 * - Bağlı etkinliklerin seating_plan_id alanını NULL yapar.
 * - sections → rows → seats CASCADE ile de gider; yine de sayım için önce okunur.
 */
export async function deleteSeatingPlanFully(
  supabase: SupabaseClient,
  seatingPlanId: string,
  opts?: { forceUnlinkEvents?: boolean }
): Promise<DeleteSeatingPlanResult> {
  const { data: plan, error: planErr } = await supabase
    .from("seating_plans")
    .select("id, name")
    .eq("id", seatingPlanId)
    .maybeSingle();
  if (planErr) throw new Error(planErr.message);
  if (!plan) throw new Error("Salon bulunamadı.");

  const { data: linkedEvents, error: evErr } = await supabase
    .from("events")
    .select("id")
    .eq("seating_plan_id", seatingPlanId);
  if (evErr) throw new Error(evErr.message);

  const eventIds = (linkedEvents || []).map((e) => e.id);
  if (eventIds.length > 0) {
    const { data: orders, error: ordersErr } = await supabase
      .from("orders")
      .select("id")
      .in("event_id", eventIds)
      .neq("status", "cancelled");
    if (ordersErr) throw new Error(ordersErr.message);

    const orderIds = (orders || []).map((o) => o.id);
    if (orderIds.length > 0) {
      const { data: orderSeats, error: osErr } = await supabase
        .from("order_seats")
        .select("seat_id")
        .in("order_id", orderIds)
        .limit(1);
      if (osErr) throw new Error(osErr.message);
      if (orderSeats && orderSeats.length > 0) {
        throw new Error(
          "Bu salonda satılmış koltuk var (iptal edilmemiş sipariş). Önce ilgili etkinlik/siparişleri temizleyin veya iptal edin."
        );
      }
    }
  }

  const { data: sections, error: secErr } = await supabase
    .from("seating_plan_sections")
    .select("id")
    .eq("seating_plan_id", seatingPlanId);
  if (secErr) throw new Error(secErr.message);

  const sectionIds = (sections || []).map((s) => s.id);
  let rowsDeleted = 0;
  let seatsDeleted = 0;
  if (sectionIds.length > 0) {
    const rows = await fetchAllRowsBySectionIds<{ id: string }>(supabase, sectionIds, "id");
    rowsDeleted = rows.length;
    if (rows.length > 0) {
      const seats = await fetchAllSeatsByRowIds<{ id: string }>(
        supabase,
        rows.map((r) => r.id),
        "id"
      );
      seatsDeleted = seats.length;
      // seat_holds / order_seats → seats ON DELETE CASCADE
      for (let i = 0; i < seats.length; i += 150) {
        const chunk = seats.slice(i, i + 150).map((s) => s.id);
        const { error } = await supabase.from("seats").delete().in("id", chunk);
        if (error) throw new Error(`Koltuklar silinemedi: ${error.message}`);
      }
      for (let i = 0; i < rows.length; i += 150) {
        const chunk = rows.slice(i, i + 150).map((r) => r.id);
        const { error } = await supabase.from("seating_plan_rows").delete().in("id", chunk);
        if (error) throw new Error(`Sıralar silinemedi: ${error.message}`);
      }
    }
    const { error: delSecErr } = await supabase
      .from("seating_plan_sections")
      .delete()
      .eq("seating_plan_id", seatingPlanId);
    if (delSecErr) throw new Error(`Bölümler silinemedi: ${delSecErr.message}`);
  }

  let eventsUnlinked = 0;
  if (eventIds.length > 0 || opts?.forceUnlinkEvents) {
    const { error: unlinkErr } = await supabase
      .from("events")
      .update({ seating_plan_id: null })
      .eq("seating_plan_id", seatingPlanId);
    if (unlinkErr) throw new Error(`Etkinlik bağlantıları kaldırılamadı: ${unlinkErr.message}`);
    eventsUnlinked = eventIds.length;
  }

  const { error: delPlanErr } = await supabase.from("seating_plans").delete().eq("id", seatingPlanId);
  if (delPlanErr) throw new Error(`Salon silinemedi: ${delPlanErr.message}`);

  return {
    planId: seatingPlanId,
    planName: String(plan.name || ""),
    sectionsDeleted: sectionIds.length,
    rowsDeleted,
    seatsDeleted,
    eventsUnlinked,
  };
}

/** Etkinlik için üretilmiş salon kopyası mı? (şablon değil) */
export function looksLikeEventDedicatedPlan(planName: string | null | undefined): boolean {
  const name = String(planName || "");
  if (!name) return false;
  if (name.includes("(etkinlik kopyası)")) return true;
  // Wizard: "Salon · Başlık · 2026-07-25 20:00"
  if (/ · \d{4}-\d{2}-\d{2}/.test(name)) return true;
  return false;
}

/**
 * Etkinlik silindikten sonra, yalnızca bu etkinliğe özel salon kopyasını siler.
 * Başka etkinlik kullanıyorsa veya şablon gibi görünüyorsa dokunmaz.
 */
export async function deleteExclusiveSeatingPlanForEvent(
  supabase: SupabaseClient,
  seatingPlanId: string | null | undefined
): Promise<DeleteSeatingPlanResult | null> {
  if (!seatingPlanId) return null;

  const { data: plan } = await supabase
    .from("seating_plans")
    .select("id, name, is_default")
    .eq("id", seatingPlanId)
    .maybeSingle();
  if (!plan) return null;

  const { count, error: countErr } = await supabase
    .from("events")
    .select("id", { count: "exact", head: true })
    .eq("seating_plan_id", seatingPlanId);
  if (countErr) throw new Error(countErr.message);

  // Hâlâ başka etkinlik bağlıysa bırak
  if ((count ?? 0) > 0) return null;

  // Varsayılan / şablon planları koru; yalnızca etkinlik kopyalarını sil
  if (plan.is_default && !looksLikeEventDedicatedPlan(plan.name)) return null;
  if (!looksLikeEventDedicatedPlan(plan.name)) return null;

  return deleteSeatingPlanFully(supabase, seatingPlanId, { forceUnlinkEvents: true });
}
