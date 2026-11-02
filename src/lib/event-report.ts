import type { SupabaseClient } from "@supabase/supabase-js";
import { hasExternalTicketLink } from "@/lib/eventMeta";

/**
 * Etkinlik mutabakat raporu veri katmanı.
 * Kaynak: orders (yalnız completed, is_test = false), tickets, invoices, events.
 * Tutarlar rapor üretilirken kuruş hassasiyetinde hesaplanır; fatura tutarlarına dokunulmaz.
 */

export type EventReportSeller = {
  name: string;
  street?: string | null;
  postcode?: string | null;
  city?: string | null;
  country?: string | null;
};

export type EventReportChannel = {
  channel: "online" | "door";
  payment: string | null;
  orders: number;
  tickets: number;
  gross: number;
};

export type EventReportTicketType = {
  name: string;
  price: number;
  tickets: number;
  gross: number;
};

export type EventReportInvoices = {
  issued: number;
  cancelled: number;
  gross: number;
  min: string | null;
  max: string | null;
};

export type EventReportCommission = {
  rate: number;
  gross: number;
  tax: number;
  net: number;
  payout: number;
};

export type EventReportData = {
  event: {
    id: string;
    title: string;
    date: string;
    time: string | null;
    venue: string;
    vatRate: number;
    currency: string;
    seller: EventReportSeller;
  };
  sales: {
    orders: number;
    cancelledOrders: number;
    tickets: number;
    gross: number;
    net: number;
    tax: number;
    periodFrom: string | null;
    periodTo: string | null;
  };
  channels: EventReportChannel[];
  ticketTypes: EventReportTicketType[];
  invoices: EventReportInvoices;
  commissionRate: number | null;
  commission: EventReportCommission | null;
};

