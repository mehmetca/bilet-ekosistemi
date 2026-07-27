import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getStripe } from "@/lib/stripe-server";
import type Stripe from "stripe";

/** Stripe oturumuna bağlı tamamlanmış siparişleri iptal et, stok/koltuk serbest bırak. */
export async function cancelOrdersForStripeSession(
  stripeSessionId: string
): Promise<{ cancelledIds: string[]; errors: string[] }> {
  const supabase = getSupabaseAdmin();
  const cancelledIds: string[] = [];
  const errors: string[] = [];

  const { data: orders, error } = await supabase
    .from("orders")
    .select("id")
    .eq("stripe_session_id", stripeSessionId)
    .eq("status", "completed");

  if (error) {
    errors.push(error.message);
    return { cancelledIds, errors };
  }

  for (const row of orders || []) {
    const orderId = (row as { id: string }).id;
    const { data, error: rpcError } = await supabase.rpc("cancel_order_release_inventory", {
      p_order_id: orderId,
    });
    if (rpcError) {
      errors.push(`${orderId}: ${rpcError.message}`);
      continue;
    }
    const res = data as { success?: boolean; error?: string } | null;
    if (res?.success === false) {
      errors.push(`${orderId}: ${res.error || "iptal başarısız"}`);
      continue;
    }
    cancelledIds.push(orderId);
  }

  return { cancelledIds, errors };
}

/** PaymentIntent id ile siparişleri iptal et (Dashboard iadesi / charge.refunded). */
export async function cancelOrdersForPaymentIntent(
  paymentIntentId: string
): Promise<{ cancelledIds: string[]; errors: string[] }> {
  const supabase = getSupabaseAdmin();
  const cancelledIds: string[] = [];
  const errors: string[] = [];

  const { data: orders, error } = await supabase
    .from("orders")
    .select("id")
    .eq("stripe_payment_intent_id", paymentIntentId)
    .eq("status", "completed");

  if (error) {
    errors.push(error.message);
    return { cancelledIds, errors };
  }

  for (const row of orders || []) {
    const orderId = (row as { id: string }).id;
    const { data, error: rpcError } = await supabase.rpc("cancel_order_release_inventory", {
      p_order_id: orderId,
    });
    if (rpcError) {
      errors.push(`${orderId}: ${rpcError.message}`);
      continue;
    }
    const res = data as { success?: boolean; error?: string } | null;
    if (res?.success === false) {
      errors.push(`${orderId}: ${res.error || "iptal başarısız"}`);
      continue;
    }
    cancelledIds.push(orderId);
  }

  return { cancelledIds, errors };
}

function paymentIntentIdFromSession(session: Stripe.Checkout.Session): string | null {
  const pi = session.payment_intent;
  if (!pi) return null;
  return typeof pi === "string" ? pi : pi.id;
}

/** Fulfillment başarısızlığında: kısmi siparişleri geri al + Stripe iadesi. */
export async function refundCheckoutSessionAndCancelOrders(
  stripeSessionId: string,
  reason: string
): Promise<{ refunded: boolean; cancelledIds: string[]; message: string }> {
  const stripe = getStripe();
  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.retrieve(stripeSessionId);
  } catch (error) {
    console.error("refundCheckoutSession: session retrieve failed:", error);
    return {
      refunded: false,
      cancelledIds: [],
      message: "Stripe oturumu okunamadı; manuel iade gerekir.",
    };
  }

  const { cancelledIds, errors: cancelErrors } = await cancelOrdersForStripeSession(stripeSessionId);

  const piId = paymentIntentIdFromSession(session);
  if (!piId) {
    return {
      refunded: false,
      cancelledIds,
      message: `PaymentIntent yok. ${reason}${cancelErrors.length ? ` İptal hataları: ${cancelErrors.join("; ")}` : ""}`,
    };
  }

  try {
    const existing = await stripe.refunds.list({ payment_intent: piId, limit: 5 });
    const alreadyRefunded = existing.data.some(
      (r) => r.status === "succeeded" || r.status === "pending"
    );
    if (!alreadyRefunded) {
      await stripe.refunds.create({
        payment_intent: piId,
        reason: "requested_by_customer",
        metadata: {
          source: "fulfillment_failure",
          stripe_session_id: stripeSessionId,
          note: reason.slice(0, 450),
        },
      });
    }
    return {
      refunded: true,
      cancelledIds,
      message: reason,
    };
  } catch (error) {
    console.error("refundCheckoutSession: refund failed:", error);
    return {
      refunded: false,
      cancelledIds,
      message: `İade başarısız (manuel müdahale gerekir): ${
        error instanceof Error ? error.message : String(error)
      }. ${reason}`,
    };
  }
}
