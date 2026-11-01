import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { buildStaffAllowedEventIds } from "@/lib/staff-event-scope";
import type { StaffRole } from "@/lib/server-staff-auth";

export const runtime = "nodejs";

/**
 * Gişe satışını iptal et: stok ve koltuk geri döner, sipariş cancelled kalır.
 * Yalnızca sales_channel = door kayıtlarında çalışır (çevrimiçi sipariş
 * buradan iptal edilemez; onun yolu Stripe iadesidir).
 * POST /api/door-sales/<orderId>/cancel
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Satışta admin yok; düzeltme (iptal) admin'e de açık.
    const auth = await requireRole(request, ["admin", "organizer", "gate_sales"]);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const orderId = String(id || "").trim();
    if (!orderId) {
      return NextResponse.json({ success: false, message: "Sipariş id yok." }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const { data: order, error: orderError } = await admin
      .from("orders")
      .select("id, event_id, sales_channel, status, quantity, sold_by")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { success: false, message: "Sipariş bulunamadı." },
        { status: 404 }
      );
    }

    if (String(order.sales_channel || "online") !== "door") {
      return NextResponse.json(
        {
          success: false,
          message: "Bu sipariş gişe satışı değil; çevrimiçi sipariş Stripe iadesinden iptal edilir.",
        },
        { status: 400 }
      );
    }

    const allowedEventIds = await buildStaffAllowedEventIds(
      admin,
      auth.roles as StaffRole[],
      auth.user.id
    );
    if (allowedEventIds !== null && !allowedEventIds.includes(String(order.event_id))) {
      return NextResponse.json(
        { success: false, message: "Bu etkinliğin gişe kaydı size ait değil." },
        { status: 403 }
      );
    }

    // Gişe görevlisi yabancı biri olabilir: yalnız kendi kestiğini iptal eder.
    const ownsOrder = String(order.sold_by || "") === auth.user.id;
    if (!ownsOrder && !auth.roles.includes("admin") && !auth.roles.includes("organizer")) {
      return NextResponse.json(
        { success: false, message: "Yalnız kendi kestiğin bileti iptal edebilirsin." },
        { status: 403 }
      );
    }

    if (String(order.status) === "cancelled") {
      return NextResponse.json({ success: true, alreadyCancelled: true });
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const reason = String(body.reason ?? "").trim().slice(0, 200);

    const { data: result, error: rpcError } = await admin.rpc(
      "cancel_order_release_inventory",
      { p_order_id: orderId }
    );

    if (rpcError) {
      console.error("[door-sales/cancel] rpc:", rpcError);
      return NextResponse.json(
        { success: false, message: "İptal edilemedi. Lütfen tekrar deneyin." },
        { status: 500 }
      );
    }

    const payload = (result ?? null) as { success?: boolean; error?: string } | null;
    if (payload?.success === false) {
      return NextResponse.json(
        { success: false, message: payload.error || "İptal edilemedi." },
        { status: 409 }
      );
    }

    if (reason) {
      const { error: noteError } = await admin
        .from("orders")
        .update({ door_note: `İptal: ${reason}` })
        .eq("id", orderId);
      if (noteError) {
        // İptal olmuş; not yazılamadıysa yalnız sunucuda iz bırakılır.
        console.error("[door-sales/cancel] not yazılamadı:", noteError);
      }
    }

    return NextResponse.json({ success: true, releasedQuantity: Number(order.quantity) || 0 });
  } catch (error) {
    console.error("[door-sales/cancel] beklenmeyen hata:", error);
    return NextResponse.json(
      { success: false, message: "İptal tamamlanamadı." },
      { status: 500 }
    );
  }
}
