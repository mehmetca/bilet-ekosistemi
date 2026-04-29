import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe-server";

export async function POST(request: NextRequest) {
  try {
    const { sessionId } = (await request.json()) as { sessionId?: string };
    const cleanSessionId = (sessionId || "").trim();

    if (!cleanSessionId) {
      return NextResponse.json({ success: false, message: "sessionId zorunlu." }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.retrieve(cleanSessionId);
    const paid = session.payment_status === "paid";

    return NextResponse.json({
      success: true,
      paid,
      paymentStatus: session.payment_status,
      currency: session.currency,
      amountTotal: session.amount_total,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Stripe oturumu doğrulanamadı.",
      },
      { status: 500 }
    );
  }
}
