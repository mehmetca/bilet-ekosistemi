import type { EventCurrency } from "@/types/database";
import { CURRENCY_SYMBOLS } from "@/types/database";

const DEFAULT_CURRENCY: EventCurrency = "EUR";

const LOCALE_MAP: Record<EventCurrency, string> = {
  EUR: "de-DE",
  TL: "tr-TR",
  USD: "en-US",
};

/** Fiyatı para birimi sembolü ile formatlar (tüm diller için) */
export function formatPrice(
  amount: number,
  currency?: EventCurrency | null
): string {
  const curr = currency || DEFAULT_CURRENCY;
  const symbol = CURRENCY_SYMBOLS[curr];
  const locale = LOCALE_MAP[curr];
  return `${symbol}${Number(amount).toLocaleString(locale)}`;
}
