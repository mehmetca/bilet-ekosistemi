import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { checkTicketCore } from "@/app/kontrol/actions";
import { requireRole } from "@/lib/api-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { buildStaffAllowedEventIds } from "@/lib/staff-event-scope";
import type { StaffRole } from "@/lib/server-staff-auth";

/**
 * Bilet kontrol API (salt okuma; giriş işaretlemez).
 * POST /api/check-ticket
 * Body: FormData ile ticket_code
 * Rate limit: personelin kullanıcı kimliği başına dakikada 600 istek.
 * Kimlik doğrulanamadığında istek zaten 401/403 ile döner; kota tüketilmez.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireRole(request, ["admin", "controller", "organizer"]);
    if (auth instanceof NextResponse) return auth;

    const limiterKey = `user:${auth.user.id}`;
    if (
      !checkRateLimit(limiterKey, { name: "check-ticket", windowMs: 60_000, max: 600 })
    ) {
      return NextResponse.json(
        { valid: false, reason: "error", message: "Çok fazla istek. Lütfen bekleyin." },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }

    const formData = await request.formData();
    const allowedEventIds = await buildStaffAllowedEventIds(
      getSupabaseAdmin(),
      auth.roles as StaffRole[],
      auth.user.id
    );

    const result = await checkTicketCore(formData, {
      actorUserId: auth.user.id,
      allowedEventIds,
    });

    if (
      allowedEventIds !== null &&
      result.eventId &&
      !allowedEventIds.includes(result.eventId)
    ) {
      return NextResponse.json(
        {
          valid: false,
          reason: "error",
          message:
            "Bu etkinlik için kontrolör olarak görevlendirilmemişsiniz.",
        },
        { status: 403 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("check-ticket API error:", error);
    return NextResponse.json(
      { valid: false, reason: "error", message: "Sunucu hatası" },
      { status: 500 }
    );
  }
}
