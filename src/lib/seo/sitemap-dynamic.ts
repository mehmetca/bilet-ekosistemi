import { createServerSupabase } from "@/lib/supabase-server";

export type SitemapPathEntry = { path: string; lastModified: Date };

function parseDate(s: string | null | undefined): Date {
  if (!s) return new Date();
  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? d : new Date();
}

type EventRow = {
  id: string;
  slug: string | null;
  show_slug: string | null;
  updated_at: string | null;
};

/**
 * Etkinlik URL'leri, sayfadaki canonical ile uyumlu: çoklu show_slug → /etkinlik/{show_slug},
 * aksi halde /etkinlik/{slug || id}.
 */
function eventPathEntries(rows: EventRow[]): SitemapPathEntry[] {
  const byShow = new Map<string, EventRow[]>();
  const noShow: EventRow[] = [];
  for (const r of rows) {
    const ss = r.show_slug?.trim();
    if (!ss) {
      noShow.push(r);
      continue;
    }
    const key = ss.toLowerCase();
    let arr = byShow.get(key);
    if (!arr) {
      arr = [];
      byShow.set(key, arr);
    }
    arr.push(r);
  }
  const out: SitemapPathEntry[] = [];
  const seen = new Set<string>();

  function pushPath(path: string, lastMod: Date) {
    if (seen.has(path)) return;
    seen.add(path);
    out.push({ path, lastModified: lastMod });
  }

  for (const r of noShow) {
    const tail = (r.slug?.trim() || r.id).trim();
    if (!tail) continue;
    pushPath(`/etkinlik/${tail}`, parseDate(r.updated_at));
  }

  for (const [, group] of byShow) {
    const lastMod = new Date(Math.max(...group.map((e) => parseDate(e.updated_at).getTime())));
    if (group.length >= 2) {
      const showSlug = group[0].show_slug!.trim();
      pushPath(`/etkinlik/${showSlug}`, lastMod);
    } else {
      const r = group[0];
      const tail = (r.slug?.trim() || r.id).trim();
      if (!tail) continue;
      pushPath(`/etkinlik/${tail}`, lastMod);
    }
  }
  return out;
}

/** Supabase’ten herkese açık sayfa yolları (env yoksa veya tablo hatasında kısmi/boş döner). */
export async function fetchSitemapDynamicPaths(): Promise<SitemapPathEntry[]> {
  let supabase: ReturnType<typeof createServerSupabase>;
  try {
    supabase = createServerSupabase();
  } catch {
    return [];
  }

  const entries: SitemapPathEntry[] = [];

  const [eventsRes, citiesRes, newsRes, venuesRes, artistsRes] = await Promise.all([
    supabase
      .from("events")
      .select("id, slug, show_slug, updated_at")
      .eq("is_active", true)
      .eq("is_approved", true)
      .eq("is_draft", false)
      .limit(5000),
    supabase.from("cities").select("slug, updated_at").eq("is_active", true).limit(500),
    supabase
      .from("news")
      .select("id, updated_at, published_at")
      .eq("is_published", true)
      .order("published_at", { ascending: false })
      .limit(500),
    supabase.from("venues").select("id, updated_at").limit(2000),
    supabase
      .from("artists")
      .select("slug, updated_at")
      .not("slug", "is", null)
      .or("show_on_artist_page.is.null,show_on_artist_page.eq.true")
      .limit(2000),
  ]);

  if (!eventsRes.error && eventsRes.data?.length) {
    entries.push(...eventPathEntries(eventsRes.data as EventRow[]));
  }

  if (!citiesRes.error && citiesRes.data?.length) {
    for (const c of citiesRes.data as { slug: string; updated_at?: string | null }[]) {
      const slug = c.slug?.trim();
      if (!slug) continue;
      entries.push({ path: `/city/${slug}`, lastModified: parseDate(c.updated_at ?? null) });
    }
  }

  if (!newsRes.error && newsRes.data?.length) {
    for (const n of newsRes.data as { id: string; updated_at?: string | null; published_at?: string | null }[]) {
      entries.push({
        path: `/haber/${n.id}`,
        lastModified: parseDate(n.updated_at ?? n.published_at ?? null),
      });
    }
  }

  if (!venuesRes.error && venuesRes.data?.length) {
    for (const v of venuesRes.data as { id: string; updated_at?: string | null }[]) {
      entries.push({ path: `/mekanlar/${v.id}`, lastModified: parseDate(v.updated_at ?? null) });
    }
  }

  if (!artistsRes.error && artistsRes.data?.length) {
    for (const a of artistsRes.data as { slug: string; updated_at?: string | null }[]) {
      const slug = a.slug?.trim();
      if (!slug) continue;
      entries.push({ path: `/sanatci/${slug}`, lastModified: parseDate(a.updated_at ?? null) });
    }
  }

  return entries;
}
