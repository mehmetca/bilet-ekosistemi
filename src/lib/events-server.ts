/**
 * Sunucu tarafı etkinlik veri katmanı.
 * Etkinlik detay, şehir, takvim ve show_slug sorguları tek yerden.
 */
import { createServerSupabase } from "@/lib/supabase-server";
import type { Event, Ticket, Venue } from "@/types/database";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const TICKET_DISPLAY_ORDER = [
  "Normal / Standart Bilet",
  "Standart Bilet",
  "Normal Bilet",
  "VIP Bilet",
  "Kategori 1",
  "Kategori 2",
  "Kategori 3",
  "Kategori 4",
  "Kategori 5",
  "Kategori 6",
  "Kategori 7",
  "Kategori 8",
  "Kategori 9",
  "Kategori 10",
] as const;

export function getTicketSortRank(name?: string): number {
  const idx = TICKET_DISPLAY_ORDER.findIndex((item) => item === (name || "").trim());
  return idx === -1 ? 999 : idx;
}

export async function getEventsByShowSlug(showSlug: string): Promise<Event[]> {
  try {
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .eq("show_slug", showSlug)
      .eq("is_active", true)
      .eq("is_approved", true)
      .order("date", { ascending: true })
      .order("time", { ascending: true });
    if (error || !data || data.length < 1) return [];
    return data as Event[];
  } catch {
    return [];
  }
}

export async function getEventBySlug(
  slugOrId: string
): Promise<{ event: Event; isUnapproved?: boolean } | null> {
  try {
    const supabase = createServerSupabase();

    const { data, error } = await supabase
      .from("events")
      .select("*")
      .eq("slug", slugOrId)
      .eq("is_active", true)
      .eq("is_approved", true)
      .single();

    if (!error && data) return { event: data as Event };

    const { data: idData, error: idError } = await supabase
      .from("events")
      .select("*")
      .eq("id", slugOrId)
      .eq("is_active", true)
      .eq("is_approved", true)
      .single();

    if (!idError && idData) return { event: idData as Event };

    if (UUID_REGEX.test(slugOrId)) {
      const { data: unapproved } = await supabase
        .from("events")
        .select("*")
        .eq("id", slugOrId)
        .eq("is_active", true)
        .single();
      if (unapproved) return { event: unapproved as Event, isUnapproved: true };
    }

    return null;
  } catch (err) {
    console.error("Fetch event error:", err);
    return null;
  }
}

export async function getVenue(venueId: string | null | undefined): Promise<Venue | null> {
  if (!venueId) return null;
  try {
    const supabase = createServerSupabase();
    const { data, error } = await supabase.from("venues").select("*").eq("id", venueId).single();
    if (error || !data) return null;
    return {
      ...data,
      faq: Array.isArray(data.faq)
        ? (data.faq as Array<{ soru: string; cevap: string }>).filter((x) => x?.soru && x?.cevap)
        : [],
    } as Venue;
  } catch {
    return null;
  }
}

export async function getEventTickets(eventId: string): Promise<Ticket[]> {
  try {
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("tickets")
      .select("*")
      .eq("event_id", eventId);
    if (error) return [];
    return ((data || []) as Ticket[]).sort((a, b) => {
      const rankDiff = getTicketSortRank(a.name) - getTicketSortRank(b.name);
      if (rankDiff !== 0) return rankDiff;
      return (a.name || "").localeCompare(b.name || "", "tr");
    });
  } catch {
    return [];
  }
}

export async function getOrganizerDisplayName(
  userId: string | null | undefined
): Promise<string | null> {
  if (!userId) return null;
  try {
    const supabase = createServerSupabase();
    const { data } = await supabase
      .from("organizer_profiles")
      .select("organization_display_name")
      .eq("user_id", userId)
      .single();
    return data?.organization_display_name?.trim() || null;
  } catch {
    return null;
  }
}

/** Takvim sayfası: tüm aktif etkinlikler (tarih sıralı) */
export async function getEventsForCalendar(): Promise<Event[]> {
  try {
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .eq("is_active", true)
      .order("date", { ascending: true });
    if (error) {
      console.error("Events fetch error:", error);
      return [];
    }
    return (data ?? []) as Event[];
  } catch (err) {
    console.error("Fetch events error:", err);
    return [];
  }
}

function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/ı/g, "i")
    .replace(/İ/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c");
}

function getMatchTerms(
  slug: string,
  city?: { name_tr?: string | null; name_de?: string | null; name_en?: string | null } | null
): string[] {
  const slugLower = slug.toLowerCase().trim();
  const parts = slugLower.split(/-+/).filter(Boolean);
  const arr: string[] = [slugLower];
  parts.forEach((p) => {
    if (p && arr.indexOf(p) === -1) arr.push(p);
  });
  if (city) {
    [city.name_tr, city.name_de, city.name_en].filter(Boolean).forEach((n) => {
      if (n) {
        const t = n.toLowerCase().trim();
        if (t && arr.indexOf(t) === -1) arr.push(t);
      }
    });
  }
  return arr;
}

function matchesCity(loc: string, vc: string, matchTerms: string[]): boolean {
  const locNorm = normalizeForMatch(loc);
  const vcNorm = normalizeForMatch(vc);
  return matchTerms.some((term) => {
    if (!term) return false;
    const termNorm = normalizeForMatch(term);
    return (
      loc === term ||
      vc === term ||
      locNorm === termNorm ||
      vcNorm === termNorm ||
      locNorm.includes(termNorm) ||
      vcNorm.includes(termNorm)
    );
  });
}

/** Şehir slug ve opsiyonel şehir bilgisiyle eşleşen etkinlikler */
export async function getEventsForCity(
  citySlug: string,
  city?: { name_tr?: string | null; name_de?: string | null; name_en?: string | null } | null
): Promise<Event[]> {
  try {
    const supabase = createServerSupabase();
    const matchTerms = getMatchTerms(citySlug, city);

    const { data: eventsData, error } = await supabase
      .from("events")
      .select("*, venues(city)")
      .eq("is_active", true)
      .order("date", { ascending: true })
      .order("time", { ascending: true });

    if (error || !eventsData) return [];

    const filtered = eventsData.filter((e: Record<string, unknown>) => {
      const loc = ((e.location as string) || "").toLowerCase().trim();
      const v = e.venues;
      let venueCity = "";
      if (v != null) {
        if (Array.isArray(v)) venueCity = (v[0] as { city?: string })?.city || "";
        else venueCity = (v as { city?: string }).city || "";
      }
      const vc = venueCity.toLowerCase().trim();
      return matchesCity(loc, vc, matchTerms);
    });

    return filtered.map((e: Record<string, unknown>) => {
      const { venues, ...ev } = e;
      return ev;
    }) as unknown as Event[];
  } catch {
    return [];
  }
}
