import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const params = context.params;
    const orderId = typeof (params as Promise<{ id: string }>).then === "function"
      ? (await (params as Promise<{ id: string }>)).id
      : (params as { id: string }).id;

    if (!orderId) {
      return NextResponse.json({ error: "Sipariş ID gerekli" }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return NextResponse.json({ error: "Sunucu yapılandırma hatası" }, { status: 500 });
    }
    const supabase = createClient(url, key);
    const authHeader = _request.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
    }
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) {
      return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
    }

    // Veritabanı fonksiyonu ile sil (daha güvenilir)
    const { data: result, error } = await supabase.rpc("delete_my_order", {
      p_order_id: orderId,
      p_user_id: user.id,
      p_email: user.email || "",
    });

    if (error) {
      console.error("RPC delete_my_order error:", error);
      // Fonksiyon yoksa veya hata alırsa manuel silme dene
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .select("id, user_id, buyer_email, ticket_id, quantity")
        .eq("id", orderId)
        .maybeSingle();

      if (orderError || !order) {
        return NextResponse.json({ error: "Sipariş bulunamadı" }, { status: 404 });
      }

      const isOwner =
        order.user_id === user.id ||
        (user.email &&
          order.buyer_email &&
          order.buyer_email.trim().toLowerCase() === user.email.trim().toLowerCase());

      if (!isOwner) {
        return NextResponse.json({ error: "Bu siparişe erişim yetkiniz yok" }, { status: 403 });
      }

      if (order.ticket_id && order.quantity) {
        const { data: ticket } = await supabase
          .from("tickets")
          .select("available, quantity")
          .eq("id", order.ticket_id)
          .single();
        if (ticket) {
          const nextAvailable = Math.min(
            Number(ticket.quantity || 0),
            Number(ticket.available || 0) + order.quantity
          );
          await supabase.from("tickets").update({ available: nextAvailable }).eq("id", order.ticket_id);
        }
      }

      // Önce order_seats kayıtlarını sil (RLS cascade sorununu önlemek için)
      const { error: deleteSeatsError } = await supabase
        .from("order_seats")
        .delete()
        .eq("order_id", orderId);
      if (deleteSeatsError) {
        console.error("Order seats delete error:", deleteSeatsError);
      }

      const { error: deleteError } = await supabase.from("orders").delete().eq("id", orderId);
      if (deleteError) {
        console.error("Order delete error:", deleteError);
        return NextResponse.json({ error: "Sipariş silinemedi" }, { status: 500 });
      }
      return NextResponse.json({ success: true });
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

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("user orders DELETE error:", err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
