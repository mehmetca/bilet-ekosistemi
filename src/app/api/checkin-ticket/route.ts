import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireRole } from "@/lib/api-auth";
import { extractTicketCode } from "@/lib/ticket-code";

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

    // Koltuk kodu yoksa sipariş bazlı kodu dene (eski tek bilet / yer seçilmeyen)
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

    if (order.checked_at) {
      return NextResponse.json(
        { success: false, message: "Bu bilet daha önce giriş yapılmış." },
        { status: 400 }
      );
    }

    const status = order.status as string | undefined;
    if (status !== "confirmed" && status !== "completed") {
      return NextResponse.json(
        { success: false, message: "Bilet onaylanmamış; check-in yapılamaz." },
        { status: 400 }
      );
    }

    const isAdmin = auth.roles.includes("admin");
    const isController = auth.roles.includes("controller");
    const isOrganizer = auth.roles.includes("organizer");
    const event = order.events as { created_by_user_id?: string } | null;
    const eventCreatorId = event?.created_by_user_id ?? null;

    if (isAdmin) {
      // Admin: tüm etkinliklerde check-in
    } else if (isController) {
      const { data: assignment } = await supabase
        .from("organizer_controllers")
        .select("organizer_user_id")
        .eq("controller_user_id", auth.user.id)
        .maybeSingle();
      if (assignment?.organizer_user_id != null && eventCreatorId !== assignment.organizer_user_id) {
        return NextResponse.json(
          { success: false, message: "Bu etkinliğe check-in yetkiniz yok." },
          { status: 403 }
        );
      }
    } else if (isOrganizer) {
      if (eventCreatorId !== auth.user.id) {
        return NextResponse.json(
          { success: false, message: "Bu etkinliğe check-in yetkiniz yok." },
          { status: 403 }
        );
      }
    } else {
      return NextResponse.json(
        { success: false, message: "Bu işlem için yetkiniz yok." },
        { status: 403 }
      );
    }

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
