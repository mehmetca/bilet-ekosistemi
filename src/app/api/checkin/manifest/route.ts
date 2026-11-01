import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { buildStaffAllowedEventIds } from "@/lib/staff-event-scope";
import type { StaffRole } from "@/lib/server-staff-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Çevrimdışı giriş listesi: görevlinin cihazına indirdiği, internet kesilince
 * tek başına karar verdiren snapshot. Alıcı verisi taşımaz — kopya çalınsa
 * müşteri listesi sızmasın, sadece kodlar ve koltuk yerleri görünür.
 * GET /api/checkin/manifest?event_id=<uuid>
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireRole(request, ["admin", "controller", "organizer"]);
    if (auth instanceof NextResponse) return auth;

    const eventId = request.nextUrl.searchParams.get("event_id")?.trim() || "";
    if (!eventId) {
      return NextResponse.json(
        { success: false, message: "Etkinlik gerekli." },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();
    const allowedEventIds = await buildStaffAllowedEventIds(
      admin,
      auth.roles as StaffRole[],
      auth.user.id
    );
    if (allowedEventIds !== null && !allowedEventIds.includes(eventId)) {
      return NextResponse.json(
        { success: false, message: "Bu etkinliğin giriş listesi size açık değil." },
        { status: 403 }
      );
    }

    const { data, error } = await admin.rpc("door_entry_manifest", {
      p_event_id: eventId,
      p_allowed_event_ids: allowedEventIds,
    });

    if (error) {
      console.error("door_entry_manifest rpc error:", error);
      return NextResponse.json(
        {
          success: false,
          message:
            "Giriş listesi üretilemedi. 150 migration'ının uygulandığını ve PostgREST şemasının tazeliğini doğrulayın.",
        },
        { status: 500 }
      );
    }

    const payload = (data ?? {}) as { error?: string } & Record<string, unknown>;
    if (payload.error === "forbidden") {
      return NextResponse.json(
        { success: false, message: "Bu etkinliğin giriş listesi size açık değil." },
        { status: 403 }
      );
    }
    if (payload.error === "not_found") {
      return NextResponse.json(
        { success: false, message: "Etkinlik bulunamadı." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, ...payload });
  } catch (error) {
    console.error("checkin manifest API error:", error);
    return NextResponse.json(
      { success: false, message: "Giriş listesi alınamadı." },
      { status: 500 }
    );
  }
}
