import { supabase } from "@/lib/supabase-client";

export type UserOrderSeatDetail = {
  section_name: string;
  row_label: string;
  seat_label: string;
  ticket_code?: string;
};

export type UserOrderRow = {
  id: string;
  event_id: string;
  ticket_id: string | null;
  quantity: number;
  total_price: number;
  status: string;
  created_at: string;
  ticket_code?: string;
  buyer_name?: string;
  events?: {
    title?: string;
    date?: string;
    time?: string;
    venue?: string;
    location?: string;
    currency?: string;
  } | null;
  tickets?: { name?: string; type?: string; price?: number } | null;
  seatDetails?: UserOrderSeatDetail[];
  ticketCodes?: string[];
};

const SELECT_FIELDS = `
  id, event_id, ticket_id, quantity, total_price, status, created_at,
  ticket_code, buyer_name,
  events (title, date, time, venue, location, currency)
`;

/**
 * Oturum açmış kullanıcının siparişleri — RLS filtreler (user_id + buyer_email).
 * Vercel API route yerine tarayıcıdan doğrudan Supabase.
 */
export async function fetchUserOrders(): Promise<UserOrderRow[]> {
  const { data: rows, error } = await supabase
    .from("orders")
    .select(SELECT_FIELDS)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const merged = (rows || []) as UserOrderRow[];

  const ticketIds = Array.from(
    new Set(merged.map((o) => o.ticket_id).filter((id): id is string => !!id))
  );
  let ticketMap = new Map<string, { name?: string; type?: string; price?: number }>();
  if (ticketIds.length > 0) {
    const { data: ticketRows, error: ticketErr } = await supabase
      .from("tickets")
      .select("id, name, type, price")
      .in("id", ticketIds);
    if (!ticketErr && ticketRows) {
      ticketMap = new Map(
        ticketRows.map((row) => [row.id, { name: row.name, type: row.type, price: row.price }])
      );
    }
  }
  for (const o of merged) {
    o.tickets = o.ticket_id ? ticketMap.get(o.ticket_id) ?? null : null;
  }

  const ids = merged.map((o) => o.id).filter(Boolean);
  if (ids.length > 0) {
    const { data: seatsRows } = await supabase
      .from("order_seats")
      .select("order_id, section_name, row_label, seat_label, ticket_code")
      .in("order_id", ids);

    const seatsByOrder = new Map<string, UserOrderSeatDetail[]>();
    for (const row of seatsRows || []) {
      const list = seatsByOrder.get(row.order_id) || [];
      list.push({
        section_name: row.section_name ?? "",
        row_label: row.row_label ?? "",
        seat_label: row.seat_label ?? "",
        ticket_code: row.ticket_code ?? undefined,
      });
      seatsByOrder.set(row.order_id, list);
    }
    for (const o of merged) {
      o.seatDetails = seatsByOrder.get(o.id) || undefined;
    }

    const { data: unitRows, error: unitsErr } = await supabase
      .from("order_ticket_units")
      .select("order_id, ticket_code, created_at")
      .in("order_id", ids)
      .order("created_at", { ascending: true });

    if (!unitsErr) {
      const unitsByOrder = new Map<string, string[]>();
      for (const row of unitRows || []) {
        const list = unitsByOrder.get(row.order_id) || [];
        const code = String(row.ticket_code || "").trim();
        if (code.length > 0) list.push(code);
        unitsByOrder.set(row.order_id, list);
      }
      for (const o of merged) {
        const codes = unitsByOrder.get(o.id) || [];
        o.ticketCodes = codes.length > 0 ? codes : undefined;
      }
    }
  }

  return merged;
}
