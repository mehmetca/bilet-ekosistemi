import { NextRequest, NextResponse } from "next/server";
import { checkTicket } from "@/app/kontrol/actions";
import { requireRole } from "@/lib/api-auth";

/**
 * Bilet kontrol API - MultiTicketScanner ve diğer istemciler için.
 * POST /api/check-ticket
 * Body: FormData with ticket_code
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireRole(request, ["admin", "controller", "organizer"]);
    if (auth instanceof NextResponse) return auth;

    const formData = await request.formData();
    const result = await checkTicket(formData);
    return NextResponse.json(result);
  } catch (error) {
    console.error("check-ticket API error:", error);
    return NextResponse.json(
      { valid: false, reason: "error", message: "Sunucu hatası" },
      { status: 500 }
    );
  }
}
