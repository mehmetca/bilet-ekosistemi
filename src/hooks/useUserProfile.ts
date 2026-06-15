"use client";

import useSWR from "swr";
import type { User } from "@supabase/supabase-js";
import {
  ensureUserProfile,
  fetchUserProfile,
  type UserProfile,
} from "@/lib/user-profile-client";

async function profileFetcher([, userId]: [string, string]): Promise<UserProfile | null> {
  return fetchUserProfile(userId);
}

/**
 * Kullanıcı profili — tarayıcıdan Supabase (SWR önbellek).
 */
export function useUserProfile(user: User | null | undefined) {
  const key = user?.id ? (["user-profile", user.id] as const) : null;
  const { data, error, isLoading, mutate } = useSWR(key, profileFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  });

  return {
    profile: data ?? null,
    isLoading,
    isError: !!error,
    error,
    mutate,
    ensureProfile: async (partial?: Parameters<typeof ensureUserProfile>[1]) => {
      if (!user) return null;
      const created = await ensureUserProfile(user, partial);
      await mutate();
      return created;
    },
  };
}
