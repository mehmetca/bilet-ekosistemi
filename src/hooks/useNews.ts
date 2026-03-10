"use client";

import useSWR from "swr";
import type { News } from "@/types/database";

async function fetcher(): Promise<News[]> {
  const res = await fetch("/api/news?published=true", { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json();
  const list = Array.isArray(data) ? data : [];
  return (list.slice(0, 5)) as News[];
}

/**
 * Haber listesi (ana sayfa) – SWR cache.
 * Sunucu boş gelse bile client tarafında tekrar çekilir.
 */
export function useNews(initialData?: News[]) {
  const { data, error, isLoading, mutate } = useSWR<News[]>("news-list", fetcher, {
    fallbackData: initialData,
    revalidateOnMount: true,
    revalidateOnFocus: true,
    dedupingInterval: 5_000,
  });
  return {
    news: data ?? [],
    isLoading,
    isError: !!error,
    error,
    mutate,
  };
}

export default useNews;
