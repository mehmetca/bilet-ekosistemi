import { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllSeatsByRowIds } from "@/lib/fetch-all-seats-by-row-ids";
import { resolveTicketForPlanRow, type TicketLike } from "@/lib/ticket-seating-match";

export type DoorSeatStatus = "free" | "sold" | "held" | "blocked";

export type HallRow = {
  id: string;
  section_id: string;
  row_label: string;
  sort_order: number;
  ticket_id: string | null;
};

export type HallSeat = { id: string; row_id: string; seat_label: string; status: DoorSeatStatus };

export type HallSectionMeta = {
  id: string;
  name: string;
  sort_order: number;
  section_align: string | null;
};

export type HallBase = {
  sections: HallSectionMeta[];
  rows: HallRow[];
  seats: HallSeat[];
  freeIds: Set<string>;
};

export type DoorSeatUniverse = {
  sections: HallSectionMeta[];
  rows: HallRow[];
  seats: HallSeat[];
  availableIds: Set<string>;
};

const seatNumber = (label: string) => parseInt(label, 10);

/**
 * Salonın tamamı: her sıranın çözümlendiği bilet türü ve tüm koltukların
 * satılmış / sepette ayrılmış / satışa kapalı / boş durumu.
 * Eski hata: bölüm adı "Balkon Sol" tüm balkon sıralarını (VIP+normal) açıyordu.
 */
export async function loadHallBase(
  supabase: SupabaseClient,
  eventId: string,
  seatingPlanId: string,
  ticketsForMatch: TicketLike[],
  onlyTicketId?: string
): Promise<HallBase | null> {
  const { data: allSections } = await supabase
    .from("seating_plan_sections")
    .select("id, name, sort_order, ticket_type_label, section_align")
    .eq("seating_plan_id", seatingPlanId)
    .order("sort_order", { ascending: true });

  if (!allSections?.length) return null;

  const sectionById = new Map(
    allSections.map((s) => [
      s.id,
      {
        id: s.id,
        name: String(s.name || ""),
        sort_order: (s as { sort_order?: number }).sort_order ?? 0,
        ticket_type_label: String((s as { ticket_type_label?: string | null }).ticket_type_label || ""),
        section_align:
          (s as { section_align?: string | null }).section_align === "left" ||
          (s as { section_align?: string | null }).section_align === "right" ||
          (s as { section_align?: string | null }).section_align === "center"
            ? String((s as { section_align: string }).section_align)
            : null,
      },
    ])
  );

  const { data: allRows } = await supabase
    .from("seating_plan_rows")
    .select("id, section_id, row_label, sort_order, ticket_type_label")
    .in(
      "section_id",
      allSections.map((s) => s.id)
    )
    .order("sort_order", { ascending: true });

  if (!allRows?.length) return null;

  const rows: HallRow[] = allRows.map((r) => {
    const sec = sectionById.get(String((r as { section_id: string }).section_id));
    const resolved = sec
      ? resolveTicketForPlanRow(
          {
            sectionName: sec.name,
            sectionTicketTypeLabel: sec.ticket_type_label,
            rowTicketTypeLabel: String((r as { ticket_type_label?: string | null }).ticket_type_label || ""),
          },
          ticketsForMatch
        )
      : null;
    return {
      id: r.id,
      section_id: String((r as { section_id: string }).section_id),
      row_label: String((r as { row_label?: string }).row_label || ""),
      sort_order: (r as { sort_order?: number }).sort_order ?? 0,
      ticket_id: resolved?.id ? String(resolved.id) : null,
    };
  });

  const sectionOrder = new Map(
    [...sectionById.values()].map((s) => [s.id, s.sort_order] as const)
  );
  // Tek türe daraltıldığında koltuklar yalnız o sıralardan çekilir (kalabalık salonlarda sorgu hacmi).
  const limitedRows = onlyTicketId
    ? rows.filter((r) => r.ticket_id === String(onlyTicketId))
    : rows;
  if (!limitedRows.length) return null;
  const rowById = new Map(limitedRows.map((r) => [r.id, r] as const));

  let seats: { id: string; row_id: string; seat_label: string; sales_blocked?: boolean | null }[];
  try {
    seats = await fetchAllSeatsByRowIds(
      supabase,
      limitedRows.map((r) => r.id),
      "id, row_id, seat_label, sales_blocked"
    );
  } catch {
    return null;
  }
  if (!seats.length) return null;

  const soldSet = new Set<string>();
  const { data: completedOrders } = await supabase
    .from("orders")
    .select("id")
    .eq("event_id", eventId)
    .eq("status", "completed");
  if (completedOrders?.length) {
    const { data: orderSeats } = await supabase
      .from("order_seats")
      .select("seat_id")
      .in(
        "order_id",
        completedOrders.map((o: { id: string }) => o.id)
      );
    (orderSeats || []).forEach((s: { seat_id: string }) => soldSet.add(s.seat_id));
  }

  // Aktif hold'lu koltukları satıştan çıkar (başkasının sepetindeki koltuğu çalma)
  const heldSet = new Set<string>();
  const nowIso = new Date().toISOString();
  const { data: activeHolds } = await supabase
    .from("seat_holds")
    .select("seat_id")
    .eq("event_id", eventId)
    .gt("held_until", nowIso);
  (activeHolds || []).forEach((h: { seat_id: string }) => heldSet.add(h.seat_id));

  const orderedSeats: HallSeat[] = seats
    .filter((s) => rowById.has(s.row_id))
    .map((s) => ({
      id: s.id,
      row_id: s.row_id,
      seat_label: String(s.seat_label || ""),
      status: (s.sales_blocked
        ? "blocked"
        : soldSet.has(s.id)
          ? "sold"
          : heldSet.has(s.id)
            ? "held"
            : "free") as DoorSeatStatus,
    }))
    .sort((a, b) => {
      const rowA = rowById.get(a.row_id)!;
      const rowB = rowById.get(b.row_id)!;
      const secA = sectionOrder.get(rowA.section_id) ?? 0;
      const secB = sectionOrder.get(rowB.section_id) ?? 0;
      if (secA !== secB) return secA - secB;
      if (rowA.sort_order !== rowB.sort_order) return rowA.sort_order - rowB.sort_order;
      const na = seatNumber(a.seat_label);
      const nb = seatNumber(b.seat_label);
      if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
      return a.seat_label.localeCompare(b.seat_label);
    });

  return {
    sections: [...sectionById.values()].sort((a, b) => a.sort_order - b.sort_order),
    rows: [...limitedRows].sort((a, b) => {
      const secA = sectionOrder.get(a.section_id) ?? 0;
      const secB = sectionOrder.get(b.section_id) ?? 0;
      if (secA !== secB) return secA - secB;
      return a.sort_order - b.sort_order;
    }),
    seats: orderedSeats,
    freeIds: new Set(orderedSeats.filter((s) => s.status === "free").map((s) => s.id)),
  };
}