export type EventReportSummary = {
  id: string;
  title: string;
  date: string;
  time: string | null;
  venue: string;
  currency: string;
  vatRate: number;
  commissionRate: number | null;
  orders: number;
  tickets: number;
  gross: number;
  invoices: number;
};

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function num(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Supabase varsayılan 1000 satır sınırını aşmamak için sayfa sayfa okur.
 */
async function fetchPaged<T>(
  supabase: SupabaseClient,
  table: string,
  columns: string,
  filter?: { column: string; value: string }
): Promise<T[]> {
  const pageSize = 1000;
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    let query: any = supabase.from(table).select(columns).range(from, from + pageSize - 1);
    if (filter) query = query.eq(filter.column, filter.value);
    const { data, error } = (await query) as { data: unknown; error: { message: string } | null };
    if (error) throw new Error(`${table}: ${error.message}`);
    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

type EventRow = {
  id: string;
  title: string | null;
  date: string | null;
  time: string | null;
  venue: string | null;
  currency: string | null;
  vat_rate_percent: number | string | null;
  seller_user_id: string | null;
  organizer_display_name: string | null;
  commission_rate_percent: number | string | null;
  description?: string | null;
  description_tr?: string | null;
  description_de?: string | null;
  description_en?: string | null;
  description_ku?: string | null;
  description_ckb?: string | null;
};

type OrderRow = {
  id: string;
  event_id?: string | null;
  quantity: number | string | null;
  total_price: number | string | null;
  status: string | null;
  is_test: boolean | null;
  sales_channel: string | null;
  door_payment: string | null;
  ticket_id: string | null;
  created_at: string | null;
};

type TicketRow = { id: string; name: string | null; price: number | string | null };
type InvoiceRow = { invoice_number: string | null; gross_total: number | string | null; status: string | null };

async function resolveSeller(supabase: SupabaseClient, event: EventRow): Promise<EventReportSeller> {
  const displayName = String(event.organizer_display_name || "").trim();
  if (!event.seller_user_id) return { name: displayName || "KurdEvents" };

  const { data } = await supabase
    .from("organizer_requests")
    .select("company_name, street, postcode, city, country_code")
    .eq("user_id", event.seller_user_id)
    .eq("status", "approved")
    .limit(1)
    .maybeSingle();

  const seller = data as
    | { company_name?: string | null; street?: string | null; postcode?: string | null; city?: string | null; country_code?: string | null }
    | null;

  return {
    name: String(seller?.company_name || displayName || "KurdEvents").trim(),
    street: seller?.street || null,
    postcode: seller?.postcode || null,
    city: seller?.city || null,
    country: seller?.country_code || null,
  };
}

function commissionFor(gross: number, rate: number | null): EventReportCommission | null {
  if (rate === null || rate <= 0) return null;
  const commissionGross = round2((gross * rate) / 100);
  const commissionTax = round2((commissionGross * 19) / 119);
  const commissionNet = round2(commissionGross - commissionTax);
  return {
    rate,
    gross: commissionGross,
    tax: commissionTax,
    net: commissionNet,
    payout: round2(gross - commissionGross),
  };
}

export async function loadEventReport(
  supabase: SupabaseClient,
  eventId: string,
  commissionRateOverride?: number | null
): Promise<EventReportData | null> {
  const { data: eventData, error } = await supabase
    .from("events")
    .select(
      "id,title,date,time,venue,currency,vat_rate_percent,seller_user_id,organizer_display_name,commission_rate_percent"
    )
    .eq("id", eventId)
    .maybeSingle();

  if (error) throw new Error(`events: ${error.message}`);
  if (!eventData) return null;
  const event = eventData as EventRow;

  const [orders, tickets, invoices, seller] = await Promise.all([
    fetchPaged<OrderRow>(
      supabase,
      "orders",
      "id,quantity,total_price,status,is_test,sales_channel,door_payment,ticket_id,created_at",
      { column: "event_id", value: eventId }
    ),
    fetchPaged<TicketRow>(supabase, "tickets", "id,name,price", { column: "event_id", value: eventId }),
    fetchPaged<InvoiceRow>(supabase, "invoices", "invoice_number,gross_total,status", {
      column: "event_id",
      value: eventId,
    }),
    resolveSeller(supabase, event),
  ]);

  const completed = orders.filter((order) => !order.is_test && order.status === "completed");
  const cancelled = orders.filter((order) => !order.is_test && order.status === "cancelled");

  const gross = round2(completed.reduce((sum, order) => sum + num(order.total_price), 0));
  const ticketsSold = completed.reduce((sum, order) => sum + num(order.quantity), 0);
  const vatRate = num(event.vat_rate_percent);
  const net = vatRate > 0 ? round2(gross / (1 + vatRate / 100)) : gross;
  const tax = round2(gross - net);

  const ticketNames = new Map<string, { name: string; price: number }>();
  for (const ticket of tickets) {
    ticketNames.set(ticket.id, {
      name: String(ticket.name || "Ticket"),
      price: num(ticket.price),
    });
  }

  const ticketTypeMap = new Map<string, EventReportTicketType>();
  const channelMap = new Map<string, EventReportChannel>();
  for (const order of completed) {
    const ticket = order.ticket_id ? ticketNames.get(order.ticket_id) : undefined;
    const key = order.ticket_id || "unknown";
    const existing = ticketTypeMap.get(key) || {
      name: ticket?.name || "Ticket",
      price: ticket?.price || 0,
      tickets: 0,
      gross: 0,
    };
    existing.tickets += num(order.quantity);
    existing.gross = round2(existing.gross + num(order.total_price));
    ticketTypeMap.set(key, existing);

    const channel = order.sales_channel === "door" ? "door" : "online";
    const payment = channel === "door" ? order.door_payment || null : null;
    const channelKey = `${channel}|${payment || ""}`;
    const channelRow = channelMap.get(channelKey) || {
      channel,
      payment,
      orders: 0,
      tickets: 0,
      gross: 0,
    };
    channelRow.orders += 1;
    channelRow.tickets += num(order.quantity);
    channelRow.gross = round2(channelRow.gross + num(order.total_price));
    channelMap.set(channelKey, channelRow);
  }

  const createdTimes = completed
    .map((order) => order.created_at)
    .filter((value): value is string => Boolean(value))
    .sort();

  const issuedInvoices = invoices.filter((invoice) => invoice.status !== "cancelled");
  const invoiceNumbers = issuedInvoices
    .map((invoice) => String(invoice.invoice_number || ""))
    .filter(Boolean)
    .sort();

  const storedRate =
    event.commission_rate_percent === null || event.commission_rate_percent === undefined
      ? null
      : num(event.commission_rate_percent);
  const commissionRate = commissionRateOverride === undefined ? storedRate : commissionRateOverride;

  return {
    event: {
      id: event.id,
      title: String(event.title || "Veranstaltung"),
      date: String(event.date || ""),
      time: event.time || null,
      venue: String(event.venue || ""),
      vatRate,
      currency: String(event.currency || "EUR"),
      seller,
    },
    sales: {
      orders: completed.length,
      cancelledOrders: cancelled.length,
      tickets: ticketsSold,
      gross,
      net,
      tax,
      periodFrom: createdTimes[0] || null,
      periodTo: createdTimes[createdTimes.length - 1] || null,
    },
    channels: [...channelMap.values()].sort((a, b) => (a.channel === b.channel ? 0 : a.channel === "online" ? -1 : 1)),
    ticketTypes: [...ticketTypeMap.values()].sort((a, b) => b.price - a.price),
    invoices: {
      issued: issuedInvoices.length,
      cancelled: invoices.length - issuedInvoices.length,
      gross: round2(issuedInvoices.reduce((sum, invoice) => sum + num(invoice.gross_total), 0)),
      min: invoiceNumbers[0] || null,
      max: invoiceNumbers[invoiceNumbers.length - 1] || null,
    },
    commissionRate,
    commission: commissionFor(gross, commissionRate),
  };
}

export async function loadEventReportSummaries(supabase: SupabaseClient): Promise<EventReportSummary[]> {
  const [events, orders, invoices] = await Promise.all([
    fetchPaged<EventRow>(
      supabase,
      "events",
      "id,title,date,time,venue,currency,vat_rate_percent,seller_user_id,organizer_display_name,commission_rate_percent,description,description_tr,description_de,description_en,description_ku,description_ckb"
    ),
    fetchPaged<OrderRow>(supabase, "orders", "id,quantity,total_price,status,is_test,sales_channel,door_payment,ticket_id,created_at,event_id"),
    fetchPaged<InvoiceRow & { event_id: string | null }>(supabase, "invoices", "invoice_number,gross_total,status,event_id"),
  ]);

  const orderAgg = new Map<string, { orders: number; tickets: number; gross: number }>();
  for (const order of orders) {
    if (order.is_test || order.status !== "completed" || !order.id) continue;
    const eventId = order.event_id;
    if (!eventId) continue;
    const agg = orderAgg.get(eventId) || { orders: 0, tickets: 0, gross: 0 };
    agg.orders += 1;
    agg.tickets += num(order.quantity);
    agg.gross = round2(agg.gross + num(order.total_price));
    orderAgg.set(eventId, agg);
  }

  const invoiceAgg = new Map<string, number>();
  for (const invoice of invoices) {
    if (!invoice.event_id || invoice.status === "cancelled") continue;
    invoiceAgg.set(invoice.event_id, (invoiceAgg.get(invoice.event_id) || 0) + 1);
  }

  // Dış bilet linki olan etkinliklerde satış başka sitede yapılır; rapor üretilemez.
  return events
    .filter(
      (event) =>
        !hasExternalTicketLink(
          event.description,
          event.description_tr,
          event.description_de,
          event.description_en,
          event.description_ku,
          event.description_ckb
        )
    )
    .map((event) => {
      const agg = orderAgg.get(event.id) || { orders: 0, tickets: 0, gross: 0 };
      return {
        id: event.id,
        title: String(event.title || "Veranstaltung"),
        date: String(event.date || ""),
        time: event.time || null,
        venue: String(event.venue || ""),
        currency: String(event.currency || "EUR"),
        vatRate: num(event.vat_rate_percent),
        commissionRate:
          event.commission_rate_percent === null || event.commission_rate_percent === undefined
            ? null
            : num(event.commission_rate_percent),
        orders: agg.orders,
        tickets: agg.tickets,
        gross: agg.gross,
        invoices: invoiceAgg.get(event.id) || 0,
      };
    })
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

export async function saveCommissionRate(
  supabase: SupabaseClient,
  eventId: string,
  rate: number | null
): Promise<void> {
  const { error } = await supabase
    .from("events")
    .update({ commission_rate_percent: rate })
    .eq("id", eventId);
  if (error) throw new Error(error.message);
}

/**
 * İstek gövdesindeki komisyon oranı: value === undefined → istekte yok, mevcut değer korunur;
 * null → temizle; sayı → 0..100 arası, iki ondalık.
 */
export function parseCommissionRate(raw: unknown): { valid: boolean; value?: number | null } {
  if (raw === undefined) return { valid: true };
  if (raw === null || raw === "") return { valid: true, value: null };
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) return { valid: false };
  return { valid: true, value: Math.round(parsed * 100) / 100 };
}

/** Dosya adı ASCII: mail istemcileri ve tarayıcılar umlautlu ekleri sorunsuz taşısın. */
export function eventReportFileName(data: EventReportData): string {
  const slug =
    `${data.event.title}`
      .replace(/ı/g, "i")
      .replace(/İ/g, "I")
      .replace(/ş/g, "s")
      .replace(/Ş/g, "S")
      .replace(/ğ/g, "g")
      .replace(/Ğ/g, "G")
      .replace(/ü/g, "ue")
      .replace(/Ü/g, "Ue")
      .replace(/ö/g, "oe")
      .replace(/Ö/g, "Oe")
      .replace(/ä/g, "ae")
      .replace(/Ä/g, "Ae")
      .replace(/ß/g, "ss")
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "Veranstaltung";
  const date = String(data.event.date || "").slice(0, 10);
  return `Veranstaltungsabrechnung-${slug}${date ? `-${date}` : ""}.pdf`;
}
