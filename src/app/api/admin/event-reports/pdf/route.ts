import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { eventReportFileName, loadEventReport, parseCommissionRate, saveCommissionRate } from "@/lib/event-report";
import { buildEventReportPdf } from "@/lib/event-report-pdf";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/event-reports/pdf/ { event_id, commission_rate? }
 * Oran gönderildiyse kaydedilir, sonra PDF üretilir. Mail göndermez.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = (await request.json().catch(() => null)) as
      | { event_id?: string; commission_rate?: unknown }
      | null;
    const eventId = String(body?.event_id || "").trim();
    if (!eventId) return NextResponse.json({ error: "Etkinlik seçilmedi." }, { status: 400 });

    const rate = parseCommissionRate(body?.commission_rate);
    if (!rate.valid) {
      return NextResponse.json({ error: "Komisyon oranı 0 ile 100 arasında olmalı." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const report = await loadEventReport(supabase, eventId, rate.value);
    if (!report) return NextResponse.json({ error: "Etkinlik bulunamadı." }, { status: 404 });

    if (rate.value !== undefined) {
      await saveCommissionRate(supabase, eventId, rate.value);
    }

    const bytes = await buildEventReportPdf(report);
    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${eventReportFileName(report)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("event-reports pdf error:", error);
    return NextResponse.json({ error: "PDF oluşturulamadı." }, { status: 500 });
  }
}
