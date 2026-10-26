import { BrevoClient } from "@getbrevo/brevo";

/** Geliştirmede gerçek e-posta gönderimi engellendiğinde atılır. */
export class OutboundMailDisabled extends Error {}

/**
 * Yalnız production'da Brevo istemcisi verir. Böylece local dev / CI
 * satın almaları canlı müşterilere e-posta atamaz.
 */
export function createBrevoClient(apiKey: string): BrevoClient {
  if (process.env.NODE_ENV !== "production") {
    throw new OutboundMailDisabled(
      "NODE_ENV=production olmadığı için gerçek e-posta gönderimi engellendi."
    );
  }
  return new BrevoClient({ apiKey });
}
