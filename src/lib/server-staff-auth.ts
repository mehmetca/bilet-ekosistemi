import { User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase-ssr";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const STAFF_ROLES = ["admin", "controller", "organizer"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export type StaffAuthResult =
  | { ok: true; user: User; roles: StaffRole[] }
  | { ok: false; reason: "unauthenticated" | "forbidden" };

async function loadStaffRoles(userId: string): Promise<StaffRole[]> {
  const supabase = getSupabaseAdmin();
  const { data: roleRows } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", [...STAFF_ROLES]);

  return [...new Set((roleRows || []).map((r) => r.role as StaffRole))];
}

/** Server action / RSC: çerez oturumundan personel rolü doğrular. */
export async function assertStaffFromCookies(): Promise<StaffAuthResult> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, reason: "unauthenticated" };

    const roles = await loadStaffRoles(user.id);
    if (roles.length === 0) return { ok: false, reason: "forbidden" };
    return { ok: true, user, roles };
  } catch {
    return { ok: false, reason: "unauthenticated" };
  }
}

/** API route: Bearer token ile personel rolü doğrular. */
export async function assertStaffFromAccessToken(
  accessToken: string | null | undefined
): Promise<StaffAuthResult> {
  const token = typeof accessToken === "string" ? accessToken.trim() : "";
  if (!token) return { ok: false, reason: "unauthenticated" };

  const supabase = getSupabaseAdmin();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  if (error || !user) return { ok: false, reason: "unauthenticated" };

  const roles = await loadStaffRoles(user.id);
  if (roles.length === 0) return { ok: false, reason: "forbidden" };
  return { ok: true, user, roles };
}
