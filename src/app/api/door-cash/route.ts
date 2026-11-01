import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { buildStaffAllowedEventIds } from "@/lib/staff-event-scope";
import type { StaffRole } from "@/lib/server-staff-auth";

export const runtime = "nodejs";

const MAX_OPENING = 5000;
const MAX_COUNTED = 1_000_000;

type CashSummary = {
  cash_total: number;
  card_total: number;
  tickets: number;
  orders: number;
  free_tickets: number;
  cancelled: number;
};

type SessionRow = {
  id: string;
  staff_id: string;
  event_id: string | null;
  opening_amount: number | null;
  status: string;
  opened_at: string | null;
  closed_at: string | null;
  counted_cash: number | null;
  expected_cash: number | null;
  difference: number | null;
  note: string | null;
};

const round = (value: number) => Math.round(value * 100) / 100;

function tableMissing(message: string): boolean {
  return /door_cash_sessions|door_cash_summary|PGRST205|PGRST202|Could not find|does not exist/i.test(
    message
  );
}

const migrationError = () =>
  NextResponse.json(
    {
      success: false,
      message: "Kasa tablosu veritabanında yok. 149_door_cash_sessions migration'ını uygulayın.",
    },
    { status: 500 }
  );

async function readSummary(
  admin: ReturnType<typeof getSupabaseAdmin>,
  input: { staffId: string; from: string; to?: string | null; eventId?: string | null }
): Promise<CashSummary | null> {
  const { data, error } = await admin.rpc("door_cash_summary", {
    p_staff_id: input.staffId,
    p_from: input.from,
    p_to: input.to ?? null,
    p_event_id: input.eventId ?? null,
  });
  if (error) {
    console.error("[door-cash] door_cash_summary:", error);
    return null;
  }
  return (data || null) as CashSummary | null;
}

/** Görevli kendi vardiyasını, yönetici günün tüm vardiyalarını görür. */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireRole(request, ["admin", "organizer", "gate_sales"]);
    if (auth instanceof NextResponse) return auth;

    const admin = getSupabaseAdmin();
    const isAdmin = auth.roles.includes("admin");

    const rawFrom = request.nextUrl.searchParams.get("from")?.trim();
    const rawTo = request.nextUrl.searchParams.get("to")?.trim();
    const from =
      rawFrom && !Number.isNaN(Date.parse(rawFrom))
        ? new Date(rawFrom).toISOString()
        : new Date(new Date().toISOString().slice(0, 10) + "T00:00:00").toISOString();
    const to =
      rawTo && !Number.isNaN(Date.parse(rawTo)) ? new Date(rawTo).toISOString() : null;

    let query = admin
      .from("door_cash_sessions")
      .select("*")
      .order("opened_at", { ascending: false })
      .limit(50);

    if (isAdmin) {
      query = query.gte("opened_at", from);
      if (to) query = query.lte("opened_at", to);
    } else {
      query = query.eq("staff_id", auth.user.id);
    }

    const { data, error } = await query;
    if (error) {
      console.error("[door-cash] liste:", error);
      return tableMissing(String(error.message)) ? migrationError() : NextResponse.json(
        { success: false, message: "Kasa kayıtları alınamadı." },
        { status: 500 }
      );
    }

    const rows = (data || []) as SessionRow[];
    const openRow = rows.find((row) => row.status === "open") || null;

    const sessions = await Promise.all(
      rows.map(async (row) => {
        const live =
          row.status === "open"
            ? await readSummary(admin, {
                staffId: row.staff_id,
                from: String(row.opened_at),
                eventId: row.event_id,
              })
            : null;
        const expected = live
          ? round(Number(row.opening_amount) + live.cash_total)
          : Number(row.expected_cash ?? 0);
        const counted = row.status === "closed" ? Number(row.counted_cash ?? 0) : null;
        return {
          ...row,
          opening_amount: Number(row.opening_amount) || 0,
          summary: live,
          expected_cash: expected,
          difference: counted === null ? null : round(counted - expected),
        };
      })
    );

    const staffNames = new Map<string, string>();
    if (isAdmin) {
      const ids = [...new Set(rows.map((row) => row.staff_id))];
      const named = await Promise.all(
        ids.map(async (id) => {
          const { data: name } = await admin.rpc("staff_display_name", { p_user_id: id });
          return [id, String(name || "")] as const;
        })
      );
      for (const [id, name] of named) staffNames.set(id, name);
    }

    return NextResponse.json({
      success: true,
      isAdmin,
      openSession: isAdmin ? null : sessions.find((session) => session.status === "open") || null,
      sessions: sessions.map((session) => ({
        ...session,
        staff_name: staffNames.get(session.staff_id) || null,
      })),
    });
  } catch (error) {
    console.error("[door-cash GET] beklenmeyen hata:", error);
    return NextResponse.json({ success: false, message: "Kasa bilgisi alınamadı." }, { status: 500 });
  }
}

