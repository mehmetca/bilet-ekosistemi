import type { SupabaseClient } from "@supabase/supabase-js";
import {
  shippingFeeForPhysicalDelivery,
  type CheckoutPhysicalDelivery,
} from "@/lib/checkout-shipping";
import { isEventPubliclyVisible } from "@/lib/event-visibility";

export type CheckoutCartLineInput = {
  ticketId: string;
  quantity: number;
  seatIds?: string[];
  includeProcessingFee?: boolean;
};

export type ValidatedCheckoutCartLine = {
  ticketId: string;
  quantity: number;
  seatIds: string[];
  includeProcessingFee: boolean;
  unitPrice: number;
  lineSubtotal: number;
  lineProcessingFee: number;
  eventId: string;
  currency: string;
};

export type CheckoutCartPricingResult =
  | {
      ok: true;
      currency: string;
      subtotal: number;
      processingFeesTotal: number;
      shippingFee: number;
      grandTotal: number;
      grandTotalCents: number;
      lines: ValidatedCheckoutCartLine[];
    }
  | { ok: false; message: string; status: number };

async function readMaxTicketQuantity(supabase: SupabaseClient): Promise<number> {
  try {
    const { data: settingsRow } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "max_ticket_quantity")
      .maybeSingle();
    if (settingsRow && typeof (settingsRow as { value?: number }).value === "number") {
      return Math.max(1, Math.min(100, (settingsRow as { value: number }).value));
    }
  } catch {
    /* varsayılan */
  }
  return 10;
}

export async function computeCheckoutCartPricing(
  supabase: SupabaseClient,
  items: CheckoutCartLineInput[],
  deliveryChoice: CheckoutPhysicalDelivery
): Promise<CheckoutCartPricingResult> {
  if (!items.length) {
    return { ok: false, message: "Sepet boş.", status: 400 };
  }

  const maxTicketQuantity = await readMaxTicketQuantity(supabase);
  let cartQtyTotal = 0;
  const ticketIds = [...new Set(items.map((i) => i.ticketId))];

  const { data: ticketRows, error: ticketError } = await supabase
    .from("tickets")
    .select("id, price, available, event_id, description")
    .in("id", ticketIds);

  if (ticketError || !ticketRows?.length) {
    return { ok: false, message: "Bilet bilgileri alınamadı.", status: 404 };
  }

  const ticketById = new Map(ticketRows.map((t) => [t.id, t]));
  const eventIds = [...new Set(ticketRows.map((t) => t.event_id))];

  const { data: eventRows, error: eventError } = await supabase
    .from("events")
    .select("id, is_active, is_approved, is_draft, checkout_processing_fee, currency")
    .in("id", eventIds);

  if (eventError || !eventRows?.length) {
    return { ok: false, message: "Etkinlik bilgileri alınamadı.", status: 404 };
  }

  const eventById = new Map(eventRows.map((e) => [e.id, e]));
  const lines: ValidatedCheckoutCartLine[] = [];
  let currency: string | null = null;

  for (const item of items) {
    const ticket = ticketById.get(item.ticketId);
    if (!ticket) {
      return { ok: false, message: "Sepette geçersiz bilet bulundu.", status: 400 };
    }

    const eventRow = eventById.get(ticket.event_id);
    if (!eventRow || !isEventPubliclyVisible(eventRow)) {
      return { ok: false, message: "Sepette satışa kapalı etkinlik var.", status: 403 };
    }

    const eventCurrency = String(
      (eventRow as { currency?: string | null }).currency || "EUR"
    ).toLowerCase();
    if (!currency) currency = eventCurrency;
    if (currency !== eventCurrency) {
      return {
        ok: false,
        message: "Sepette farklı para birimlerinde etkinlikler birleştirilemez.",
        status: 400,
      };
    }

    const seatIds = Array.isArray(item.seatIds)
      ? item.seatIds.filter((id): id is string => typeof id === "string" && id.length > 0)
      : [];
    const uniqueSeatIds = [...new Set(seatIds)];
    if (uniqueSeatIds.length !== seatIds.length) {
      return { ok: false, message: "Aynı koltuk sepette tekrar ediyor.", status: 400 };
    }

    const quantity =
      uniqueSeatIds.length > 0
        ? uniqueSeatIds.length
        : Math.max(1, Math.floor(Number(item.quantity) || 0));

    if (uniqueSeatIds.length > 0 && uniqueSeatIds.length !== Math.floor(Number(item.quantity) || 0)) {
      return { ok: false, message: "Koltuk sayısı ile adet uyuşmuyor.", status: 400 };
    }

    cartQtyTotal += quantity;
    if (cartQtyTotal > maxTicketQuantity) {
      return {
        ok: false,
        message: `Sipariş başına en fazla ${maxTicketQuantity} bilet alabilirsiniz.`,
        status: 400,
      };
    }

    const desc = (ticket.description || "").toString();
    const minAdetMatch = desc.match(/Min\.\s*(\d+)\s*adet/i);
    const minQuantity = minAdetMatch ? Math.max(1, parseInt(minAdetMatch[1], 10)) : 1;
    if (quantity < minQuantity) {
      return {
        ok: false,
        message: `Bu bilet türünden en az ${minQuantity} adet alınmalıdır.`,
        status: 400,
      };
    }

    if (Number(ticket.available || 0) < quantity) {
      return {
        ok: false,
        message: `Yetersiz stok (${ticket.id}). Kalan: ${ticket.available || 0}`,
        status: 400,
      };
    }

    const unitPrice = Number(ticket.price) || 0;
    if (unitPrice <= 0) {
      return { ok: false, message: "Geçersiz bilet fiyatı.", status: 400 };
    }

    const serverProcessingFee = Math.max(
      0,
      Number((eventRow as { checkout_processing_fee?: number | string | null }).checkout_processing_fee) ||
        0
    );
    const includeProcessingFee =
      Boolean(item.includeProcessingFee) && serverProcessingFee > 0;
    const lineProcessingFee = includeProcessingFee ? serverProcessingFee * quantity : 0;
    const lineSubtotal = unitPrice * quantity;

    lines.push({
      ticketId: item.ticketId,
      quantity,
      seatIds: uniqueSeatIds,
      includeProcessingFee,
      unitPrice,
      lineSubtotal,
      lineProcessingFee,
      eventId: ticket.event_id,
      currency: eventCurrency,
    });
  }

  const subtotal = lines.reduce((sum, l) => sum + l.lineSubtotal, 0);
  const processingFeesTotal = lines.reduce((sum, l) => sum + l.lineProcessingFee, 0);
  const shippingFee = shippingFeeForPhysicalDelivery(deliveryChoice);
  const grandTotal = subtotal + processingFeesTotal + shippingFee;
  const grandTotalCents = Math.round(grandTotal * 100);

  if (grandTotalCents <= 0) {
    return { ok: false, message: "Geçersiz ödeme tutarı.", status: 400 };
  }

  return {
    ok: true,
    currency: currency || "eur",
    subtotal,
    processingFeesTotal,
    shippingFee,
    grandTotal,
    grandTotalCents,
    lines,
  };
}
