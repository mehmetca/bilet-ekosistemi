/**
 * Sunucu tarafı etkinlik veri katmanı.
 * Etkinlik detay, şehir, takvim ve show_slug sorguları tek yerden.
 */
import { createServerSupabase } from "@/lib/supabase-server";
import { eventMatchesCityRow } from "@/lib/city-event-sort";
import type { Event, Ticket, Venue } from "@/types/database";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SAFE_ROUTE_SLUG_REGEX = /^[a-zA-Z0-9.-]+$/;

function isSafeRouteSlug(value: string): boolean {
  return SAFE_ROUTE_SLUG_REGEX.test(value) && !value.includes("..");
}

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
  const trimmed = (name || "").trim();
  const idx = TICKET_DISPLAY_ORDER.findIndex((item) => item === trimmed);
  if (idx !== -1) return idx;
  const low = trimmed.toLowerCase();
  if (/\bvip\b/.test(low)) return 0;
  const m = low.match(/kategori\s*([0-9]{1,2})/i);
  if (m) {
    const n = Number.parseInt(m[1]!, 10);
    if (Number.isFinite(n) && n >= 1 && n <= 10) return n;
  }
  return 999;
}

export async function getEventsByShowSlug(showSlug: string): Promise<Event[]> {
  try {
    const supabase = createServerSupabase();
    const showSlugTrimmed = (showSlug || "").trim();
    if (!showSlugTrimmed) return [];
    if (!isSafeRouteSlug(showSlugTrimmed)) return [];
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .eq("show_slug", showSlugTrimmed)
      .eq("is_active", true)
      .eq("is_approved", true)
      .eq("is_draft", false)
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
    const slugOrIdTrimmed = (slugOrId || "").trim();
    if (!UUID_REGEX.test(slugOrIdTrimmed) && !isSafeRouteSlug(slugOrIdTrimmed)) {
      return null;
    }

    const { data, error } = await supabase
      .from("events")
      .select("*")
      .eq("slug", slugOrIdTrimmed)
      .eq("is_active", true)
      .eq("is_approved", true)
      .eq("is_draft", false)
      .single();

    if (!error && data) return { event: data as Event };

    // case-insensitive fallback (URL slug formatı tutmazsa)
    const { data: ciData, error: ciError } = await supabase
      .from("events")
      .select("*")
      .ilike("slug", slugOrIdTrimmed)
      .eq("is_active", true)
      .eq("is_approved", true)
      .eq("is_draft", false)
      .maybeSingle();

    if (!ciError && ciData) return { event: ciData as Event };

    const { data: idData, error: idError } = await supabase
      .from("events")
      .select("*")
      .eq("id", slugOrIdTrimmed)
      .eq("is_active", true)
      .eq("is_approved", true)
      .eq("is_draft", false)
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
      .eq("is_approved", true)
      .eq("is_draft", false)
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

/** Şehir slug ve opsiyonel şehir bilgisiyle eşleşen etkinlikler */
export async function getEventsForCity(
  citySlug: string,
  city?: { name_tr?: string | null; name_de?: string | null; name_en?: string | null } | null
): Promise<Event[]> {
  try {
    const supabase = createServerSupabase();

    const { data: eventsData, error } = await supabase
      .from("events")
      .select("*, venues(city)")
      .eq("is_active", true)
      .eq("is_approved", true)
      .eq("is_draft", false)
      .order("date", { ascending: true })
      .order("time", { ascending: true });

    if (error) {
      console.error("getEventsForCity Supabase error:", error);
      return [];
    }

    const filtered = eventsData.filter((e: Record<string, unknown>) => {
      return eventMatchesCityRow(e, citySlug, city);
    });

    return filtered.map((e: Record<string, unknown>) => {
      const ev = { ...e };
      delete ev.venues;
      return ev;
    }) as unknown as Event[];
  } catch (err) {
    console.error("getEventsForCity error:", err);
    return [];
  }
}
