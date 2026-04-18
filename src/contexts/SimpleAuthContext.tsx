"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";

type SupabaseClientModule = typeof import("@/lib/supabase-client");
let supabaseModulePromise: Promise<SupabaseClientModule> | null = null;

async function getSupabase(): Promise<SupabaseClient> {
  if (!supabaseModulePromise) supabaseModulePromise = import("@/lib/supabase-client");
  return (await supabaseModulePromise).supabase as unknown as SupabaseClient;
}

interface SimpleAuthType {
  user: User | null;
  /** API çağrılarında Authorization: Bearer için; getSession() yarışına güvenme. */
  accessToken: string | null;
  loading: boolean;
  isAdmin: boolean;
  isController: boolean;
  isOrganizer: boolean;
  userRole: "admin" | "controller" | "organizer" | null;
  signOut: () => Promise<void>;
  refreshRole: () => Promise<void>;
}

const SimpleAuthContext = createContext<SimpleAuthType | undefined>(undefined);

export function SimpleAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<"admin" | "controller" | "organizer" | null>(null);
  const userRef = useRef<User | null>(null);
  const userRoleRef = useRef<"admin" | "controller" | "organizer" | null>(null);
  const roleFetchInFlightForRef = useRef<string | null>(null);
  const lastAuthEventRef = useRef<{ key: string; at: number } | null>(null);
  const authSubscriptionRef = useRef<{ unsubscribe?: () => void } | undefined>(undefined);

  const isAdmin = userRole === "admin";
  const isController = userRole === "controller";
  const isOrganizer = userRole === "organizer";

  async function fetchUserRole(userId: string, force = false) {
    if (!force && roleFetchInFlightForRef.current === userId) {
      return userRoleRef.current;
    }
    if (!force && userRoleRef.current && userRef.current?.id === userId) {
      return userRoleRef.current;
    }

    try {
      roleFetchInFlightForRef.current = userId;
      const supabase = await getSupabase();
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .order("role", { ascending: false })
        .limit(1);

      if (error) {
        setUserRole(null);
        userRoleRef.current = null;
        return null;
      }

      const role = data && data.length > 0 ? (data[0].role as "admin" | "controller" | "organizer") : null;
      setUserRole(role);
      userRoleRef.current = role;
      return role;
    } catch (error) {
      console.error("Role fetch error:", error);
      setUserRole(null);
      userRoleRef.current = null;
      return null;
    } finally {
      roleFetchInFlightForRef.current = null;
    }
  }

  useEffect(() => {
    let mounted = true;
    userRef.current = user;
    userRoleRef.current = userRole;

    const loadingTimeout = window.setTimeout(() => {
      try {
        if (mounted) setLoading(false);
      } catch (_) {
        /* ignore */
      }
    }, 8000);

    (async () => {
      const supabase = await getSupabase();
      if (!mounted) return;

      const checkAuth = async () => {
        try {
          let data: { session: { user?: unknown; access_token?: string } | null };
          let error: { message?: string } | null;
          try {
            const result = await supabase.auth.getSession();
            data = result.data;
            error = result.error;
          } catch (supabaseErr: unknown) {
            const msg = (supabaseErr as { message?: string })?.message ?? "";
            const isRefreshTokenError = /refresh.?token|Invalid Refresh Token/i.test(msg);
            if (isRefreshTokenError) {
              try {
                await supabase.auth.signOut({ scope: "local" });
              } catch (_) {
                /* clear local session only */
              }
              if (mounted) {
                setUser(null);
                setUserRole(null);
                setLoading(false);
              }
              return;
            }
            console.error("Supabase auth init error:", supabaseErr);
            if (mounted) {
              setUser(null);
              setUserRole(null);
              setLoading(false);
            }
            return;
          }
          if (error) {
            const msg = error?.message ?? "";
            const isRefreshTokenError = /refresh.?token|Invalid Refresh Token/i.test(msg);
            if (isRefreshTokenError) {
              try {
                await supabase.auth.signOut({ scope: "local" });
              } catch (_) {
                /* clear local session only */
              }
              if (mounted) {
                setUser(null);
                setUserRole(null);
                setLoading(false);
              }
              return;
            }
            console.error("Auth getSession error:", error);
            if (mounted) setLoading(false);
            return;
          }

          const session = data?.session;

          if (mounted) {
            if (session?.user) {
              const u = session.user as User;
              setUser(u);
              userRef.current = u;
              try {
                await Promise.race([
                  fetchUserRole(u.id, true),
                  new Promise<void>((_, reject) => setTimeout(() => reject(new Error("Role fetch timeout")), 5000)),
                ]);
              } catch (roleErr) {
                console.warn("Role fetch error (continuing):", roleErr);
              }
            } else {
              setUser(null);
              setAccessToken(null);
              setUserRole(null);
              userRef.current = null;
              userRoleRef.current = null;
            }
          }
        } catch (error) {
          console.error("Auth check error:", error);
        } finally {
          if (mounted) {
            setLoading(false);
          }
        }
      };

      checkAuth();

      try {
        const { data: subData } = supabase.auth.onAuthStateChange((event, session) => {
          try {
            if (!mounted) return;

            const dedupeKey = `${event}:${session?.user?.id || "none"}:${session?.access_token?.slice(-8) || "na"}`;
            const now = Date.now();
            if (
              lastAuthEventRef.current &&
              lastAuthEventRef.current.key === dedupeKey &&
              now - lastAuthEventRef.current.at < 2000
            ) {
              return;
            }
            lastAuthEventRef.current = { key: dedupeKey, at: now };

            if (event === "SIGNED_OUT") {
              setUser(null);
              setAccessToken(null);
              setUserRole(null);
              userRef.current = null;
              userRoleRef.current = null;
              setLoading(false);
            } else if (
              event === "SIGNED_IN" ||
              event === "TOKEN_REFRESHED" ||
              event === "USER_UPDATED" ||
              event === "INITIAL_SESSION"
            ) {
              if (session?.user) {
                const userChanged = userRef.current?.id !== session.user.id;
                setUser(session.user);
                setAccessToken(session.access_token ?? null);
                userRef.current = session.user;

                const needRole =
                  event === "SIGNED_IN" || event === "USER_UPDATED" || userChanged || event === "INITIAL_SESSION";
                if (needRole) {
                  const userId = session.user.id;
                  const force = userChanged || event !== "TOKEN_REFRESHED";
                  setTimeout(() => {
                    if (!mounted) return;
                    fetchUserRole(userId, force).finally(() => {
                      if (mounted) setLoading(false);
                    });
                  }, 0);
                  return;
                }
              } else {
                setUser(null);
                setAccessToken(null);
                setUserRole(null);
                userRef.current = null;
                userRoleRef.current = null;
              }
              setLoading(false);
            }
          } catch (err) {
            console.error("Auth state change handler error:", err);
            if (mounted) setLoading(false);
          }
        });
        if (mounted) authSubscriptionRef.current = subData?.subscription;
      } catch (subErr) {
        console.error("Auth subscription error:", subErr);
      }
    })();

    return () => {
      mounted = false;
      window.clearTimeout(loadingTimeout);
      authSubscriptionRef.current?.unsubscribe?.();
      authSubscriptionRef.current = undefined;
    };
  }, []);

  async function signOut() {
    const supabase = await getSupabase();
    await supabase.auth.signOut({ scope: "local" }).catch(() => {});
    setUser(null);
    setAccessToken(null);
    setUserRole(null);
    userRef.current = null;
    userRoleRef.current = null;
  }

  async function refreshRole() {
    if (user) {
      await fetchUserRole(user.id);
    }
  }

  const value: SimpleAuthType = {
    user,
    accessToken,
    loading,
    isAdmin,
    isController,
    isOrganizer,
    userRole,
    signOut,
    refreshRole,
  };

  return <SimpleAuthContext.Provider value={value}>{children}</SimpleAuthContext.Provider>;
}

export function useSimpleAuth() {
  const context = useContext(SimpleAuthContext);
  if (context === undefined) {
    throw new Error("useSimpleAuth must be used within SimpleAuthProvider");
  }
  return context;
}

export default SimpleAuthProvider;
