"use client";

import useSWR from "swr";
import type { Event } from "@/types/database";

async function fetcher(): Promise<Event[]> {
  const res = await fetch("/api/events");
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? (data as Event[]) : [];
}

/**
 * Etkinlik listesi – SWR. initialData verilmişse ek istek atılmaz.
 */
export function useEvents(initialData?: Event[]) {
  const { data, error, isLoading, mutate } = useSWR<Event[]>(
    initialData ? null : "events-list",
    fetcher,
    {
      fallbackData: initialData,
      revalidateOnMount: !initialData,
      revalidateOnFocus: false,
      dedupingInterval: 60_000,
    }
  );
  return {
    events: data ?? [],
    isLoading,
    isError: !!error,
    error,
    mutate,
  };
}

export default useEvents;
