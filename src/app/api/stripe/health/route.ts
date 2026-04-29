import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
    publishableKeyConfigured: Boolean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY),
    webhookSecretConfigured: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
  });
}
