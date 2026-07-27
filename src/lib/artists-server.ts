import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createServerSupabase } from "@/lib/supabase-server";
import { DATA_CACHE_REVALIDATE } from "@/lib/server-data-cache";
import { legacyBrokenSlugify, slugify } from "@/lib/slugify";
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

/** Eski bozuk slug (ayfer-dzda) ile mevcut sanatçıyı bul. */
async function findArtistByLegacySlug(requestedSlug: string): Promise<Artist | null> {
  const artists = await getArtistsForIndex();
  const needle = requestedSlug.trim().toLowerCase();
  if (!needle) return null;

  for (const artist of artists) {
    const names = [artist.name, (artist as { name_tr?: string | null }).name_tr].filter(
      Boolean
    ) as string[];
    for (const name of names) {
      if (legacyBrokenSlugify(name) === needle) return artist;
      if (slugify(name) === needle && artist.slug !== needle) return artist;
    }
  }
  return null;
}

export const getArtistBySlug = cache(async (slug: string): Promise<Artist | null> => {
  const direct = await getArtistCrossRequest(slug);
  if (direct) return direct;
  return findArtistByLegacySlug(slug);
});
