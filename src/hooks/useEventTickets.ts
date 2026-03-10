"use client";

import useSWR from "swr";
import type { Ticket } from "@/types/database";

async function fetcher([, eventId]: [string, string]): Promise<Ticket[]> {
  const { supabase } = await import("@/lib/supabase-client");
  const { data, error } = await supabase
    .from("tickets")
    .select("id,event_id,name,type,price,quantity,available,description,is_active,created_at,updated_at")
    .eq("event_id", eventId)
    .gt("available", 0);
  if (error) throw error;
  return (data ?? []) as Ticket[];
}

/**
 * Etkinlik bilet türleri – SWR cache (revalidate on focus, 2 dakika).
 */
export function useEventTickets(eventId: string | null, initialData?: Ticket[]) {
  const { data, error, isLoading, mutate } = useSWR<Ticket[]>(
    eventId ? ["event-tickets", eventId] : null,
    fetcher,
    {
      fallbackData: initialData,
      revalidateOnFocus: true,
      dedupingInterval: 120_000,
    }
  );
  return {
    tickets: data ?? [],
    isLoading,
    isError: !!error,
    error,
    mutate,
  };
}
