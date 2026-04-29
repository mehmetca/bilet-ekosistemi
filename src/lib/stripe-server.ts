import Stripe from "stripe";

type StripeClient = InstanceType<typeof Stripe>;
let stripeSingleton: StripeClient | null = null;

export function getStripe(): StripeClient {
  if (stripeSingleton) return stripeSingleton;

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    throw new Error("STRIPE_SECRET_KEY is missing.");
  }

  stripeSingleton = new Stripe(stripeSecretKey, {
    apiVersion: "2026-04-22.dahlia",
  });
  return stripeSingleton;
}
