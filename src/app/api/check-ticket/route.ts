import { NextRequest, NextResponse } from "next/server";
import { checkTicketCore } from "@/app/kontrol/actions";
import { requireRole } from "@/lib/api-auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

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
    return NextResponse.json(result);
  } catch (error) {
    console.error("check-ticket API error:", error);
    return NextResponse.json(
      { valid: false, reason: "error", message: "Sunucu hatası" },
      { status: 500 }
    );
  }
}
