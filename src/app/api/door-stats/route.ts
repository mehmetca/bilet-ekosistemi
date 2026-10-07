import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { buildStaffAllowedEventIds } from "@/lib/staff-event-scope";
import type { StaffRole } from "@/lib/server-staff-auth";

/**
 * Kapı sayaçları: beklenen/gelen/kalan bilet birimi, son okuma ve görevli kırılımı.
 * GET /api/door-stats?event_id=<uuid>
 * Sadece admin, controller (görevli olduğu etkinlik) veya organizer (kendi etkinliği).
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireRole(request, ["admin", "controller", "organizer"]);
    if (auth instanceof NextResponse) return auth;

    const eventId = request.nextUrl.searchParams.get("event_id")?.trim();
    if (!eventId) {
      return NextResponse.json(
        { success: false, message: "event_id zorunludur." },
        { status: 400 }
      );
    }

    const allowedEventIds = await buildStaffAllowedEventIds(
      auth.supabase,
      auth.roles as StaffRole[],
      auth.user.id
    );
    if (allowedEventIds !== null && !allowedEventIds.includes(eventId)) {
      return NextResponse.json(
        { success: false, message: "Bu etkinliğin kapı verileri size açık değil." },
        { status: 403 }
      );
    }

    const { data, error } = await auth.supabase.rpc("get_event_door_stats", {
      p_event_id: eventId,
    });

    if (error) {
      console.error("door-stats rpc error:", error);
      const suffix = [(error as { code?: string }).code, (error as { message?: string }).message]
        .filter(Boolean)
        .join(" ");
      return NextResponse.json(
        {
          success: false,
          message:
            "Kapı sayıları alınamadı." +
            (suffix ? ` ${suffix}` : "") +
            " 122 ve 123 migration'larının bu projede uygulandığını doğrulayın.",
        },
        { status: 500 }
      );
    }

    const stats = (data ?? null) as { operators?: Array<{ name?: string | null; userId?: string | null }> } | null;
    if (stats?.operators?.length) {
      // 123'teki eski ad çözümü boş profil yüzünden null döndürüyor; rpc ile doldurulur.
      stats.operators = await Promise.all(
        stats.operators.map(async (op) => {
          if (op.name || !op.userId) return op;
          const { data: name } = await auth.supabase.rpc("staff_display_name", {
            p_user_id: op.userId,
          });
          return typeof name === "string" && name ? { ...op, name } : op;
        })
      );
    }

    return NextResponse.json({ success: true, stats });
  } catch (error) {
    console.error("door-stats API error:", error);
    return NextResponse.json(
      { success: false, message: "Sunucu hatası." },
      { status: 500 }
    );
  }
}
