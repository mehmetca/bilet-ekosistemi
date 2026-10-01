import type { SupabaseClient } from "@supabase/supabase-js";

export type ControllerEventAccessResult =
  | { allowed: true }
  | { allowed: false; reason: "unassigned" | "error" };

export async function checkControllerEventAccess(
  supabase: SupabaseClient,
  controllerUserId: string,
  eventId: string | null | undefined
): Promise<ControllerEventAccessResult> {
  if (!eventId) return { allowed: false, reason: "unassigned" };

  const { data, error } = await supabase
    .from("controller_event_assignments")
    .select("event_id")
    .eq("controller_user_id", controllerUserId)
    .eq("event_id", eventId)
    .maybeSingle();

  if (error) {
    console.error("Controller event access lookup failed:", error);
    return { allowed: false, reason: "error" };
  }

  return data ? { allowed: true } : { allowed: false, reason: "unassigned" };
}