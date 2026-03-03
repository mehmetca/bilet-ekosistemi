"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase-client";
import type { User } from "@supabase/supabase-js";

interface SimpleAuthType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  isController: boolean;
  userRole: "admin" | "controller" | null;
  signOut: () => Promise<void>;
  refreshRole: () => Promise<void>;
}

const SimpleAuthContext = createContext<SimpleAuthType | undefined>(undefined);

export function SimpleAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<"admin" | "controller" | null>(null);
  const userRef = useRef<User | null>(null);
  const userRoleRef = useRef<"admin" | "controller" | null>(null);
  const roleFetchInFlightForRef = useRef<string | null>(null);
  const lastAuthEventRef = useRef<{ key: string; at: number } | null>(null);

  const isAdmin = userRole === "admin";
  const isController = userRole === "controller";

  async function fetchUserRole(userId: string, force = false) {
    if (!force && roleFetchInFlightForRef.current === userId) {
      return userRoleRef.current;
    }
    if (!force && userRoleRef.current && userRef.current?.id === userId) {
      return userRoleRef.current;
    }

    try {
      roleFetchInFlightForRef.current = userId;
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

      const role = (data && data.length > 0) ? (data[0].role as "admin" | "controller") : null;
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

    const checkAuth = async () => {
      try {
        let data: { session: { user?: unknown; access_token?: string } | null };
        let error: { message?: string } | null;
        try {
          const result = await supabase.auth.getSession();
          data = result.data;
          error = result.error;
        } catch (supabaseErr) {
          console.error("Supabase auth init error:", supabaseErr);
          if (mounted) {
            setUser(null);
            setUserRole(null);
            setLoading(false);
          }
          return;
        }
        if (error) {
          console.error("Auth getSession error:", error);
          return;
        }

        const session = data?.session;
        
        if (mounted) {
          if (session?.user) {
            const u = session.user as User;
            setUser(u);
            userRef.current = u;
            await fetchUserRole(u.id, true);
          } else {
            setUser(null);
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

    let subscription: { unsubscribe?: () => void } | undefined;
    try {
      const { data: subData } = supabase.auth.onAuthStateChange(
        (event, session) => {
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
            setUserRole(null);
            userRef.current = null;
            userRoleRef.current = null;
            setLoading(false);
          } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED" || event === "INITIAL_SESSION") {
            if (session?.user) {
              const userChanged = userRef.current?.id !== session.user.id;
              setUser(session.user);
              userRef.current = session.user;

              const needRole = event === "SIGNED_IN" || event === "USER_UPDATED" || userChanged || event === "INITIAL_SESSION";
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
              setUserRole(null);
              userRef.current = null;
              userRoleRef.current = null;
            }
            setLoading(false);
          }
        }
      );
      subscription = subData?.subscription;
    } catch (subErr) {
      console.error("Auth subscription error:", subErr);
    }

    return () => {
      mounted = false;
      subscription?.unsubscribe?.();
    };
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    setUserRole(null);
  }

  async function refreshRole() {
    if (user) {
      await fetchUserRole(user.id);
    }
  }

  const value: SimpleAuthType = {
    user,
    loading,
    isAdmin,
    isController,
    userRole,
    signOut,
    refreshRole,
  };

  return (
    <SimpleAuthContext.Provider value={value}>
      {children}
    </SimpleAuthContext.Provider>
  );
}

export function useSimpleAuth() {
  const context = useContext(SimpleAuthContext);
  if (context === undefined) {
    throw new Error("useSimpleAuth must be used within SimpleAuthProvider");
  }
  return context;
}

export default SimpleAuthProvider;
