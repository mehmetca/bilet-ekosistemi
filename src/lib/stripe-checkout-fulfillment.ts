import { NextRequest } from "next/server";
import { POST as purchasePost } from "@/app/api/purchase/route";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getStripe } from "@/lib/stripe-server";
import {
  parsePhysicalDelivery,
  type CheckoutPhysicalDelivery,
} from "@/lib/checkout-shipping";
import type { CheckoutCartLineInput } from "@/lib/checkout-cart-pricing";

export type StoredCheckoutCartLine = CheckoutCartLineInput;

export type CheckoutIntentRecord = {
  id: string;
  stripe_session_id: string | null;
  user_id: string | null;
  buyer_email: string;
  buyer_name: string | null;
  buyer_address: string | null;
  buyer_plz: string | null;
  buyer_city: string | null;
  delivery_choice: string;
  seat_hold_session_id: string | null;
  cart_json: StoredCheckoutCartLine[];
  total_amount_cents: number;
  currency: string;
  status: string;
  fulfillment_error: string | null;
};

function getSiteOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (raw) {
    try {
      return new URL(raw.startsWith("http") ? raw : `https://${raw}`).origin;
    } catch {
      /* fall through */
    }
  }
  return "http://localhost:3000";
}

async function loadIntentBySessionId(sessionId: string): Promise<CheckoutIntentRecord | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("stripe_checkout_intents")
    .select("*")
    .eq("stripe_session_id", sessionId)
    .maybeSingle();
  if (error || !data) return null;
  return data as CheckoutIntentRecord;
}

async function updateIntentStatus(
  intentId: string,
  status: "paid" | "fulfilled" | "failed",
  fulfillmentError?: string | null
) {
  const supabase = getSupabaseAdmin();
  await supabase
    .from("stripe_checkout_intents")
    .update({
      status,
      fulfillment_error: fulfillmentError ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", intentId);
}

export async function fulfillStripeCheckoutSession(
  stripeSessionId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const intent = await loadIntentBySessionId(stripeSessionId);
  if (!intent) {
    return { ok: false, message: "Checkout intent bulunamadı." };
  }

  if (intent.status === "fulfilled") {
    return { ok: true };
  }

  const stripe = getStripe();
  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(stripeSessionId);
  } catch (error) {
    console.error("Webhook: Stripe session retrieve failed:", error);
    return { ok: false, message: "Stripe oturumu okunamadı." };
  }

  const stripePaid =
    session.status === "complete" &&
    (session.payment_status === "paid" || session.payment_status === "no_payment_required");

  if (!stripePaid) {
    return { ok: false, message: "Ödeme tamamlanmamış." };
  }

  const paidCents = Number(session.amount_total || 0);
  if (paidCents !== intent.total_amount_cents) {
    await updateIntentStatus(
      intent.id,
      "failed",
      `Ödenen tutar (${paidCents}) intent tutarı (${intent.total_amount_cents}) ile uyuşmuyor.`
    );
    return { ok: false, message: "Ödeme tutarı sepet ile uyuşmuyor." };
  }

  if ((session.currency || "").toLowerCase() !== (intent.currency || "").toLowerCase()) {
    await updateIntentStatus(intent.id, "failed", "Para birimi uyuşmuyor.");
    return { ok: false, message: "Para birimi uyuşmuyor." };
  }

  if (intent.status === "pending") {
    await updateIntentStatus(intent.id, "paid");
  }

  const cart = Array.isArray(intent.cart_json) ? intent.cart_json : [];
  if (cart.length === 0) {
    await updateIntentStatus(intent.id, "failed", "Sepet boş.");
    return { ok: false, message: "Sepet boş." };
  }

  const physicalDelivery: CheckoutPhysicalDelivery =
    intent.delivery_choice === "e_ticket"
      ? "none"
      : parsePhysicalDelivery(intent.delivery_choice);

  const origin = getSiteOrigin();
  let shippingApplied = false;
  const errors: string[] = [];

  for (const item of cart) {
    const formData = new FormData();
    formData.append("ticket_id", item.ticketId);
    const seatIds = Array.isArray(item.seatIds) ? item.seatIds : [];
    const purchaseQty = seatIds.length > 0 ? seatIds.length : Math.max(1, Number(item.quantity) || 1);
    formData.append("quantity", String(purchaseQty));
    formData.append("buyer_name", (intent.buyer_name || "Müşteri").trim());
    formData.append("buyer_email", intent.buyer_email.trim());
    formData.append("stripe_session_id", stripeSessionId);
    if (intent.user_id) formData.append("client_user_id", intent.user_id);
    if (intent.buyer_address) formData.append("buyer_address", intent.buyer_address);
    if (intent.buyer_plz) formData.append("buyer_plz", intent.buyer_plz);
    if (intent.buyer_city) formData.append("buyer_city", intent.buyer_city);

    const shouldApplyShipping = !shippingApplied && physicalDelivery !== "none";
    formData.append(
      "physical_delivery",
      shouldApplyShipping ? physicalDelivery : "none"
    );
    if (seatIds.length > 0) {
      formData.append("seat_ids", JSON.stringify(seatIds));
      if (intent.seat_hold_session_id) {
        formData.append("seat_hold_session_id", intent.seat_hold_session_id);
      }
    }
    if (item.includeProcessingFee) {
      formData.append("include_checkout_processing_fee", "true");
    }

    const req = new NextRequest(`${origin}/api/purchase`, {
      method: "POST",
      body: formData,
    });

    try {
      const res = await purchasePost(req);
      const data = (await res.json()) as { success?: boolean; message?: string };
      if (data.success) {
        if (shouldApplyShipping) shippingApplied = true;
      } else {
        errors.push(data.message || `Bilet ${item.ticketId} siparişi oluşturulamadı.`);
      }
    } catch (error) {
      console.error("Webhook fulfillment purchase error:", error);
      errors.push(`Bilet ${item.ticketId} işlenirken hata oluştu.`);
    }
  }

  if (errors.length > 0) {
    const msg = errors.join(" | ");
    await updateIntentStatus(intent.id, "failed", msg);
    return { ok: false, message: msg };
  }

  await updateIntentStatus(intent.id, "fulfilled");
  return { ok: true };
}
