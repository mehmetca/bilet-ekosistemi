"use client";

import useSWR from "swr";
import type { User } from "@supabase/supabase-js";
import { fetchUserOrders, type UserOrderRow } from "@/lib/user-orders-client";

async function ordersFetcher(): Promise<UserOrderRow[]> {
  return fetchUserOrders();
}

/**
 * Kullanıcının biletleri — tarayıcıdan Supabase (SWR).
 */
export function useUserOrders(user: User | null | undefined) {
  const key = user?.id ? "user-orders" : null;
  const { data, error, isLoading, mutate } = useSWR(key, ordersFetcher, {
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