/** Kasa aç (bozma parasıyla) ve kasa kapat (sayılan parayı girerek). */
export async function POST(request: NextRequest) {
  try {
    // Kapıda satış gişe görevlisi ve organizatörün işi; yönetici kasa tutmaz.
    const auth = await requireRole(request, ["gate_sales", "organizer"]);
    if (auth instanceof NextResponse) return auth;

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const action = String(body.action ?? "").trim();
    const admin = getSupabaseAdmin();

    if (action === "open") {
      const opening = Number(body.opening_amount);
      const eventId = String(body.event_id ?? "").trim();
      if (!Number.isFinite(opening) || opening < 0 || opening > MAX_OPENING) {
        return NextResponse.json(
          { success: false, message: `Açılış parası 0 ile ${MAX_OPENING} arasında olmalıdır.` },
          { status: 400 }
        );
      }

      if (eventId) {
        const allowed = await buildStaffAllowedEventIds(
          admin,
          auth.roles as StaffRole[],
          auth.user.id
        );
        if (allowed !== null && !allowed.includes(eventId)) {
          return NextResponse.json(
            { success: false, message: "Bu etkinlik için gişe yetkin yok." },
            { status: 403 }
          );
        }
      }

      const { data: existing, error: existingError } = await admin
        .from("door_cash_sessions")
        .select("id")
        .eq("staff_id", auth.user.id)
        .eq("status", "open")
        .limit(1);

      if (existingError) {
        console.error("[door-cash] açık vardiya sorgusu:", existingError);
        return tableMissing(String(existingError.message))
          ? migrationError()
          : NextResponse.json({ success: false, message: "Kasa durumu okunamadı." }, { status: 500 });
      }
      if (existing && existing.length > 0) {
        return NextResponse.json(
          { success: false, message: "Zaten açık kasan var. Önce kapat." },
          { status: 409 }
        );
      }

      const { data: session, error } = await admin
        .from("door_cash_sessions")
        .insert({
          staff_id: auth.user.id,
          event_id: eventId || null,
          opening_amount: round(opening),
          status: "open",
        })
        .select("*")
        .single();

      if (error || !session) {
        console.error("[door-cash] açılış:", error);
        return tableMissing(String(error?.message))
          ? migrationError()
          : NextResponse.json(
              { success: false, message: `Kasa açılamadı: ${String(error?.message || "bilinmeyen")}` },
              { status: 500 }
            );
      }

      return NextResponse.json({ success: true, session });
    }

    if (action === "close") {
      const counted = Number(body.counted_cash);
      const note = String(body.note ?? "").trim().slice(0, 300);
      if (!Number.isFinite(counted) || counted < 0 || counted > MAX_COUNTED) {
        return NextResponse.json(
          { success: false, message: "Sayılan parayı sayı olarak girin." },
          { status: 400 }
        );
      }

      const { data: openRow, error: openError } = await admin
        .from("door_cash_sessions")
        .select("*")
        .eq("staff_id", auth.user.id)
        .eq("status", "open")
        .order("opened_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (openError) {
        console.error("[door-cash] kapanış okuma:", openError);
        return tableMissing(String(openError.message))
          ? migrationError()
          : NextResponse.json({ success: false, message: "Açık kasa okunamadı." }, { status: 500 });
      }
      if (!openRow) {
        return NextResponse.json(
          { success: false, message: "Açık kasan yok. Önce kasa aç." },
          { status: 409 }
        );
      }

      const session = openRow as SessionRow;
      const summary = await readSummary(admin, {
        staffId: session.staff_id,
        from: String(session.opened_at),
        to: new Date().toISOString(),
        eventId: session.event_id,
      });
      if (!summary) return migrationError();

      const opening = Number(session.opening_amount) || 0;
      const expected = round(opening + summary.cash_total);
      const closedAt = new Date().toISOString();

      const { data: updated, error: updateError } = await admin
        .from("door_cash_sessions")
        .update({
          status: "closed",
          closed_at: closedAt,
          counted_cash: round(counted),
          expected_cash: expected,
          difference: round(counted - expected),
          ...(note ? { note } : {}),
        })
        .eq("id", session.id)
        .select("*")
        .single();

      if (updateError || !updated) {
        console.error("[door-cash] kapanış:", updateError);
        return NextResponse.json(
          { success: false, message: `Kasa kapatılamadı: ${String(updateError?.message || "bilinmeyen")}` },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        session: updated,
        summary,
        expectedCash: expected,
        difference: round(counted - expected),
      });
    }

    return NextResponse.json({ success: false, message: "Geçersiz işlem." }, { status: 400 });
  } catch (error) {
    console.error("[door-cash POST] beklenmeyen hata:", error);
    return NextResponse.json({ success: false, message: "Kasa işlemi tamamlanamadı." }, { status: 500 });
  }
}
