import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createServerSupabase } from "@/lib/supabase-server";
import { DATA_CACHE_REVALIDATE } from "@/lib/server-data-cache";

export type VenueListRow = Record<string, unknown>;

async function fetchVenuesList(): Promise<VenueListRow[]> {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("venues")
    .select("*")
    .order("city", { ascending: true })
    .order("name", { ascending: true });
  if (error || !data) return [];
  return data as VenueListRow[];
}

export async function getVenuesList(): Promise<VenueListRow[]> {
  return unstable_cache(fetchVenuesList, ["venues-list"], {
    revalidate: DATA_CACHE_REVALIDATE.venues,
    tags: ["venues"],
  })();
}

async function fetchVenueById(id: string): Promise<VenueListRow | null> {
  const supabase = createServerSupabase();
  const { data, error } = await supabase.from("venues").select("*").eq("id", id).maybeSingle();
  if (error || !data) return null;
  return data as VenueListRow;
}

const getVenueCrossRequest = unstable_cache(fetchVenueById, ["venue-by-id"], {
  revalidate: DATA_CACHE_REVALIDATE.venues,
  tags: ["venues"],
});

export const getVenueById = cache((id: string) => getVenueCrossRequest(id));
