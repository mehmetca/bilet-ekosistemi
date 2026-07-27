import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-ssr";
import {
  computeCheckoutCartPricing,
  type CheckoutCartLineInput,
} from "@/lib/checkout-cart-pricing";
import {
  type CheckoutPhysicalDelivery,
} from "@/lib/checkout-shipping";
import { CHECKOUT_HOLD_SECONDS } from "@/lib/cart-reservation";

export const runtime = "nodejs";

type CreateCheckoutBody = {
  /** @deprecated Güvenlik: yok sayılır; sunucu sepetten hesaplar */
  amount?: number;
  currency?: string;
  buyerEmail?: string;
  buyerName?: string;
  buyerAddress?: string;
  buyerPlz?: string;
  buyerCity?: string;
  locale?: string;
  deliveryChoice?: CheckoutPhysicalDelivery | "e_ticket" | "standard" | "express";
  seatHoldSessionId?: string | null;
  items?: CheckoutCartLineInput[];
};

function normalizeDeliveryChoice(raw: string | undefined): CheckoutPhysicalDelivery | "e_ticket" {
  if (raw === "standard" || raw === "express") return raw;
  return "e_ticket";
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateCheckoutBody;
    const buyerEmail = (body.buyerEmail || "").trim();
    const buyerName = (body.buyerName || "").trim();
    const buyerAddress = (body.buyerAddress || "").trim();
    const buyerPlz = (body.buyerPlz || "").trim();
    const buyerCity = (body.buyerCity || "").trim();
    const locale = (body.locale || "tr").trim();
    const deliveryRaw = normalizeDeliveryChoice(body.deliveryChoice);
    const physicalDelivery: CheckoutPhysicalDelivery =
      deliveryRaw === "e_ticket" ? "none" : deliveryRaw;
    const seatHoldSessionId = (body.seatHoldSessionId || "").trim() || null;
    const items = Array.isArray(body.items) ? body.items : [];

    if (!buyerEmail) {
      return NextResponse.json(
        { success: false, message: "E-posta adresi zorunludur." },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(buyerEmail)) {
      return NextResponse.json(
        { success: false, message: "Geçerli bir e-posta adresi girin." },
        { status: 400 }
      );
    }

    if (physicalDelivery !== "none") {
      if (!buyerAddress || !buyerPlz || !buyerCity) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Basılı bilet gönderimi için adres, posta kodu ve şehir alanlarının tamamı zorunludur.",
          },
          { status: 400 }
        );
      }
    }

    let userId: string | null = null;
    const authHeader = request.headers.get("authorization");
    const bearer = authHeader?.replace(/^Bearer\s+/i, "").trim();
    const supabaseAdmin = getSupabaseAdmin();

    if (bearer) {
      const {
        data: { user },
      } = await supabaseAdmin.auth.getUser(bearer);
      if (user?.id) userId = user.id;
    }
    if (!userId) {
      try {
        const serverAuth = await createSupabaseServerClient();
        const {
          data: { user },
        } = await serverAuth.auth.getUser();
        if (user?.id) userId = user.id;
      } catch {
        /* ignore */
      }
    }

    if (!userId) {
      return NextResponse.json(
        { success: false, message: "Ödeme için giriş yapmanız gerekiyor." },
        { status: 401 }
      );
    }

    const pricing = await computeCheckoutCartPricing(supabaseAdmin, items, physicalDelivery);
    if (pricing.ok === false) {
      return NextResponse.json(
        { success: false, message: pricing.message },
        { status: pricing.status }
      );
    }

    const priced = pricing;

    // Checkout süresince koltuk hold’larını uzat (ödeme ekranı > sepet rezervasyonu)
    const seatIdsToExtend = [
      ...new Set(
        priced.lines.flatMap((line) => (Array.isArray(line.seatIds) ? line.seatIds : []))
      ),
    ];
    if (seatIdsToExtend.length > 0) {
      const eventIds = [...new Set(priced.lines.map((l) => l.eventId))];
      for (const eventId of eventIds) {
        const seatsForEvent = priced.lines
          .filter((l) => l.eventId === eventId)
          .flatMap((l) => l.seatIds || []);
        for (const seatId of [...new Set(seatsForEvent)]) {
          const { error: holdError } = await supabaseAdmin.rpc("hold_seat", {
            p_event_id: eventId,
            p_seat_id: seatId,
            p_user_id: userId,
            p_session_id: userId ? null : seatHoldSessionId,
            p_hold_seconds: CHECKOUT_HOLD_SECONDS,
          });
          if (holdError) {
            console.error("Checkout hold extend failed:", holdError, { eventId, seatId });
          }
        }
      }
    }

    const { data: intentRow, error: intentError } = await supabaseAdmin
      .from("stripe_checkout_intents")
      .insert({
        user_id: userId,
        buyer_email: buyerEmail,
        buyer_name: buyerName || null,
        buyer_address: buyerAddress || null,
        buyer_plz: buyerPlz || null,
        buyer_city: buyerCity || null,
        delivery_choice: deliveryRaw,
        seat_hold_session_id: seatHoldSessionId,
        cart_json: items,
        total_amount_cents: priced.grandTotalCents,
        currency: priced.currency,
        status: "pending",
      })
      .select("id")
      .single();

    if (intentError || !intentRow?.id) {
      console.error("Checkout intent insert failed:", intentError);
      return NextResponse.json(
        { success: false, message: "Ödeme oturumu kaydı oluşturulamadı." },
        { status: 500 }
      );
    }

    const intentId = intentRow.id as string;
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      ui_mode: "embedded_page",
      redirect_on_completion: "never",
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: priced.currency,
            unit_amount: priced.grandTotalCents,
            product_data: {
              name: "Bilet Siparişi",
              description: `${items.length} kalem — KurdEvents`,
            },
          },
        },
      ],
      customer_email: buyerEmail,
      payment_method_types: ["card"],
      metadata: {
        checkout_intent_id: intentId,
        user_id: userId,
        locale,
      },
    } as never);

    const { error: linkError } = await supabaseAdmin
      .from("stripe_checkout_intents")
      .update({
        stripe_session_id: session.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", intentId);

    if (linkError) {
      console.error("Checkout intent session link failed:", linkError);
      return NextResponse.json(
        { success: false, message: "Ödeme oturumu bağlantısı kurulamadı." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      sessionId: session.id,
      clientSecret: session.client_secret,
      amount: priced.grandTotal,
      currency: priced.currency,
    });
  } catch (error) {
    const baseErrorPayload =
      error instanceof Error
        ? { name: error.name, message: error.message }
        : { rawError: String(error) };

    if (error instanceof Stripe.errors.StripeConnectionError) {
      console.error("Stripe connection error while creating checkout session:", baseErrorPayload);
      return NextResponse.json(
        {
          success: false,
          message:
            "Stripe baglantisinda gecici bir sorun olustu. Lutfen birkac saniye sonra tekrar deneyin.",
        },
        { status: 503 }
      );
    }

    if (error instanceof Stripe.errors.StripeAuthenticationError) {
      console.error("Stripe authentication error while creating checkout session:", baseErrorPayload);
      return NextResponse.json(
        {
          success: false,
          message: "Odeme servisi dogrulamasi basarisiz. Lutfen sistem yoneticisiyle iletisime gecin.",
        },
        { status: 500 }
      );
    }

    console.error("Stripe checkout session creation failed:", baseErrorPayload);
    return NextResponse.json(
      {
        success: false,
        message:
          process.env.NODE_ENV === "production"
            ? "Stripe oturumu oluşturulamadı."
            : error instanceof Error
              ? error.message
              : "Stripe oturumu oluşturulamadı.",
      },
      { status: 500 }
    );
  }
}
