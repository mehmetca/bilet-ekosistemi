/**
 * Sunucu tarafı etkinlik veri katmanı.
 * Etkinlik detay, şehir, takvim ve show_slug sorguları tek yerden.
 */
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createServerSupabase } from "@/lib/supabase-server";
import { DATA_CACHE_REVALIDATE } from "@/lib/server-data-cache";
import { eventMatchesCityRow, getMatchTerms } from "@/lib/city-event-sort";
import type { Event, Ticket, Venue } from "@/types/database";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SAFE_ROUTE_SLUG_REGEX = /^[a-zA-Z0-9.-]+$/;
const CITY_EVENT_COLUMNS =
  "id,title,slug,date,time,venue,location,image_url,category,price_from,currency,created_at,is_approved,description,title_tr,title_de,title_en,title_ku,title_ckb,description_tr,description_de,description_en,venue_tr,venue_de,venue_en,show_slug,city,venues(city)";
const CITY_EVENTS_TARGETED_LIMIT = 96;
const CITY_EVENTS_FALLBACK_LIMIT = 500;

function isSafeRouteSlug(value: string): boolean {
  return SAFE_ROUTE_SLUG_REGEX.test(value) && !value.includes("..");
}

function todayIsoDate(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function safePostgrestSearchTerm(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || /[,()]/.test(trimmed)) return null;
  return trimmed;
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

async function fetchEventsByShowSlug(showSlug: string): Promise<Event[]> {
  try {
    const supabase = createServerSupabase();
    const showSlugTrimmed = (showSlug || "").trim();
    if (!showSlugTrimmed) return [];
    if (UUID_REGEX.test(showSlugTrimmed)) return [];
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

const getEventsByShowSlugCrossRequest = unstable_cache(fetchEventsByShowSlug, ["events-by-show-slug"], {
  revalidate: DATA_CACHE_REVALIDATE.event,
  tags: ["events"],
});

export const getEventsByShowSlug = cache((showSlug: string) => getEventsByShowSlugCrossRequest(showSlug));

async function fetchEventBySlug(
  slugOrId: string
): Promise<{ event: Event; isUnapproved?: boolean } | null> {
  try {
    const supabase = createServerSupabase();
    const slugOrIdTrimmed = (slugOrId || "").trim();
    if (!UUID_REGEX.test(slugOrIdTrimmed) && !isSafeRouteSlug(slugOrIdTrimmed)) {
      return null;
    }

    if (UUID_REGEX.test(slugOrIdTrimmed)) {
      const { data: idData, error: idError } = await supabase
        .from("events")
        .select("*")
        .eq("id", slugOrIdTrimmed)
        .eq("is_active", true)
        .eq("is_approved", true)
        .eq("is_draft", false)
        .single();

      if (!idError && idData) return { event: idData as Event };

      const { data: unapproved } = await supabase
        .from("events")
        .select("*")
        .eq("id", slugOrIdTrimmed)
        .eq("is_active", true)
        .single();
      if (unapproved) return { event: unapproved as Event, isUnapproved: true };

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

    return null;
  } catch (err) {
    console.error("Fetch event error:", err);
    return null;
  }
}

const getEventBySlugCrossRequest = unstable_cache(fetchEventBySlug, ["event-by-slug"], {
  revalidate: DATA_CACHE_REVALIDATE.event,
  tags: ["events"],
});

export const getEventBySlug = cache((slugOrId: string) => getEventBySlugCrossRequest(slugOrId));

async function fetchVenue(venueId: string | null | undefined): Promise<Venue | null> {
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

const getVenueCrossRequest = unstable_cache(fetchVenue, ["venue-by-id"], {
  revalidate: DATA_CACHE_REVALIDATE.event,
  tags: ["venues"],
});

export const getVenue = cache((venueId: string | null | undefined) => getVenueCrossRequest(venueId));

async function fetchEventTickets(eventId: string): Promise<Ticket[]> {
  try {
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("tickets")
      .select("*")
      .eq("event_id", eventId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) return [];
    return ((data || []) as Ticket[]).sort((a, b) => {
      const ai = typeof a.sort_order === "number" ? a.sort_order : 0;
      const bi = typeof b.sort_order === "number" ? b.sort_order : 0;
      if (ai !== bi) return ai - bi;
      const rankDiff = getTicketSortRank(a.name) - getTicketSortRank(b.name);
      if (rankDiff !== 0) return rankDiff;
      return (a.name || "").localeCompare(b.name || "", "tr");
    });
  } catch {
    return [];
  }
}

const getEventTicketsCrossRequest = unstable_cache(fetchEventTickets, ["event-tickets"], {
  revalidate: DATA_CACHE_REVALIDATE.event,
  tags: ["tickets"],
});

export const getEventTickets = cache((eventId: string) => getEventTicketsCrossRequest(eventId));

async function fetchOrganizerDisplayName(userId: string | null | undefined): Promise<string | null> {
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

const getOrganizerDisplayNameCrossRequest = unstable_cache(fetchOrganizerDisplayName, ["organizer-display-name"], {
  revalidate: DATA_CACHE_REVALIDATE.event,
  tags: ["organizers"],
});

export const getOrganizerDisplayName = cache((userId: string | null | undefined) =>
  getOrganizerDisplayNameCrossRequest(userId)
);

/** Takvim sayfası: tüm aktif etkinlikler (tarih sıralı) */
async function fetchEventsForCalendar(): Promise<Event[]> {
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

export async function getEventsForCalendar(): Promise<Event[]> {
  return unstable_cache(fetchEventsForCalendar, ["events-calendar"], {
    revalidate: DATA_CACHE_REVALIDATE.calendar,
    tags: ["events-calendar"],
  })();
}

/** Şehir slug ve opsiyonel şehir bilgisiyle eşleşen etkinlikler */
async function fetchEventsForCity(
  citySlug: string,
  city?: { name_tr?: string | null; name_de?: string | null; name_en?: string | null } | null
): Promise<Event[]> {
  try {
    const supabase = createServerSupabase();

    const today = todayIsoDate();
    const terms = getMatchTerms(citySlug, city).map(safePostgrestSearchTerm).filter((t): t is string => !!t);
    const cityOrLocationFilter = terms
      .flatMap((term) => [`city.ilike.%${term}%`, `location.ilike.%${term}%`])
      .join(",");

    let eventsData: Record<string, unknown>[] | null = null;
    let error: { message?: string } | null = null;

    if (cityOrLocationFilter) {
      const targeted = await supabase
        .from("events")
        .select(CITY_EVENT_COLUMNS)
        .eq("is_active", true)
        .eq("is_approved", true)
        .eq("is_draft", false)
        .gte("date", today)
        .or(cityOrLocationFilter)
        .order("date", { ascending: true })
        .order("time", { ascending: true })
        .limit(CITY_EVENTS_TARGETED_LIMIT);
      eventsData = (targeted.data || []) as Record<string, unknown>[];
      error = targeted.error;
    }

    if (error || !eventsData || eventsData.length === 0) {
      const fallback = await supabase
        .from("events")
        .select(CITY_EVENT_COLUMNS)
        .eq("is_active", true)
        .eq("is_approved", true)
        .eq("is_draft", false)
        .gte("date", today)
        .order("date", { ascending: true })
        .order("time", { ascending: true })
        .limit(CITY_EVENTS_FALLBACK_LIMIT);
      eventsData = (fallback.data || []) as Record<string, unknown>[];
      error = fallback.error;
    }

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

export async function getEventsForCity(
  citySlug: string,
  city?: { name_tr?: string | null; name_de?: string | null; name_en?: string | null } | null
): Promise<Event[]> {
  return unstable_cache(
    async () => fetchEventsForCity(citySlug, city ?? null),
    ["events-city", citySlug],
    {
      revalidate: DATA_CACHE_REVALIDATE.city,
      tags: ["events-city", `city-${citySlug}`],
    }
  )();
}
