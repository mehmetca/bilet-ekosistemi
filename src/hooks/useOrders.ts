"use client";

import useSWR from "swr";
import type { Order } from "@/types/database";
import { supabase } from "@/lib/supabase-client";

const ORDERS_API = "/api/orders";

async function fetcher(url: string): Promise<Order[]> {
  const { data: { session } } = await supabase.auth.getSession();
  const headers: HeadersInit = { "Cache-Control": "no-store" };
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
  const res = await fetch(url, { credentials: "include", cache: "no-store", headers });
  if (!res.ok) throw new Error("Siparişler yüklenemedi");
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

/**
 * Admin/controller sipariş listesi – SWR cache (revalidate on focus, 60s).
 */
export function useOrders() {
  const { data, error, isLoading, mutate } = useSWR<Order[]>(ORDERS_API, fetcher, {
    revalidateOnFocus: true,
    dedupingInterval: 60_000,
  });
  return {
    orders: data ?? [],
    isLoading,
    isError: !!error,
    error,
    mutate,
  };
}
