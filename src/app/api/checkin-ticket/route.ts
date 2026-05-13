import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient, User } from "@supabase/supabase-js";
import { requireRole } from "@/lib/api-auth";
import { extractTicketCode } from "@/lib/ticket-code";

type CheckinAuth = {
  user: User;
  roles: string[];
};

async function requireCheckinScope(
  supabase: SupabaseClient,
  auth: CheckinAuth,
  eventCreatorId: string | null
): Promise<NextResponse | null> {
  if (auth.roles.includes("admin")) return null;

  if (auth.roles.includes("controller")) {
    const { data: assignments, error } = await supabase
      .from("organizer_controllers")
      .select("organizer_user_id")
      .eq("controller_user_id", auth.user.id);

    if (error) {
      console.error("checkin-ticket controller assignment error:", {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      return NextResponse.json(
        {
          success: false,
          message: "Yetki kapsamı doğrulanamadı.",
        },
        { status: 500 }
      );
    }

    const allowedOrganizerIds = new Set(
      (assignments || [])
        .map((assignment) => assignment.organizer_user_id as string | null)
        .filter((id): id is string => Boolean(id))
    );

    // Migration 067: atanmamış kontrolör (tabloda satır yok) tüm etkinliklerde check-in yapabilir.
    if (allowedOrganizerIds.size === 0) {
      return null;
    }

    if (!eventCreatorId || !allowedOrganizerIds.has(eventCreatorId)) {
      return NextResponse.json(
        { success: false, message: "Bu etkinliğe check-in yetkiniz yok." },
        { status: 403 }
      );
    }

    return null;
  }

  if (auth.roles.includes("organizer")) {
    if (eventCreatorId !== auth.user.id) {
      return NextResponse.json(
        { success: false, message: "Bu etkinliğe check-in yetkiniz yok." },
        { status: 403 }
      );
    }
    return null;
  }

  return NextResponse.json(
    { success: false, message: "Bu işlem için yetkiniz yok." },
    { status: 403 }
  );
}

function isCheckinEligibleStatus(status: string | undefined): boolean {
  return status === "confirmed" || status === "completed";
}

/**
 * Check-in API: Bilet girişini işaretler (orders.checked_at).
 * Sadece admin, controller veya organizatör. Organizatör sadece kendi etkinliğine ait biletleri işaretleyebilir.
 * POST /api/checkin-ticket
 * Body: JSON { ticket_code: string } veya FormData ticket_code
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireRole(request, ["admin", "controller", "organizer"]);
    if (auth instanceof NextResponse) return auth;

    let ticketCode: string;
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const body = await request.json();
      ticketCode = extractTicketCode(String(body?.ticket_code ?? ""));
    } else {
      const formData = await request.formData();
      ticketCode = extractTicketCode(String(formData.get("ticket_code") ?? ""));
    }

    if (!ticketCode) {
      return NextResponse.json(
        { success: false, message: "Bilet kodu zorunludur." },
        { status: 400 }
      );
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return NextResponse.json(
        { success: false, message: "Sunucu yapılandırması eksik." },
        { status: 500 }
      );
    }

    const supabase = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Önce adet-bazlı bilet birimi (koltuksuz çoklu alım) kontrolü
    const { data: ticketUnit, error: unitFetchError } = await supabase
      .from("order_ticket_units")
      .select("id, order_id, checked_at")
      .ilike("ticket_code", ticketCode)
      .maybeSingle();

    if (!unitFetchError && ticketUnit) {
      if (ticketUnit.checked_at) {
        return NextResponse.json(
          { success: false, message: "Bu bilet daha önce giriş yapılmış." },
          { status: 400 }
        );
      }

      const { data: parentOrder, error: parentOrderError } = await supabase
        .from("orders")
        .select("id, event_id, status, events(created_by_user_id)")
        .eq("id", ticketUnit.order_id)
        .maybeSingle();

      if (parentOrderError) {
        console.error("checkin-ticket ticket_unit parent fetch error:", parentOrderError);
        return NextResponse.json(
          { success: false, message: "Bilet sorgulanamadı." },
          { status: 500 }
        );
      }

      if (!parentOrder) {
        return NextResponse.json(
          { success: false, message: "Bilet bulunamadı." },
          { status: 404 }
        );
      }

      if (!isCheckinEligibleStatus(parentOrder.status as string | undefined)) {
        return NextResponse.json(
          { success: false, message: "Bilet onaylanmamış; check-in yapılamaz." },
          { status: 400 }
        );
      }

      const parentEvent = parentOrder.events as { created_by_user_id?: string } | null;
      const scopeError = await requireCheckinScope(
        supabase,
        auth,
        parentEvent?.created_by_user_id ?? null
      );
      if (scopeError) return scopeError;

      const { error: unitUpdateError } = await supabase
        .from("order_ticket_units")
        .update({ checked_at: new Date().toISOString() })
        .eq("id", ticketUnit.id);
      if (unitUpdateError) {
        console.error("checkin-ticket ticket_unit update error:", unitUpdateError);
        return NextResponse.json(
          { success: false, message: "Giriş işaretlenemedi." },
          { status: 500 }
        );
      }
      return NextResponse.json({
        success: true,
        message: "Giriş işaretlendi.",
      });
    }

    // Önce koltuk bazlı bilet kodunu kontrol et (order_seats) – her koltuk ayrı kod
    const { data: orderSeat, error: seatFetchError } = await supabase
      .from("order_seats")
      .select("id, order_id, checked_at")
      .ilike("ticket_code", ticketCode)
      .maybeSingle();

    if (!seatFetchError && orderSeat) {
      if (orderSeat.checked_at) {
        return NextResponse.json(
          { success: false, message: "Bu bilet daha önce giriş yapılmış." },
          { status: 400 }
        );
      }
      const { data: parentOrder, error: parentOrderError } = await supabase
        .from("orders")
        .select("id, event_id, status, events(created_by_user_id)")
        .eq("id", orderSeat.order_id)
        .maybeSingle();

      if (parentOrderError) {
        console.error("checkin-ticket order_seats parent fetch error:", parentOrderError);
        return NextResponse.json(
          { success: false, message: "Bilet sorgulanamadı." },
          { status: 500 }
        );
      }

      if (!parentOrder) {
        return NextResponse.json(
          { success: false, message: "Bilet bulunamadı." },
          { status: 404 }
        );
      }

      if (!isCheckinEligibleStatus(parentOrder.status as string | undefined)) {
        return NextResponse.json(
          { success: false, message: "Bilet onaylanmamış; check-in yapılamaz." },
          { status: 400 }
        );
      }

      const parentEvent = parentOrder.events as { created_by_user_id?: string } | null;
      const scopeError = await requireCheckinScope(
        supabase,
        auth,
        parentEvent?.created_by_user_id ?? null
      );
      if (scopeError) return scopeError;

      const { error: seatUpdateError } = await supabase
        .from("order_seats")
        .update({ checked_at: new Date().toISOString() })
        .eq("id", orderSeat.id);
      if (seatUpdateError) {
        console.error("checkin-ticket order_seats update error:", seatUpdateError);
        return NextResponse.json(
          { success: false, message: "Giriş işaretlenemedi." },
          { status: 500 }
        );
      }
      return NextResponse.json({
        success: true,
        message: "Giriş işaretlendi.",
      });
    }

    // Koltuk/tekil birim kodu yoksa sipariş bazlı kodu dene (yalnızca legacy tek bilet)
    const { data: order, error: fetchError } = await supabase
      .from("orders")
      .select("id, event_id, checked_at, status, events(created_by_user_id)")
      .ilike("ticket_code", ticketCode)
      .maybeSingle();

    if (fetchError) {
      console.error("checkin-ticket fetch error:", fetchError);
      return NextResponse.json(
        { success: false, message: "Bilet sorgulanamadı." },
        { status: 500 }
      );
    }

    if (!order) {
      return NextResponse.json(
        { success: false, message: "Bilet bulunamadı." },
        { status: 404 }
      );
    }

    const [{ data: linkedSeats }, { data: linkedUnits }] = await Promise.all([
      supabase.from("order_seats").select("id").eq("order_id", order.id).limit(1),
      supabase.from("order_ticket_units").select("id").eq("order_id", order.id).limit(1),
    ]);
    if ((linkedSeats && linkedSeats.length > 0) || (linkedUnits && linkedUnits.length > 0)) {
      return NextResponse.json(
        { success: false, message: "Bu siparişte her bilet için ayrı kod var. Lütfen tekil bilet kodunu okutun." },
        { status: 400 }
      );
    }

    if (order.checked_at) {
      return NextResponse.json(
        { success: false, message: "Bu bilet daha önce giriş yapılmış." },
        { status: 400 }
      );
    }

    const status = order.status as string | undefined;
    if (!isCheckinEligibleStatus(status)) {
      return NextResponse.json(
        { success: false, message: "Bilet onaylanmamış; check-in yapılamaz." },
        { status: 400 }
      );
    }

    const event = order.events as { created_by_user_id?: string } | null;
    const eventCreatorId = event?.created_by_user_id ?? null;
    const scopeError = await requireCheckinScope(supabase, auth, eventCreatorId);
    if (scopeError) return scopeError;

    const { error: updateError } = await supabase
      .from("orders")
      .update({ checked_at: new Date().toISOString() })
      .eq("id", order.id);

    if (updateError) {
      console.error("checkin-ticket update error:", updateError);
      return NextResponse.json(
        { success: false, message: "Giriş işaretlenemedi." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Giriş işaretlendi.",
    });
  } catch (error) {
    console.error("checkin-ticket API error:", error);
    return NextResponse.json(
      { success: false, message: "Sunucu hatası." },
      { status: 500 }
    );
  }
}
