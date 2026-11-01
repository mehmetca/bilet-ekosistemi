import type { SupabaseClient, User } from "@supabase/supabase-js";
import { buildStaffAllowedEventIds } from "@/lib/staff-event-scope";
import type { StaffRole } from "@/lib/server-staff-auth";

export type OrderAccessRow = {
  id: string;
  user_id?: string | null;
  buyer_email?: string | null;
  status?: string | null;
  event_id?: string | null;
  sales_channel?: string | null;
  sold_by?: string | null;
};

/** Admin her siparişe, kullanıcı yalnız kendi (veya kendi e-postasına kesilmiş) siparişine erişir. */
export async function canAccessOrder(
  supabase: SupabaseClient,
  user: User,
  order: OrderAccessRow
): Promise<boolean> {
  if (order.user_id && order.user_id === user.id) return true;

  const emailMatches =
    !order.user_id &&
    Boolean(order.buyer_email) &&
    order.buyer_email!.toLowerCase() === (user.email || "").toLowerCase();
  if (emailMatches) return true;

  const { data: adminRows } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .limit(100);

  const roles = [...new Set((adminRows || []).map((row) => row.role as string))];
  if (roles.includes("admin")) return true;

  // Kapı satışı müşterisizdir: bileti kesen görevli ve aynı etkinlikte görevli
  // gişe/organizatör bilet yazdırabilmeli (okuma; iptal ayrı, daha sıkı kapıda).
  if (
    order.sales_channel === "door" &&
    (roles.includes("gate_sales") || roles.includes("organizer"))
  ) {
    if (order.sold_by && order.sold_by === user.id) return true;
    const allowedEventIds = await buildStaffAllowedEventIds(
      supabase,
      roles as StaffRole[],
      user.id
    );
    if (allowedEventIds !== null && order.event_id && allowedEventIds.includes(order.event_id)) {
      return true;
    }
  }

  return false;
}

export function isTicketIssuedOrder(status: string | null | undefined): boolean {
  return status === "confirmed" || status === "completed";
}
