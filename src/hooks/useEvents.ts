"use client";

import useSWR from "swr";
import type { Event } from "@/types/database";

async function fetcher(): Promise<Event[]> {
  const res = await fetch("/api/events", { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? (data as Event[]) : [];
}

/**
 * Etkinlik listesi (ana sayfa) – SWR cache.
 * Sunucu boş gelse bile client tarafında tekrar çekilir.
 */
export function useEvents(initialData?: Event[]) {
  const { data, error, isLoading, mutate } = useSWR<Event[]>("events-list", fetcher, {
    fallbackData: initialData,
    revalidateOnMount: true,
    revalidateOnFocus: true,
    dedupingInterval: 15_000,
  });
  return {
    events: data ?? [],
    isLoading,
    isError: !!error,
    error,
    mutate,
  };
}

export default useEvents;
