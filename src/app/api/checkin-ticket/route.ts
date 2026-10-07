import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireRole } from "@/lib/api-auth";
import { extractTicketCode } from "@/lib/ticket-code";
import { checkTicketCore } from "@/app/kontrol/actions";
import { buildStaffAllowedEventIds } from "@/lib/staff-event-scope";
import type { StaffRole } from "@/lib/server-staff-auth";

/**
 * Check-in API: Bilet girişini işaretler (checked_at) — tek RPC turu.
 * Sadece admin, controller veya organizatör. Organizatör sadece kendi etkinliğine ait
 * biletleri, kontrolör yalnız kendisine görevlendirilmiş etkinliklerin biletlerini işaretleyebilir.
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

    const allowedEventIds = await buildStaffAllowedEventIds(
      getSupabaseAdmin(),
      auth.roles as StaffRole[],
      auth.user.id
    );

    const result = await checkTicketCore(ticketCode, {
      mark: true,
      actorUserId: auth.user.id,
      allowedEventIds,
    });

    if (result.valid) {
      if (!result.marked) {
        return NextResponse.json(
          { success: false, message: "Bu etkinliğe check-in yetkiniz yok." },
          { status: 403 }
        );
      }
      return NextResponse.json({ success: true, message: "Giriş işaretlendi." });
    }

    const status =
      result.reason === "not_found"
        ? 404
        : result.reason === "error"
          ? 500
          : 400;

    return NextResponse.json(
      {
        success: false,
        message:
          result.message ||
          (result.reason === "not_found"
            ? "Bilet bulunamadı."
            : result.reason === "used"
              ? "Bu bilet daha önce giriş yapılmış."
              : "Giriş işaretlenemedi."),
      },
      { status }
    );
  } catch (error) {
    console.error("checkin-ticket API error:", error);
    return NextResponse.json(
      { success: false, message: "Sunucu hatası." },
      { status: 500 }
    );
  }
}
