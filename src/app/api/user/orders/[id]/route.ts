import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

/**
 * Kullanıcı sipariş iptali.
 * Ödenmiş (Stripe) completed siparişler silinemez — DB fonksiyonu engeller.
 * Diğerleri soft-cancel + stok/koltuk serbest bırakır (hard delete yok).
 */
export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await context.params;

    if (!orderId) {
      return NextResponse.json({ error: "Sipariş ID gerekli" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const authHeader = _request.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
    }
    const {
      data: { user },
    } = await supabase.auth.getUser(token);
    if (!user) {
      return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
    }

    const { data: result, error } = await supabase.rpc("delete_my_order", {
      p_order_id: orderId,
      p_user_id: user.id,
      p_email: user.email || "",
    });

    if (error) {
      console.error("RPC delete_my_order error:", error);
      return NextResponse.json(
        { error: "Sipariş iptal edilemedi. Lütfen destek ile iletişime geçin." },
        { status: 500 }
      );
    }

    const res = result as { success?: boolean; error?: string } | null;
    if (res && res.success === false && res.error) {
      if (res.error.includes("bulunamadı")) {
        return NextResponse.json({ error: res.error }, { status: 404 });
      }
      if (res.error.includes("erişim")) {
        return NextResponse.json({ error: res.error }, { status: 403 });
      }
      return NextResponse.json({ error: res.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, cancelled: true });
  } catch (err) {
    console.error("user orders DELETE error:", err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
