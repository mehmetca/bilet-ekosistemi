import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe-server";

type CreateCheckoutBody = {
  amount: number;
  currency?: string;
  buyerEmail?: string;
  locale?: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateCheckoutBody;
    const amount = Number(body.amount || 0);
    const currency = (body.currency || "eur").toLowerCase();
    const buyerEmail = (body.buyerEmail || "").trim();
    const locale = (body.locale || "tr").trim();

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { success: false, message: "Geçersiz ödeme tutarı." },
        { status: 400 }
      );
    }

    const unitAmount = Math.round(amount * 100);
    const origin = request.headers.get("origin") || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      ui_mode: "embedded_page",
      redirect_on_completion: "never",
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency,
            unit_amount: unitAmount,
            product_data: {
              name: "Bilet Siparişi",
              description: "EventSeat test ödeme",
            },
          },
        },
      ],
      customer_email: buyerEmail || undefined,
      payment_method_types: ["card"],
    } as never);

    return NextResponse.json({
      success: true,
      sessionId: session.id,
      clientSecret: session.client_secret,
    });
  } catch (error) {
    const baseErrorPayload =
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
          }
        : { rawError: String(error) };

    if (error instanceof Stripe.errors.StripeConnectionError) {
      console.error("Stripe connection error while creating checkout session:", {
        ...baseErrorPayload,
        type: error.type,
        code: error.code,
        requestId: error.requestId,
      });
      return NextResponse.json(
        {
          success: false,
          message: "Stripe baglantisinda gecici bir sorun olustu. Lutfen birkac saniye sonra tekrar deneyin.",
        },
        { status: 503 }
      );
    }

    if (error instanceof Stripe.errors.StripeAuthenticationError) {
      console.error("Stripe authentication error while creating checkout session:", {
        ...baseErrorPayload,
        type: error.type,
        code: error.code,
        requestId: error.requestId,
      });
      return NextResponse.json(
        {
          success: false,
          message: "Odeme servisi dogrulamasi basarisiz. Lutfen sistem yoneticisiyle iletisime gecin.",
        },
        { status: 500 }
      );
    }

    if (error instanceof Stripe.errors.StripeError) {
      console.error("Stripe checkout session creation failed:", {
        ...baseErrorPayload,
        type: error.type,
        code: error.code,
        requestId: error.requestId,
      });
    } else {
      console.error("Stripe checkout session creation failed:", baseErrorPayload);
    }
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Stripe oturumu oluşturulamadı.",
      },
      { status: 500 }
    );
  }
}
