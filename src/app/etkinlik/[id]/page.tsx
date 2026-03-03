import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase-server";
import type { Event, Ticket } from "@/types/database";
import EventDetailClient from "@/app/etkinlik/[id]/client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface PageProps {
  params: {
    id: string;
  };
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

  if (!event) {
    notFound();
  }

  return <EventDetailClient event={event} tickets={tickets} />;
}
