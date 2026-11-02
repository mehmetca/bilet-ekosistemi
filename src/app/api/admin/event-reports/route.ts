import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { loadEventReport, loadEventReportSummaries, parseCommissionRate, saveCommissionRate } from "@/lib/event-report";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/admin/event-reports/?event_id= → tek rapor; parametresiz → tüm etkinlik özetleri. */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const supabase = getSupabaseAdmin();
    const eventId = request.nextUrl.searchParams.get("event_id")?.trim();

    if (eventId) {
      const report = await loadEventReport(supabase, eventId);
      if (!report) return NextResponse.json({ error: "Etkinlik bulunamadı." }, { status: 404 });
      return NextResponse.json({ report });
    }

    const events = await loadEventReportSummaries(supabase);
    return NextResponse.json({ events });
  } catch (error) {
    console.error("event-reports GET error:", error);
    return NextResponse.json(
      { error: "Etkinlik raporları yüklenemedi. Migration 157 uygulanmış mı?" },
      { status: 500 }
    );
  }
}

/** POST /api/admin/event-reports/ { event_id, commission_rate } → oranı kalıcı kaydeder. */
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
    if (rate.value === undefined) {
      return NextResponse.json({ error: "Komisyon oranı gerekli." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: event, error } = await supabase.from("events").select("id").eq("id", eventId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!event) return NextResponse.json({ error: "Etkinlik bulunamadı." }, { status: 404 });

    await saveCommissionRate(supabase, eventId, rate.value);
    return NextResponse.json({ success: true, event_id: eventId, commission_rate: rate.value });
  } catch (error) {
    console.error("event-reports POST error:", error);
    return NextResponse.json(
      { error: "Komisyon oranı kaydedilemedi. Migration 157 uygulanmış mı?" },
      { status: 500 }
    );
  }
}
