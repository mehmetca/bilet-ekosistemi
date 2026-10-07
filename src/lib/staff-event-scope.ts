import type { SupabaseClient } from "@supabase/supabase-js";
import type { StaffRole } from "@/lib/server-staff-auth";

/**
 * Personelin giriş işaretleyebileceği etkinlik kümesi.
 * `null` = sınırsız (admin). Boş dizi = hiçbir etkinlik (yetki yok).
 * Sorgu sayısı: admin 0, kontrolör/organizatör en fazla 2.
 */
export async function buildStaffAllowedEventIds(
  supabase: SupabaseClient,
  roles: readonly StaffRole[],
  userId: string
): Promise<string[] | null> {
  if (roles.includes("admin")) return null;

  const ids = new Set<string>();

  if (roles.includes("controller")) {
    const { data, error } = await supabase
      .from("controller_event_assignments")
      .select("event_id")
      .eq("controller_user_id", userId);
    if (error) {
      console.error("Controller assignment lookup failed:", error);
      return [];
    }
    for (const row of data || []) ids.add(row.event_id as string);
  }

  if (roles.includes("organizer")) {
    const { data, error } = await supabase
      .from("events")
      .select("id")
      .eq("created_by_user_id", userId);
    if (error) {
      console.error("Organizer event lookup failed:", error);
      return [];
    }
    for (const row of data || []) ids.add(row.id as string);
  }

  return [...ids];
}