/** Yalnızca verilen bilet türüne çözümlenen sıralar ve onların koltukları. */
export async function loadDoorSeatUniverse(
  supabase: SupabaseClient,
  eventId: string,
  seatingPlanId: string,
  ticketId: string,
  ticketTypeName: string,
  catalogTickets: TicketLike[]
): Promise<DoorSeatUniverse | null> {
  const targetTicketId = String(ticketId || "").trim();
  if (!targetTicketId) return null;

  const ticketsForMatch: TicketLike[] =
    catalogTickets.length > 0 ? catalogTickets : [{ id: targetTicketId, name: ticketTypeName }];

  const base = await loadHallBase(
    supabase,
    eventId,
    seatingPlanId,
    ticketsForMatch,
    targetTicketId
  );
  if (!base) return null;

  return {
    sections: base.sections.filter((s) => base.rows.some((r) => r.section_id === s.id)),
    rows: base.rows,
    seats: base.seats,
    availableIds: base.freeIds,
  };
}

/**
 * Bilet türünün müsait sıralarından en iyi yan yana N koltuğu döner.
 * Koltuk elle seçilmediğinde gişe ve çevrimiçi satış bu atamayı kullanır.
 */
export async function assignBestAvailableSeats(
  supabase: SupabaseClient,
  eventId: string,
  seatingPlanId: string,
  ticketId: string,
  ticketTypeName: string,
  quantity: number,
  catalogTickets: TicketLike[]
): Promise<string[]> {
  const universe = await loadDoorSeatUniverse(
    supabase,
    eventId,
    seatingPlanId,
    ticketId,
    ticketTypeName,
    catalogTickets
  );
  if (!universe) return [];

  const sectionSortById = new Map(universe.sections.map((s) => [s.id, s.sort_order] as const));
  const rowById = new Map(universe.rows.map((r) => [r.id, r] as const));

  type SeatInfo = {
    id: string;
    row_id: string;
    seat_label: string;
    section_sort: number;
    row_sort: number;
  };
  const available: SeatInfo[] = universe.seats
    .filter((s) => universe.availableIds.has(s.id))
    .map((s) => {
      const row = rowById.get(s.row_id);
      return {
        id: s.id,
        row_id: s.row_id,
        seat_label: s.seat_label,
        section_sort: row ? (sectionSortById.get(row.section_id) ?? 0) : 0,
        row_sort: row?.sort_order ?? 0,
      };
    });
  available.sort((a, b) => {
    if (a.section_sort !== b.section_sort) return a.section_sort - b.section_sort;
    if (a.row_sort !== b.row_sort) return a.row_sort - b.row_sort;
    const na = seatNumber(a.seat_label);
    const nb = seatNumber(b.seat_label);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
    return a.seat_label.localeCompare(b.seat_label);
  });

  const byRow = new Map<string, SeatInfo[]>();
  for (const s of available) {
    const list = byRow.get(s.row_id) || [];
    list.push(s);
    byRow.set(s.row_id, list);
  }

  for (const list of byRow.values()) {
    if (list.length < quantity) continue;
    for (let i = 0; i <= list.length - quantity; i++) {
      const slice = list.slice(i, i + quantity);
      const consecutive = slice.every((s, j) => {
        if (j === 0) return true;
        const prev = seatNumber(slice[j - 1]!.seat_label);
        const curr = seatNumber(s.seat_label);
        if (!Number.isNaN(prev) && !Number.isNaN(curr)) return curr === prev + 1;
        return true;
      });
      if (consecutive) return slice.map((s) => s.id);
    }
  }

  return available.slice(0, quantity).map((s) => s.id);
}
