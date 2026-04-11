/**
 * Sunucu tarafı etkinlik veri katmanı.
 * Etkinlik detay, şehir, takvim ve show_slug sorguları tek yerden.
 */
import { createServerSupabase } from "@/lib/supabase-server";
import { eventMatchesCityRow, getMatchTerms } from "@/lib/city-event-sort";
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
    const showSlugTrimmed = (showSlug || "").trim();
    if (!showSlugTrimmed) return [];
    const { data, error } = await supabase
      .from("events")
      .select("*")
      // URL'den gelen slug büyük/küçük harf farkından dolayı boş gelebilmesin
      .ilike("show_slug", showSlugTrimmed)
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
    const matchTerms = getMatchTerms(citySlug, city);
    console.log("[DEBUG getEventsForCity] slug:", citySlug, "matchTerms:", matchTerms);

    const { data: eventsData, error } = await supabase
      .from("events")
      .select("*, venues(city)")
      .eq("is_active", true)
      .eq("is_approved", true)
      .eq("is_draft", false)
      .order("date", { ascending: true })
      .order("time", { ascending: true });

    if (error) {
      console.error("[DEBUG getEventsForCity] Supabase error:", error);
      return [];
    }
    
    console.log("[DEBUG getEventsForCity] Total events fetched:", eventsData?.length || 0);

    const filtered = eventsData.filter((e: Record<string, unknown>) => {
      const match = eventMatchesCityRow(e, citySlug, city);
      if (match) {
        const loc = ((e.location as string) || "").toLowerCase().trim();
        const cityField = ((e.city as string) || "").toLowerCase().trim();
        const v = e.venues;
        let venueCity = "";
        if (v != null) {
          if (Array.isArray(v)) venueCity = (v[0] as { city?: string })?.city || "";
          else venueCity = (v as { city?: string }).city || "";
        }
        const vc = venueCity.toLowerCase().trim();
        console.log("[DEBUG getEventsForCity] Matched event:", e.title, "city:", cityField, "location:", loc, "venueCity:", vc);
      }
      return match;
    });

    console.log("[DEBUG getEventsForCity] Filtered events:", filtered.length);

    return filtered.map((e: Record<string, unknown>) => {
      const { venues, ...ev } = e;
      return ev;
    }) as unknown as Event[];
  } catch (err) {
    console.error("[DEBUG getEventsForCity] Error:", err);
    return [];
  }
}
