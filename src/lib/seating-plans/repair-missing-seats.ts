import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllRowsBySectionIds, fetchAllSeatsByRowIds } from "@/lib/fetch-all-seats-by-row-ids";
import { insertSeatsBatched } from "@/lib/seating-plans/insert-seats-batched";

export type RepairMissingSeatsResult = {
  sectionsChecked: number;
  rowsRepaired: number;
  seatsInserted: number;
  details: { sectionName: string; rowLabel: string; inserted: number; templateCount: number }[];
};

/**
 * Bir oturum planında eksik koltukları doldurur.
 * Her bölümde en dolu sıranın seat_label listesini şablon alır; daha az koltuğu olan
 * (veya hiç olmayan) sıralara eksik etiketleri ekler. sales_blocked varsayılan false.
 */
export async function repairMissingSeatsForPlan(
  supabase: SupabaseClient,
  seatingPlanId: string
): Promise<RepairMissingSeatsResult> {
  const { data: sections, error: secErr } = await supabase
    .from("seating_plan_sections")
    .select("id, name")
    .eq("seating_plan_id", seatingPlanId)
    .order("sort_order");
  if (secErr) throw new Error(secErr.message);
  if (!sections?.length) {
    return { sectionsChecked: 0, rowsRepaired: 0, seatsInserted: 0, details: [] };
  }

  const rows = await fetchAllRowsBySectionIds<{
    id: string;
    section_id: string;
    row_label: string;
    sort_order?: number | null;
  }>(supabase, sections.map((s) => s.id));

  const seats = await fetchAllSeatsByRowIds<{
    id: string;
    row_id: string;
    seat_label: string;
    sales_blocked?: boolean | null;
  }>(supabase, rows.map((r) => r.id), "id, row_id, seat_label, sales_blocked");

  const seatsByRow = new Map<string, { seat_label: string; sales_blocked: boolean }[]>();
  for (const s of seats) {
    const list = seatsByRow.get(s.row_id) || [];
    list.push({ seat_label: s.seat_label, sales_blocked: s.sales_blocked === true });
    seatsByRow.set(s.row_id, list);
  }

  const sectionName = new Map(sections.map((s) => [s.id, s.name] as const));
  const rowsBySection = new Map<string, typeof rows>();
  for (const r of rows) {
    const list = rowsBySection.get(r.section_id) || [];
    list.push(r);
    rowsBySection.set(r.section_id, list);
  }

  let rowsRepaired = 0;
  let seatsInserted = 0;
  const details: RepairMissingSeatsResult["details"] = [];

  for (const [sectionId, secRows] of rowsBySection) {
    let templateLabels: string[] = [];
    let bestCount = -1;
    for (const r of secRows) {
      const labels = (seatsByRow.get(r.id) || []).map((x) => x.seat_label);
      if (labels.length > bestCount) {
        bestCount = labels.length;
        templateLabels = sortSeatLabels(labels);
      }
    }
    if (bestCount <= 0) {
      // Hiç koltuk yoksa 1..N üretilemez — atla
      continue;
    }

    for (const r of secRows) {
      const existing = seatsByRow.get(r.id) || [];
      const have = new Set(existing.map((x) => String(x.seat_label)));
      const missing = templateLabels.filter((lab) => !have.has(String(lab)));
      if (missing.length === 0) continue;

      const toInsert = missing.map((seat_label) => ({
        row_id: r.id,
        seat_label,
        sales_blocked: false,
      }));

      try {
        await insertSeatsBatched(supabase, toInsert);
      } catch (error) {
        throw new Error(
          `Koltuk eklenemedi (${sectionName.get(sectionId)} sıra ${r.row_label}): ${
            error instanceof Error ? error.message : "bilinmeyen hata"
          }`
        );
      }

      rowsRepaired += 1;
      seatsInserted += missing.length;
      details.push({
        sectionName: String(sectionName.get(sectionId) || ""),
        rowLabel: String(r.row_label),
        inserted: missing.length,
        templateCount: templateLabels.length,
      });
    }
  }

  return {
    sectionsChecked: sections.length,
    rowsRepaired,
    seatsInserted,
    details,
  };
}

function sortSeatLabels(labels: string[]): string[] {
  return [...labels].sort((a, b) => {
    const na = Number(String(a).trim());
    const nb = Number(String(b).trim());
    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
    return String(a).localeCompare(String(b), undefined, { numeric: true });
  });
}
