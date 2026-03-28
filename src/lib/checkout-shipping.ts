/** Sepet ödemesi: fiziksel gönderim ücretleri (EUR cinsinden tutarlar; para birimi sepetteki etkinlikle gösterilir). */
export type CheckoutPhysicalDelivery = "none" | "standard" | "express";

export const CHECKOUT_SHIPPING_STANDARD_AMOUNT = 3;
export const CHECKOUT_SHIPPING_EXPRESS_AMOUNT = 5;

export function shippingFeeForPhysicalDelivery(mode: CheckoutPhysicalDelivery): number {
  if (mode === "standard") return CHECKOUT_SHIPPING_STANDARD_AMOUNT;
  if (mode === "express") return CHECKOUT_SHIPPING_EXPRESS_AMOUNT;
  return 0;
}

export function parsePhysicalDelivery(raw: string | null | undefined): CheckoutPhysicalDelivery {
  if (raw === "standard" || raw === "express") return raw;
  return "none";
}
