import { NextRequest, NextResponse } from "next/server";
import {
  fulfillStripeCheckoutSession,
  loadOrdersForStripeSession,
} from "@/lib/stripe-checkout-fulfillment";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

/**
 * İstemci ödeme sonrası doğrudan /api/purchase çağırmaz.
 * Bu endpoint webhook ile aynı atomik fulfill yolunu kullanır (tek kaynak).
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { sessionId?: string };
    const sessionId = (body.sessionId || "").trim();
    if (!sessionId) {
      return NextResponse.json(
        { success: false, message: "sessionId zorunlu." },
        { status: 400 }
      );
    }

    const result = await fulfillStripeCheckoutSession(sessionId);

    if (result.ok === false) {
      const status = result.inProgress ? 202 : 409;
      return NextResponse.json(
        {
          success: false,
          inProgress: Boolean(result.inProgress),
          refunded: Boolean(result.refunded),
          message: result.message,
        },
        { status }
      );
    }

    const orders =
      result.orders.length > 0
        ? result.orders
        : await loadOrdersForStripeSession(sessionId);

    // Sepet UI için intent sepet satır sırasını koru
    const supabase = getSupabaseAdmin();
    const { data: intent } = await supabase
      .from("stripe_checkout_intents")
      .select("cart_json, buyer_name")
      .eq("stripe_session_id", sessionId)
      .maybeSingle();

    const cart = Array.isArray((intent as { cart_json?: unknown } | null)?.cart_json)
      ? ((intent as { cart_json: Array<{ ticketId: string }> }).cart_json)
      : [];

    const byTicket = new Map(orders.map((o) => [o.ticketId, o]));
    const ordered =
      cart.length > 0
        ? cart
            .map((line) => byTicket.get(line.ticketId))
            .filter((o): o is NonNullable<typeof o> => Boolean(o))
        : orders;

    return NextResponse.json({
      success: true,
      alreadyFulfilled: Boolean(result.alreadyFulfilled),
      orders: ordered.map((o) => ({
        ticketId: o.ticketId,
        ticketCode: o.ticketCode,
        quantity: o.quantity,
        price: o.totalPrice,
        buyerName: o.buyerName || (intent as { buyer_name?: string } | null)?.buyer_name || "",
        seatDetails: o.seatDetails,
        ticketCodes: o.ticketCodes,
      })),
    });
  } catch (error) {
    console.error("ensure-fulfillment error:", error);
    return NextResponse.json(
      { success: false, message: "Sipariş tamamlanamadı." },
      { status: 500 }
    );
  }
}
