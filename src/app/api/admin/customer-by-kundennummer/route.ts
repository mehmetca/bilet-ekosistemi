import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const kundennummer = searchParams.get("kundennummer")?.trim();
    if (!kundennummer) {
      return NextResponse.json({ error: "Kundennummer gerekli" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Profil bul (büyük/küçük harf duyarsız)
    const { data: profile, error: profileErr } = await supabase
      .from("user_profiles")
      .select("*")
      .ilike("kundennummer", kundennummer)
      .limit(1)
      .maybeSingle();

    if (profileErr) {
      return NextResponse.json({ error: profileErr.message }, { status: 500 });
    }
    if (!profile) {
      return NextResponse.json({ error: "Müşteri bulunamadı", found: false }, { status: 404 });
    }

    const userId = profile.user_id as string;

    // Auth kullanıcı bilgisi (kayıt tarihi, son giriş)
    const { data: authUser } = await supabase.auth.admin.getUserById(userId);
    const authInfo = authUser?.user
      ? {
          email: authUser.user.email,
          created_at: authUser.user.created_at,
          last_sign_in_at: authUser.user.last_sign_in_at,
        }
      : null;

    // Siparişler (user_id veya buyer_email ile)
    const email = authInfo?.email || profile.email;
    const selectFields = `
      id,
      event_id,
      ticket_id,
      quantity,
      total_price,
      ticket_code,
      status,
      buyer_name,
      buyer_email,
      created_at,
      events (
        title,
        date,
        time,
        venue
      ),
      tickets (
        name,
        type,
        price
      )
    `;

    const [byUserId, byEmail] = await Promise.all([
      supabase.from("orders").select(selectFields).eq("user_id", userId).order("created_at", { ascending: false }),
      email
        ? supabase.from("orders").select(selectFields).eq("buyer_email", email).order("created_at", { ascending: false })
        : { data: [] as unknown[] },
    ]);

    const seen = new Set<string>();
    const orders: unknown[] = [];
    for (const o of [...(byUserId.data || []), ...(byEmail.data || [])]) {
      const id = (o as { id?: string }).id;
      if (id && !seen.has(id)) {
        seen.add(id);
        orders.push(o);
      }
    }
    orders.sort((a, b) => {
      const aT = new Date((a as { created_at?: string }).created_at || 0).getTime();
      const bT = new Date((b as { created_at?: string }).created_at || 0).getTime();
      return bT - aT;
    });

    return NextResponse.json({
      profile,
      authInfo,
      orders,
    });
  } catch (err) {
    console.error("customer-by-kundennummer error:", err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
