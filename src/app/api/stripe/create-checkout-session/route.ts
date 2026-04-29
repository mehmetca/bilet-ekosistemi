import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe-server";

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

    const session = await stripe.checkout.sessions.create({
      ui_mode: "embedded",
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
    });

    return NextResponse.json({
      success: true,
      sessionId: session.id,
      clientSecret: session.client_secret,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Stripe oturumu oluşturulamadı.",
      },
      { status: 500 }
    );
  }
}
