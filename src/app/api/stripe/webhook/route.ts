import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe-server";
import { fulfillStripeCheckoutSession } from "@/lib/stripe-checkout-fulfillment";
import { cancelOrdersForPaymentIntent } from "@/lib/order-cancel-refund";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

async function markIntentsRefundedForPaymentIntent(paymentIntentId: string, note: string) {
  const supabase = getSupabaseAdmin();
  const { data: orders } = await supabase
    .from("orders")
    .select("stripe_session_id")
    .eq("stripe_payment_intent_id", paymentIntentId);

  const sessionIds = [
    ...new Set(
      (orders || [])
        .map((o) => (o as { stripe_session_id?: string | null }).stripe_session_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  for (const sessionId of sessionIds) {
    await supabase
      .from("stripe_checkout_intents")
      .update({
        status: "refunded",
        fulfillment_error: note,
        updated_at: new Date().toISOString(),
      })
      .eq("stripe_session_id", sessionId)
      .neq("status", "refunded");
  }
}

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not configured.");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  const rawBody = await request.text();
  const stripe = getStripe();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    console.error("Stripe webhook signature verification failed:", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const sessionId = session.id;
      if (!sessionId) {
        return NextResponse.json({ received: true, skipped: "no_session_id" });
      }

      const result = await fulfillStripeCheckoutSession(sessionId);
      if (result.ok === false) {
        if (result.inProgress) {
          return NextResponse.json({ received: true, inProgress: true });
        }
        console.error("Stripe webhook fulfillment failed:", result.message, { sessionId });
        // 200 dön: Stripe retry spam'ini azalt; iade zaten tetiklenmiş olabilir
        return NextResponse.json({ received: true, error: result.message });
      }
    }

    if (event.type === "charge.refunded") {
      const charge = event.data.object as Stripe.Charge;
      const paymentIntentId =
        typeof charge.payment_intent === "string"
          ? charge.payment_intent
          : charge.payment_intent?.id;
      if (paymentIntentId) {
        const { cancelledIds, errors } = await cancelOrdersForPaymentIntent(paymentIntentId);
        await markIntentsRefundedForPaymentIntent(
          paymentIntentId,
          "Stripe charge.refunded webhook"
        );
        if (errors.length > 0) {
          console.error("charge.refunded cancel errors:", errors, { paymentIntentId, cancelledIds });
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook handler error:", error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
