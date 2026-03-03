import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase-server";
import type { Event, Ticket, Venue } from "@/types/database";
import EventDetailClient from "@/app/etkinlik/[id]/client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface PageProps {
  params: {
    id: string;
  };
}

async function getVenue(venueId: string | null | undefined): Promise<Venue | null> {
  if (!venueId) return null;
  try {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase.from("venues").select("*").eq("id", venueId).single();
    if (error || !data) return null;
    return {
      id: data.id,
      name: data.name,
      address: data.address || null,
      city: data.city || null,
      capacity: data.capacity != null ? Number(data.capacity) : null,
      seating_layout_description: data.seating_layout_description || null,
      seating_layout_image_url: data.seating_layout_image_url || null,
      entrance_info: data.entrance_info || null,
      transport_info: data.transport_info || null,
      map_embed_url: data.map_embed_url || null,
      rules: data.rules || null,
      faq: Array.isArray(data.faq)
        ? (data.faq as Array<{ soru: string; cevap: string }>).filter((x) => x?.soru && x?.cevap)
        : [],
    };
  } catch {
    return null;
  }
}

const TICKET_DISPLAY_ORDER = [
  "Standart Bilet",
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

function getTicketSortRank(name?: string): number {
  const idx = TICKET_DISPLAY_ORDER.findIndex((item) => item === (name || "").trim());
  return idx === -1 ? 999 : idx;
}

async function getEventBySlug(slugOrId: string): Promise<Event | null> {
  try {
    const supabase = await createServerSupabase();

    // Önce slug ile dene
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .eq("slug", slugOrId)
      .single();

    // Eğer slug ile bulunamazsa, ID ile dene (fallback)
    if (error && !data) {
      const { data: idData, error: idError } = await supabase
        .from("events")
        .select("*")
        .eq("id", slugOrId)
        .single();

      if (idError) {
        console.error("Both slug and ID failed:", { slugError: error, idError });
        return null;
      }

      return idData as Event;
    }

    if (error) {
      console.error("Event fetch error:", error);
      return null;
    }

    return data as Event;
  } catch (error) {
    console.error("Fetch event error:", error);
    return null;
  }
}

async function getEventTickets(eventId: string): Promise<Ticket[]> {
  try {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from("tickets")
      .select("*")
      .eq("event_id", eventId)
      .gt("available", 0);

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

export default async function EventDetailPage({ params }: PageProps) {
  const event = await getEventBySlug(params.id);
  const tickets = event ? await getEventTickets(event.id) : [];
  const venue = event?.venue_id ? await getVenue(event.venue_id) : null;

  if (!event) {
    notFound();
  }

  return <EventDetailClient event={event} tickets={tickets} venue={venue} />;
}
