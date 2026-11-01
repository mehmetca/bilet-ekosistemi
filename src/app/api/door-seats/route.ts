import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { buildStaffAllowedEventIds } from "@/lib/staff-event-scope";
import { loadHallBase } from "@/lib/door-seat-assign";
import type { TicketLike } from "@/lib/ticket-seating-match";
import type { StaffRole } from "@/lib/server-staff-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Gişede elle koltuk seçimi: salonun tüm sıraları ve koltuk durumları,
 * her sıranın çözümlendiği bilet türü ile birlikte. Kategori, seçilen koltuktan türer.
 * GET /api/door-seats?event_id=<uuid>
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireRole(request, ["admin", "organizer", "gate_sales"]);
    if (auth instanceof NextResponse) return auth;

    const eventId = request.nextUrl.searchParams.get("event_id")?.trim() || "";
    if (!eventId) {
      return NextResponse.json({ success: false, message: "Etkinlik gerekli." }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const allowedEventIds = await buildStaffAllowedEventIds(
      admin,
      auth.roles as StaffRole[],
      auth.user.id
    );
    if (allowedEventIds !== null && !allowedEventIds.includes(eventId)) {
      return NextResponse.json(
        { success: false, message: "Bu etkinliğin salon planı size açık değil." },
        { status: 403 }
      );
    }

    const { data: eventRow } = await admin
      .from("events")
      .select("id, seating_plan_id")
      .eq("id", eventId)
      .single();
    const seatingPlanId = (eventRow as { seating_plan_id?: string | null } | null)?.seating_plan_id;
    if (!seatingPlanId) {
      return NextResponse.json({ success: true, hasPlan: false, sections: [] });
    }

    const { data: catalogRows } = await admin
      .from("tickets")
      .select("id, name, price, available")
      .eq("event_id", eventId);
    const catalogTickets: TicketLike[] = (catalogRows || []).map((t) => ({
      id: String((t as { id: string }).id),
      name: String((t as { name?: string }).name || ""),
      price: Number((t as { price?: number }).price) || 0,
      available: Number((t as { available?: number }).available) || 0,
    }));

    const base = await loadHallBase(admin, eventId, seatingPlanId, catalogTickets);
    if (!base) {
      return NextResponse.json({ success: true, hasPlan: true, sections: [] });
    }

    const ticketById = new Map(
      catalogTickets.map((t) => [t.id, { name: t.name, price: t.price }] as const)
    );

    type UiRow = {
      id: string;
      row_label: string;
      ticket_id: string | null;
      ticket_name: string | null;
      price: number | null;
      seats: { id: string; seat_label: string; status: string }[];
    };
    const rowsBySection = new Map<string, UiRow[]>();
    const uiRowById = new Map<string, UiRow>();
    for (const row of base.rows) {
      const matched = row.ticket_id ? ticketById.get(row.ticket_id) : undefined;
      const uiRow: UiRow = {
        id: row.id,
        row_label: row.row_label,
        ticket_id: row.ticket_id,
        ticket_name: matched?.name ?? null,
        price: matched ? matched.price : null,
        seats: [],
      };
      const list = rowsBySection.get(row.section_id) || [];
      list.push(uiRow);
      rowsBySection.set(row.section_id, list);
      uiRowById.set(row.id, uiRow);
    }
    for (const seat of base.seats) {
      uiRowById.get(seat.row_id)?.seats.push({
        id: seat.id,
        seat_label: seat.seat_label,
        status: seat.status,
      });
    }

    // Sıra/koltuk düzeni yükleyici sırasından gelir: sort_order, sonra koltuk numarası.
    const sections = base.sections
      .filter((s) => (rowsBySection.get(s.id)?.length ?? 0) > 0)
      .map((s) => ({
        id: s.id,
        name: s.name,
        section_align: s.section_align,
        rows: rowsBySection.get(s.id) || [],
      }));

    const freeSeats = base.seats.filter((s) => s.status === "free").length;
    return NextResponse.json({ success: true, hasPlan: true, freeSeats, sections });
  } catch (error) {
    console.error("[door-seats] beklenmeyen hata:", error);
    return NextResponse.json({ success: false, message: "Salon planı okunamadı." }, { status: 500 });
  }
}
