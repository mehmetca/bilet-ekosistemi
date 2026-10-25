import type { SupabaseClient, User } from "@supabase/supabase-js";

export type OrderAccessRow = {
  id: string;
  user_id?: string | null;
  buyer_email?: string | null;
  status?: string | null;
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
    .eq("role", "admin")
    .limit(1);

  return Boolean(adminRows && adminRows.length > 0);
}

export function isTicketIssuedOrder(status: string | null | undefined): boolean {
  return status === "confirmed" || status === "completed";
}
