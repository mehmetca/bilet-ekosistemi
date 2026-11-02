import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { loadEventReport, parseCommissionRate, saveCommissionRate } from "@/lib/event-report";
import { buildEventReportPdf } from "@/lib/event-report-pdf";
import { sendEventReportEmail } from "@/lib/event-report-mail";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/admin/event-reports/email/ { event_id, email, commission_rate? }
 * PDF üretip yalnız bu istek geldiğinde mail atar; otomatik gönderim yoktur.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = (await request.json().catch(() => null)) as
      | { event_id?: string; email?: string; commission_rate?: unknown }
      | null;
    const eventId = String(body?.event_id || "").trim();
    const email = String(body?.email || "").trim().toLowerCase();

    if (!eventId) return NextResponse.json({ error: "Etkinlik seçilmedi." }, { status: 400 });
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "Geçerli bir e-posta adresi yazın." }, { status: 400 });
    }

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

    const pdf = await buildEventReportPdf(report);
    const result = await sendEventReportEmail({ to: email, data: report, pdf });
    if (!result.sent) {
      console.error("event-reports email failed:", result.reason);
      return NextResponse.json(
        { error: `Mail gönderilemedi: ${result.reason || "bilinmeyen neden"}` },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true, email });
  } catch (error) {
    console.error("event-reports email error:", error);
    return NextResponse.json({ error: "Rapor maili gönderilemedi." }, { status: 500 });
  }
}
