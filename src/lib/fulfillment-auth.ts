/** Purchase route yalnızca sunucu fulfillment çağrılarını kabul eder. */
export function getFulfillmentAuthToken(): string {
  return (
    process.env.INTERNAL_FULFILLMENT_SECRET?.trim() ||
    process.env.STRIPE_WEBHOOK_SECRET?.trim() ||
    process.env.STRIPE_SECRET_KEY?.trim() ||
    ""
  );
}
