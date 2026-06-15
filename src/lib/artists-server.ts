import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createServerSupabase } from "@/lib/supabase-server";
import { DATA_CACHE_REVALIDATE } from "@/lib/server-data-cache";
import type { Artist } from "@/types/database";

async function fetchArtistsForIndex(): Promise<Artist[]> {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("artists")
    .select("*")
    .or("show_on_artist_page.is.null,show_on_artist_page.eq.true")
    .order("name", { ascending: true });
  if (error || !data) return [];
  return data as Artist[];
}

export async function getArtistsForIndex(): Promise<Artist[]> {
  return unstable_cache(fetchArtistsForIndex, ["artists-index"], {
    revalidate: DATA_CACHE_REVALIDATE.artists,
    tags: ["artists"],
  })();
}

async function fetchArtistBySlug(slug: string): Promise<Artist | null> {
  const supabase = createServerSupabase();
  const { data, error } = await supabase.from("artists").select("*").eq("slug", slug).maybeSingle();
  if (error || !data) return null;
  return data as Artist;
}

const getArtistCrossRequest = unstable_cache(fetchArtistBySlug, ["artist-by-slug"], {
  revalidate: DATA_CACHE_REVALIDATE.artists,
  tags: ["artists"],
});

export const getArtistBySlug = cache((slug: string) => getArtistCrossRequest(slug));
