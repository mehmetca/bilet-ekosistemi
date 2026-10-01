import { NextRequest, NextResponse } from "next/server";
import { checkTicketCore } from "@/app/kontrol/actions";
import { requireRole } from "@/lib/api-auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { checkControllerEventAccess } from "@/lib/controller-event-access";

/**
 * Bilet kontrol API - MultiTicketScanner ve diğer istemciler için.
 * POST /api/check-ticket
 * Body: FormData with ticket_code
 * Rate limit: IP başına dakikada 60 istek (kapı tarayıcıları için yüksek limit)
 */
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    if (!checkRateLimit(ip, { name: "check-ticket", windowMs: 60_000, max: 60 })) {
      return NextResponse.json(
        { valid: false, reason: "error", message: "Çok fazla istek. Lütfen bekleyin." },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }

    const auth = await requireRole(request, ["admin", "controller", "organizer"]);
    if (auth instanceof NextResponse) return auth;

    const formData = await request.formData();
    const result = await checkTicketCore(formData);
    if (auth.roles.includes("controller") && !auth.roles.includes("admin")) {
      if (!result.eventId && (result.valid || ("reason" in result && result.reason === "used"))) {
        return NextResponse.json(
          {
            valid: false,
            reason: "error",
            message: "Etkinlik yetkisi doğrulanamadı.",
          },
          { status: 403 }
        );
      }
      if (result.eventId) {
        const access = await checkControllerEventAccess(
          auth.supabase,
          auth.user.id,
          result.eventId
        );
        if ("reason" in access) {
          return NextResponse.json(
            {
              valid: false,
              reason: "error",
              message:
                access.reason === "unassigned"
                  ? "Bu etkinlik için kontrolör olarak görevlendirilmemişsiniz."
                  : "Etkinlik yetkiniz doğrulanamadı.",
            },
            { status: access.reason === "unassigned" ? 403 : 500 }
          );
        }
      }
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
