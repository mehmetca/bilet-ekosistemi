import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { requireRole } from "@/lib/api-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { buildStaffAllowedEventIds } from "@/lib/staff-event-scope";
import { extractTicketCode } from "@/lib/ticket-code";
import { checkTicketCore, type CheckResult } from "@/app/kontrol/actions";
import type { StaffRole } from "@/lib/server-staff-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_SCANS_PER_BATCH = 300;

type ScanInput = {
  code?: unknown;
  scanned_at?: unknown;
  client_event_id?: unknown;
};

/** Sunucudaki sonuç, cihazın çevrimdışı kararıyla karşılaştırılabilir olsun diye etiketlenir. */
function verdictOf(result: CheckResult): "entry" | "duplicate" | "denied" | "unknown" {
  if (result.scopeDenied) return "denied";
  if (result.valid) return "entry";
  if (result.reason === "used") return "duplicate";
  return "unknown";
}

/**
 * Çevrimdışı tarama kuyruğunu sunucuya yazar (mutabakat).
 * Her okuma mevcut check_ticket_door'dan geçer: CAS ile işaretlenir,
 * ticket_check_logs'a source='offline' + cihaz saatıyla düşer,
 * client_event_id sayesinde tekrar gönderim tek satır üretir.
 * POST /api/checkin/replay  { scans: [{code, scanned_at, client_event_id}], device_id }
 */
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    if (!checkRateLimit(ip, { name: "checkin-replay", windowMs: 60_000, max: 20 })) {
      return NextResponse.json(
        { success: false, message: "Çok fazla gönderim denemesi. Birkaç saniye sonra tekrar deneyin." },
        { status: 429 }
      );
    }

    const auth = await requireRole(request, ["admin", "controller", "organizer"]);
    if (auth instanceof NextResponse) return auth;

    const body = (await request.json().catch(() => null)) as
      | { scans?: unknown; device_id?: unknown }
      | null;
    const scans = Array.isArray(body?.scans) ? (body!.scans as ScanInput[]) : [];
    if (scans.length === 0) {
      return NextResponse.json(
        { success: false, message: "Gönderilecek okuma yok." },
        { status: 400 }
      );
    }
    if (scans.length > MAX_SCANS_PER_BATCH) {
      return NextResponse.json(
        { success: false, message: `Tek istekte en fazla ${MAX_SCANS_PER_BATCH} okuma gönderilir.` },
        { status: 400 }
      );
    }

    const deviceId = String(body?.device_id ?? "").slice(0, 64) || null;
    const admin = getSupabaseAdmin();
    const allowedEventIds = await buildStaffAllowedEventIds(
      admin,
      auth.roles as StaffRole[],
      auth.user.id
    );

    const results: Array<{
      client_event_id: string;
      code: string;
      verdict: ReturnType<typeof verdictOf>;
      message?: string;
    }> = [];

    for (const scan of scans) {
      const code = extractTicketCode(String(scan?.code ?? ""));
      const clientEventId =
        String(scan?.client_event_id ?? "").trim() || crypto.randomUUID();
      const scannedAt =
        typeof scan?.scanned_at === "string" && !Number.isNaN(Date.parse(scan.scanned_at))
          ? new Date(scan.scanned_at).toISOString()
          : null;

      if (!code) {
        results.push({ client_event_id: clientEventId, code: "", verdict: "unknown" });
        continue;
      }

      const result = await checkTicketCore(code, {
        mark: true,
        actorUserId: auth.user.id,
        allowedEventIds,
        clientEventId,
        offline: { scannedAt: scannedAt ?? new Date().toISOString(), deviceId },
      });

      results.push({
        client_event_id: clientEventId,
        code,
        verdict: verdictOf(result),
        message: result.message,
      });
    }

    const counts = results.reduce(
      (acc, r) => ({ ...acc, [r.verdict]: (acc[r.verdict] ?? 0) + 1 }),
      {} as Record<string, number>
    );

    return NextResponse.json({
      success: true,
      counts,
      conflicts: results.filter((r) => r.verdict !== "entry"),
      results,
    });
  } catch (error) {
    console.error("checkin replay API error:", error);
    return NextResponse.json(
      { success: false, message: "Okumalar kaydedilemedi." },
      { status: 500 }
    );
  }
}
