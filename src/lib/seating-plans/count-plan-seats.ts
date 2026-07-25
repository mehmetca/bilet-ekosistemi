import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllRowsBySectionIds, fetchAllSeatsByRowIds } from "@/lib/fetch-all-seats-by-row-ids";

/** Planın veritabanındaki gerçek koltuk sayısı (sayfalı okuma). */
export async function countSeatsForPlan(
  supabase: SupabaseClient,
  seatingPlanId: string
): Promise<number> {
  const { data: sections, error } = await supabase
    .from("seating_plan_sections")
    .select("id")
    .eq("seating_plan_id", seatingPlanId);
  if (error) throw new Error(error.message);
  if (!sections?.length) return 0;

  const rows = await fetchAllRowsBySectionIds<{ id: string }>(
    supabase,
    sections.map((s) => s.id),
    "id"
  );
  if (!rows.length) return 0;

  const seats = await fetchAllSeatsByRowIds<{ id: string }>(
    supabase,
    rows.map((r) => r.id),
    "id"
  );
  return seats.length;
}
