import { NextRequest } from "next/server";
import { POST as purchasePost } from "@/app/api/purchase/route";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getStripe } from "@/lib/stripe-server";
import {
  parsePhysicalDelivery,
  type CheckoutPhysicalDelivery,
} from "@/lib/checkout-shipping";
import type { CheckoutCartLineInput } from "@/lib/checkout-cart-pricing";
import { refundCheckoutSessionAndCancelOrders } from "@/lib/order-cancel-refund";
import { getFulfillmentAuthToken } from "@/lib/fulfillment-auth";

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

export type FulfillmentOrderSummary = {
  ticketId: string;
  orderId: string;
  ticketCode: string;
  quantity: number;
  totalPrice: number;
  buyerName: string | null;
  seatDetails?: Array<{
    section_name: string;
    row_label: string;
    seat_label: string;
    ticket_code?: string;
  }>;
  ticketCodes?: string[];
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
  status: "paid" | "processing" | "fulfilled" | "failed" | "refunded",
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

export async function loadOrdersForStripeSession(
  stripeSessionId: string
): Promise<FulfillmentOrderSummary[]> {
  const supabase = getSupabaseAdmin();
  const { data: orders } = await supabase
    .from("orders")
    .select("id, ticket_id, ticket_code, quantity, total_price, buyer_name")
    .eq("stripe_session_id", stripeSessionId)
    .eq("status", "completed");

  const summaries: FulfillmentOrderSummary[] = [];
  for (const order of orders || []) {
    const o = order as {
      id: string;
      ticket_id: string;
      ticket_code: string | null;
      quantity: number;
      total_price: number | string;
      buyer_name: string | null;
    };
    const { data: seats } = await supabase
      .from("order_seats")
      .select("section_name, row_label, seat_label, ticket_code")
      .eq("order_id", o.id);
    const { data: units } = await supabase
      .from("order_ticket_units")
      .select("ticket_code")
      .eq("order_id", o.id);

    const seatDetails = (seats || []).map((s) => ({
      section_name: String((s as { section_name?: string }).section_name || ""),
      row_label: String((s as { row_label?: string }).row_label || ""),
      seat_label: String((s as { seat_label?: string }).seat_label || ""),
      ticket_code: String((s as { ticket_code?: string }).ticket_code || ""),
    }));
    const ticketCodes = (units || [])
      .map((u) => String((u as { ticket_code?: string }).ticket_code || ""))
      .filter(Boolean);

    summaries.push({
      ticketId: o.ticket_id,
      orderId: o.id,
      ticketCode: o.ticket_code || "",
      quantity: Number(o.quantity || 0),
      totalPrice: Number(o.total_price),
      buyerName: o.buyer_name,
      seatDetails: seatDetails.length > 0 ? seatDetails : undefined,
      ticketCodes:
        ticketCodes.length > 0
          ? ticketCodes
          : seatDetails.map((s) => s.ticket_code || "").filter(Boolean).length > 0
            ? seatDetails.map((s) => s.ticket_code || "").filter(Boolean)
            : undefined,
    });
  }
  return summaries;
}

export type FulfillResult =
  | { ok: true; alreadyFulfilled?: boolean; orders: FulfillmentOrderSummary[] }
  | { ok: false; message: string; inProgress?: boolean; refunded?: boolean };

/**
 * Tek fulfillment giriş noktası: webhook + istemci ensure-fulfillment.
 * Atomik claim ile çift sipariş yarışını engeller.
 */
export async function fulfillStripeCheckoutSession(
  stripeSessionId: string
): Promise<FulfillResult> {
  const supabase = getSupabaseAdmin();
  const existing = await loadIntentBySessionId(stripeSessionId);
  if (!existing) {
    return { ok: false, message: "Checkout intent bulunamadı." };
  }

  if (existing.status === "fulfilled") {
    const orders = await loadOrdersForStripeSession(stripeSessionId);
    return { ok: true, alreadyFulfilled: true, orders };
  }

  if (existing.status === "refunded") {
    return {
      ok: false,
      message: existing.fulfillment_error || "Ödeme iade edildi; sipariş oluşturulmadı.",
      refunded: true,
    };
  }

  if (existing.status === "failed") {
    return {
      ok: false,
      message: existing.fulfillment_error || "Sipariş oluşturma başarısız.",
    };
  }

  if (existing.status === "processing") {
    // Başka worker işliyor olabilir; kısa bekleme sonrası tekrar kontrol
    await new Promise((r) => setTimeout(r, 800));
    const again = await loadIntentBySessionId(stripeSessionId);
    if (again?.status === "fulfilled") {
      const orders = await loadOrdersForStripeSession(stripeSessionId);
      return { ok: true, alreadyFulfilled: true, orders };
    }
    if (again?.status === "processing") {
      // Stuck claim RPC 2 dk sonra yeniden alır; şimdilik in-progress dön
      const { data: claimedNow } = await supabase.rpc("claim_checkout_intent", {
        p_stripe_session_id: stripeSessionId,
      });
      if (!claimedNow || (Array.isArray(claimedNow) && claimedNow.length === 0)) {
        return {
          ok: false,
          message: "Siparişiniz hazırlanıyor, lütfen birkaç saniye bekleyin.",
          inProgress: true,
        };
      }
      // claimed — continue with claimed row below via reload
    } else if (again?.status === "refunded" || again?.status === "failed") {
      return {
        ok: false,
        message: again.fulfillment_error || "Sipariş oluşturma başarısız.",
        refunded: again.status === "refunded",
      };
    }
  }

  const { data: claimedRows, error: claimError } = await supabase.rpc("claim_checkout_intent", {
    p_stripe_session_id: stripeSessionId,
  });

  if (claimError) {
    console.error("claim_checkout_intent failed:", claimError);
    // RPC henüz migrate edilmemiş olabilir: fallback non-atomic (eski davranıştan iyi)
    if (existing.status !== "processing") {
      await updateIntentStatus(existing.id, "processing");
    }
  }

  const claimed = Array.isArray(claimedRows) ? claimedRows[0] : claimedRows;
  let intent: CheckoutIntentRecord = existing;

  if (claimed) {
    intent = claimed as CheckoutIntentRecord;
  } else if (!claimError) {
    const latest = await loadIntentBySessionId(stripeSessionId);
    if (latest?.status === "fulfilled") {
      const orders = await loadOrdersForStripeSession(stripeSessionId);
      return { ok: true, alreadyFulfilled: true, orders };
    }
    if (latest?.status === "processing") {
      return {
        ok: false,
        message: "Siparişiniz hazırlanıyor, lütfen birkaç saniye bekleyin.",
        inProgress: true,
      };
    }
    if (latest?.status === "refunded" || latest?.status === "failed") {
      return {
        ok: false,
        message: latest.fulfillment_error || "Sipariş oluşturma başarısız.",
        refunded: latest.status === "refunded",
      };
    }
    return { ok: false, message: "Checkout intent claim alınamadı." };
  }

  const stripe = getStripe();
  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(stripeSessionId);
  } catch (error) {
    console.error("Webhook: Stripe session retrieve failed:", error);
    await updateIntentStatus(intent.id, "paid", "Stripe oturumu okunamadı.");
    return { ok: false, message: "Stripe oturumu okunamadı." };
  }

  const stripePaid =
    session.status === "complete" &&
    (session.payment_status === "paid" || session.payment_status === "no_payment_required");

  if (!stripePaid) {
    await updateIntentStatus(intent.id, "paid");
    return { ok: false, message: "Ödeme tamamlanmamış." };
  }

  const paidCents = Number(session.amount_total || 0);
  if (paidCents !== intent.total_amount_cents) {
    const msg = `Ödenen tutar (${paidCents}) intent tutarı (${intent.total_amount_cents}) ile uyuşmuyor.`;
    const refund = await refundCheckoutSessionAndCancelOrders(stripeSessionId, msg);
    await updateIntentStatus(
      intent.id,
      refund.refunded ? "refunded" : "failed",
      refund.message
    );
    return { ok: false, message: "Ödeme tutarı sepet ile uyuşmuyor.", refunded: refund.refunded };
  }

  if ((session.currency || "").toLowerCase() !== (intent.currency || "").toLowerCase()) {
    const msg = "Para birimi uyuşmuyor.";
    const refund = await refundCheckoutSessionAndCancelOrders(stripeSessionId, msg);
    await updateIntentStatus(
      intent.id,
      refund.refunded ? "refunded" : "failed",
      refund.message
    );
    return { ok: false, message: msg, refunded: refund.refunded };
  }

  const cart = Array.isArray(intent.cart_json) ? intent.cart_json : [];
  if (cart.length === 0) {
    const msg = "Sepet boş.";
    const refund = await refundCheckoutSessionAndCancelOrders(stripeSessionId, msg);
    await updateIntentStatus(
      intent.id,
      refund.refunded ? "refunded" : "failed",
      refund.message
    );
    return { ok: false, message: msg, refunded: refund.refunded };
  }

  const physicalDelivery: CheckoutPhysicalDelivery =
    intent.delivery_choice === "e_ticket"
      ? "none"
      : parsePhysicalDelivery(intent.delivery_choice);

  const origin = getSiteOrigin();
  const fulfillmentToken = getFulfillmentAuthToken();
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
    if (fulfillmentToken) formData.append("fulfillment_token", fulfillmentToken);
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
    const refund = await refundCheckoutSessionAndCancelOrders(stripeSessionId, msg);
    await updateIntentStatus(
      intent.id,
      refund.refunded ? "refunded" : "failed",
      refund.message
    );
    return {
      ok: false,
      message: refund.refunded
        ? `Sipariş oluşturulamadı; ödeme iade edildi. (${msg})`
        : msg,
      refunded: refund.refunded,
    };
  }

  await updateIntentStatus(intent.id, "fulfilled");
  const orders = await loadOrdersForStripeSession(stripeSessionId);
  return { ok: true, orders };
}
