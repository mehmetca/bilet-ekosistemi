import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { CART_RESERVATION_SECONDS } from "@/lib/cart-reservation";

export const dynamic = "force-dynamic";

type HoldSeatBody = {
  eventId: string;
  seatId: string;
  /** İsteğe bağlı: anonim kullanıcılar için tarayıcıya özel bir session id (localStorage vs.) */
  sessionId?: string;
};

type ReleaseSeatBody = {
  eventId?: string;
  seatId: string;
  sessionId?: string;
};

export async function GET(req: NextRequest) {
  try {
    const eventId = req.nextUrl.searchParams.get("event_id")?.trim() || "";
    const sessionId = req.nextUrl.searchParams.get("session_id")?.trim() || "";
    if (!eventId) {
      return NextResponse.json({ ok: true, heldByOthersSeatIds: [] as string[] });
    }

    const supabase = getSupabaseAdmin();
    const userId = await getUserIdFromRequest(req, supabase);
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from("seat_holds")
      .select("seat_id,user_id,session_id,held_until")
      .eq("event_id", eventId)
      .gt("held_until", nowIso);

    if (error) {
      console.error("seat-holds GET error:", error);
      return NextResponse.json({ ok: false, error: "Koltuk rezervasyonlari alinamadi." }, { status: 500 });
    }

    const heldByOthersSeatIds = ((data || []) as Array<{
      seat_id: string;
      user_id: string | null;
      session_id: string | null;
    }>)
      .filter((row) => {
        if (userId) return row.user_id !== userId;
        if (sessionId) return row.session_id !== sessionId;
        return true;
      })
      .map((row) => row.seat_id)
      .filter(Boolean);

    return NextResponse.json({ ok: true, heldByOthersSeatIds: [...new Set(heldByOthersSeatIds)] });
  } catch (err) {
    console.error("seat-holds GET route error:", err);
    return NextResponse.json({ ok: false, error: "Sunucu hatası" }, { status: 500 });
  }
}

async function getUserIdFromRequest(req: NextRequest, supabase: ReturnType<typeof getSupabaseAdmin>): Promise<string | null> {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user.id;
}

/** Koltuğu sepet süresi kadar rezerve et (cart-reservation ile aynı). */
export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const body = (await req.json().catch(() => null)) as HoldSeatBody | null;
    if (!body) {
      return NextResponse.json({ ok: false, error: "Gecersiz istek govdesi." }, { status: 400 });
    }
    const { eventId, seatId, sessionId } = body;
    if (!eventId || !seatId) {
      return NextResponse.json({ ok: false, error: "eventId ve seatId zorunludur." }, { status: 400 });
    }

    const userId = await getUserIdFromRequest(req, supabase);
    // Login kullanicilarinda hold sahipligi hesap bazli olsun; tarayici session id'si ile devredilmesin.
    const effectiveSessionId = userId ? null : (sessionId ?? null);

    const { data, error } = await supabase.rpc("hold_seat", {
      p_event_id: eventId,
      p_seat_id: seatId,
      p_user_id: userId,
      p_session_id: effectiveSessionId,
      p_hold_seconds: CART_RESERVATION_SECONDS,
    });

    if (error) {
      console.error("hold_seat rpc error:", error);
      return NextResponse.json({ ok: false, error: "Koltuk rezerve edilemedi." }, { status: 500 });
    }

    const success = Boolean(data);
    if (!success) {
      return NextResponse.json(
        {
          ok: false,
          error: "Bu koltuk şu anda başka bir kullanıcı tarafından tutuluyor.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("seat-holds POST error:", err);
    return NextResponse.json({ ok: false, error: "Sunucu hatası" }, { status: 500 });
  }
}

/** Kullanıcı koltuğu bıraktığında geçici rezervasyonu serbest bırak. */
export async function DELETE(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const body = (await req.json().catch(() => null)) as ReleaseSeatBody | null;
    if (!body) {
      return NextResponse.json({ ok: false, error: "Gecersiz istek govdesi." }, { status: 400 });
    }
    const { seatId, eventId, sessionId } = body;
    if (!seatId || !eventId) {
      return NextResponse.json({ ok: false, error: "eventId ve seatId zorunludur." }, { status: 400 });
    }

    const userId = await getUserIdFromRequest(req, supabase);
    const effectiveSessionId = userId ? null : (sessionId ?? null);

    const { error } = await supabase.rpc("release_seat_hold", {
      p_event_id: eventId,
      p_seat_id: seatId,
      p_user_id: userId,
      p_session_id: effectiveSessionId,
    });

    if (error) {
      console.error("release_seat_hold rpc error:", error);
      return NextResponse.json({ ok: false, error: "Rezervasyon serbest bırakılamadı." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("seat-holds DELETE error:", err);
    return NextResponse.json({ ok: false, error: "Sunucu hatası" }, { status: 500 });
  }
}

