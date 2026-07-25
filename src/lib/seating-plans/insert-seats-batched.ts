import type { SupabaseClient } from "@supabase/supabase-js";

export type SeatInsertRow = {
  row_id: string;
  seat_label: string;
  x?: number | null;
  y?: number | null;
  sales_blocked?: boolean;
};

/** Koltukları parça parça yazar; hata olursa sessizce geçmez. */
export async function insertSeatsBatched(
  supabase: SupabaseClient,
  rows: SeatInsertRow[],
  batchSize = 50
): Promise<void> {
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase.from("seats").insert(batch);
    if (error) {
      throw new Error(error.message || "Koltuk insert başarısız");
    }
  }
}
