import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { buildStaffAllowedEventIds } from "@/lib/staff-event-scope";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { cancelInvoiceById } from "@/lib/invoice";
import type { StaffRole } from "@/lib/server-staff-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Storno: fatura satırı ve numarası silinmez (GoBD), yalnız durumu değişir.
 * POST /api/invoices/[id]/cancel/  { reason }
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireRole(request, ["admin", "organizer"]);
    if (auth instanceof NextResponse) return auth;

    const { id: invoiceId } = await context.params;
    if (!invoiceId) {
      return NextResponse.json({ success: false, message: "Fatura ID gerekli." }, { status: 400 });
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const reason = String(body.reason ?? "").trim().slice(0, 300);

    const admin = getSupabaseAdmin();
    const allowedEventIds = await buildStaffAllowedEventIds(
      admin,
      auth.roles as StaffRole[],
      auth.user.id
    );

    const result = await cancelInvoiceById(invoiceId, {
      reason,
      actorUserId: auth.user.id,
      allowedEventIds,
    });

    if (!result.ok || !result.row) {
      const status =
        result.code === "forbidden" ? 403 : result.code === "not_found" ? 404 : 400;
      return NextResponse.json(
        {
          success: false,
          code: result.code ?? "error",
          message: result.message ?? "Fatura iptal edilemedi.",
        },
        { status }
      );
    }

    return NextResponse.json({ success: true, invoice: result.row });
  } catch (error) {
    console.error("invoice cancel API error:", error);
    return NextResponse.json({ success: false, message: "Fatura iptal edilemedi." }, { status: 500 });
  }
}
