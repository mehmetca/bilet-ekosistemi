import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { buildStaffAllowedEventIds } from "@/lib/staff-event-scope";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { listInvoices, listUninvoicedOrders } from "@/lib/invoice";
import type { StaffRole } from "@/lib/server-staff-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Fatura listesi: GET /api/invoices/?event_id=&status=&from=&to=&limit=
 * admin tümünü, organizatör yalnız kendi etkinliklerinin faturalarını görür.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireRole(request, ["admin", "organizer"]);
    if (auth instanceof NextResponse) return auth;

    const params = request.nextUrl.searchParams;
    const admin = getSupabaseAdmin();
    const allowedEventIds = await buildStaffAllowedEventIds(
      admin,
      auth.roles as StaffRole[],
      auth.user.id
    );

    const inScope = <T extends { event_id: string }>(rows: T[]) =>
      allowedEventIds === null ? rows : rows.filter((row) => allowedEventIds.includes(row.event_id));

    if (params.get("missing") === "1") {
      const orders = inScope(
        await listUninvoicedOrders(
          {
            eventId: params.get("event_id")?.trim() || undefined,
            limit: Math.min(Number(params.get("limit")) || 40, 100),
          },
          admin
        )
      );
      return NextResponse.json({ success: true, orders });
    }

    const rows = inScope(
      await listInvoices(
        {
          eventId: params.get("event_id")?.trim() || undefined,
          status: params.get("status")?.trim() || undefined,
          from: params.get("from")?.trim() || undefined,
          to: params.get("to")?.trim() || undefined,
          limit: Math.min(Number(params.get("limit")) || 300, 500),
        },
        admin
      )
    );

    return NextResponse.json({
      success: true,
      total: rows.length,
      gross_total: rows
        .filter((row) => row.status === "issued")
        .reduce((sum, row) => sum + Number(row.gross_total || 0), 0)
        .toFixed(2),
      invoices: rows,
    });
  } catch (error) {
    console.error("invoice list API error:", error);
    return NextResponse.json(
      {
        success: false,
        message:
          "Faturalar listelenemedi. 151 migration'ının uygulandığını ve PostgREST şemasının tazeliğini doğrulayın.",
      },
      { status: 500 }
    );
  }
}
