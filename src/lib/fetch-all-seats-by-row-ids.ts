import type { SupabaseClient } from "@supabase/supabase-js";

const PAGE_SIZE = 1000;
/** UUID listesini URL/query sınırına takılmamak için parçala (PostgREST `.in()` uzunluğu). */
const ROW_ID_IN_CHUNK = 150;

/**
 * `seats` tablosunda PostgREST varsayılan max satır limiti (genelde 1000) tek istekte aşılır;
 * `.range(0, 49999)` bu limiti kaldırmaz. Tüm koltukları almak için sayfalama + gerekirse row_id parçalama kullanır.
 */
export async function fetchAllSeatsByRowIds<T = Record<string, unknown>>(
  supabase: SupabaseClient,
  rowIds: string[],
  selectColumns = "*"
): Promise<T[]> {
  if (rowIds.length === 0) return [];
  const all: T[] = [];
  for (let c = 0; c < rowIds.length; c += ROW_ID_IN_CHUNK) {
    const idChunk = rowIds.slice(c, c + ROW_ID_IN_CHUNK);
    let from = 0;
    for (;;) {
      const { data, error } = await supabase
        .from("seats")
        .select(selectColumns)
        .in("row_id", idChunk)
        .order("id", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      const batch = (data || []) as T[];
      all.push(...batch);
      if (batch.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }
  }
  return all;
}
