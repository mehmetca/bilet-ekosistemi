import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseAdmin } from "@/lib/supabase-admin";

/**
 * Fatura (Rechnung) veri katmanı. Tutar hesabı ve numaralandırma veritabanında
 * (151_invoices.sql) yapılır; burada yalnız okuma/yazma sarmalayıcıları durur —
 * iki tarafın farklı oran hesaplaması GoBD açısından belge tutarsızlığı üretir.
 */

export type InvoiceParty = {
  name?: string | null;
  legal_form?: string | null;
  street?: string | null;
  postcode?: string | null;
  city?: string | null;
  country?: string | null;
  /** 153 öncesi kayıtlar için düz metin adres; bileşenler varsa o kullanılır. */
  address?: string | null;
  email?: string | null;
  phone?: string | null;
  vat_id?: string | null;
  tax_id?: string | null;
  register?: string | null;
  register_court?: string | null;
  representative?: string | null;
  logo_path?: string | null;
  kleinunternehmer?: boolean | null;
  user_id?: string | null;
};

export type InvoiceLine = {
  text: string;
  qty: number;
  unit_net: number;
  line_net: number;
  line_tax: number;
  line_gross: number;
  tax_rate: number;
  tax_category: "S" | "E";
};

export type InvoiceRow = {
  id: string;
  invoice_number: string;
  order_id: string;
  event_id: string;
  seller_user_id?: string | null;
  buyer_user_id?: string | null;
  issued_at: string;
  currency: string;
  gross_total: number;
  net_total: number;
  tax_total: number;
  tax_rate: number;
  tax_category: "S" | "E";
  seller_snapshot: InvoiceParty;
  buyer_snapshot: InvoiceParty;
  line_items: InvoiceLine[];
  payment_method?: string | null;
  status: "issued" | "cancelled";
  storno_reason?: string | null;
  created_at?: string;
};

/**
 * `strict:false` (strictNullChecks kapalı) derleniyor → ayrım işaretli birleşim
 * daraltması çalışmıyor (/kontrol için aynı tuzak); alanlar opsiyonel okunur.
 */
export type InvoiceResult = {
  ok: boolean;
  row?: InvoiceRow;
  created?: boolean;
  code?: string;
  message?: string;
};

const INVOICE_COLUMNS =
  "id, invoice_number, order_id, event_id, seller_user_id, buyer_user_id, issued_at, currency, gross_total, net_total, tax_total, tax_rate, tax_category, seller_snapshot, buyer_snapshot, line_items, payment_method, status, storno_reason, created_at";

function asInvoiceRow(value: unknown): InvoiceRow | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (!row.invoice_number) return null;
  return {
    ...(row as unknown as InvoiceRow),
    gross_total: Number(row.gross_total ?? 0),
    net_total: Number(row.net_total ?? 0),
    tax_total: Number(row.tax_total ?? 0),
    tax_rate: Number(row.tax_rate ?? 0),
    seller_snapshot: (row.seller_snapshot ?? {}) as InvoiceParty,
    buyer_snapshot: (row.buyer_snapshot ?? {}) as InvoiceParty,
    line_items: Array.isArray(row.line_items)
      ? (row.line_items as InvoiceLine[]).map((l) => ({
          ...l,
          qty: Number(l.qty ?? 1),
          unit_net: Number(l.unit_net ?? 0),
          line_net: Number(l.line_net ?? 0),
          line_tax: Number(l.line_tax ?? 0),
          line_gross: Number(l.line_gross ?? 0),
          tax_rate: Number(l.tax_rate ?? 0),
        }))
      : [],
  };
}

function rpcError(error: { message?: string } | null, fallback: string): InvoiceResult {
  return { ok: false, code: "rpc", message: error?.message || fallback };
}

export async function issueInvoiceForOrder(
  orderId: string,
  options: { actorUserId?: string; allowedEventIds?: string[] | null } = {},
  admin?: SupabaseClient
): Promise<InvoiceResult> {
  const supabase = admin ?? getSupabaseAdmin();
  const { data, error } = await supabase.rpc("issue_order_invoice", {
    p_order_id: orderId,
    p_actor: options.actorUserId ?? null,
    p_allowed_event_ids: options.allowedEventIds ?? null,
  });
  if (error) return rpcError(error, "Fatura üretilemedi.");

  const payload = (data ?? null) as Record<string, unknown> | null;
  if (!payload) return { ok: false, code: "empty", message: "Fatura üretilemedi." };
  if (payload.error) {
    return {
      ok: false,
      code: String(payload.error),
      message: String(payload.message || "Fatura üretilemedi."),
    };
  }
  const row = asInvoiceRow(payload);
  if (!row) return { ok: false, code: "empty", message: "Fatura satırı okunamadı." };
  return { ok: true, row, created: payload.created !== false };
}

export async function cancelInvoiceById(
  invoiceId: string,
  options: { reason?: string; actorUserId?: string; allowedEventIds?: string[] | null } = {},
  admin?: SupabaseClient
): Promise<InvoiceResult> {
  const supabase = admin ?? getSupabaseAdmin();
  const { data, error } = await supabase.rpc("cancel_invoice", {
    p_invoice_id: invoiceId,
    p_reason: options.reason ?? null,
    p_actor: options.actorUserId ?? null,
    p_allowed_event_ids: options.allowedEventIds ?? null,
  });
  if (error) return rpcError(error, "Fatura iptal edilemedi.");

  const payload = (data ?? null) as Record<string, unknown> | null;
  if (!payload) return { ok: false, code: "empty", message: "Fatura iptal edilemedi." };
  if (payload.error) {
    return {
      ok: false,
      code: String(payload.error),
      message: String(payload.message || "Fatura iptal edilemedi."),
    };
  }
  const row = asInvoiceRow(payload);
  if (!row) return { ok: false, code: "empty", message: "Fatura satırı okunamadı." };
  return { ok: true, row, created: false };
}

export async function getInvoiceByOrder(
  orderId: string,
  admin?: SupabaseClient
): Promise<InvoiceRow | null> {
  const supabase = admin ?? getSupabaseAdmin();
  const { data, error } = await supabase
    .from("invoices")
    .select(INVOICE_COLUMNS)
    .eq("order_id", orderId)
    .maybeSingle();
  if (error) {
    console.error("invoice lookup error:", error);
    return null;
  }
  return asInvoiceRow(data);
}

export async function getInvoiceById(id: string, admin?: SupabaseClient): Promise<InvoiceRow | null> {
  const supabase = admin ?? getSupabaseAdmin();
  const { data, error } = await supabase
    .from("invoices")
    .select(INVOICE_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("invoice lookup error:", error);
    return null;
  }
  return asInvoiceRow(data);
}

export async function listInvoices(
  filter: { eventId?: string; status?: string; from?: string; to?: string; limit?: number } = {},
  admin?: SupabaseClient
): Promise<InvoiceRow[]> {
  const supabase = admin ?? getSupabaseAdmin();
  let query = supabase
    .from("invoices")
    .select(INVOICE_COLUMNS)
    .order("issued_at", { ascending: false })
    .limit(filter.limit ?? 300);

  if (filter.eventId) query = query.eq("event_id", filter.eventId);
  if (filter.status) query = query.eq("status", filter.status);
  if (filter.from) query = query.gte("issued_at", `${filter.from}T00:00:00`);
  if (filter.to) query = query.lte("issued_at", `${filter.to}T23:59:59`);

  const { data, error } = await query;
  if (error) {
    console.error("invoice list error:", error);
    return [];
  }
  return (data ?? []).map((row) => asInvoiceRow(row)).filter((r): r is InvoiceRow => r !== null);
}

export type UninvoicedOrder = {
  id: string;
  event_id: string;
  created_at: string;
  buyer_name?: string | null;
  buyer_email?: string | null;
  quantity: number;
  total_price: number;
  sales_channel?: string | null;
  door_payment?: string | null;
};

/**
 * Faturasız tamamlanmış siparişler: panelde "Fatura kes" satırı için.
 * PostgREST ilişkili sorgusu yerine iki düz sorgu — ilişkilerin adlandırılması
 * şema önbelleğine bağlı, kırılırsa hata sessiz kalır.
 */
export async function listUninvoicedOrders(
  filter: { eventId?: string; limit?: number } = {},
  admin?: SupabaseClient
): Promise<UninvoicedOrder[]> {
  const supabase = admin ?? getSupabaseAdmin();

  let orderQuery = supabase
    .from("orders")
    .select(
      "id, event_id, created_at, buyer_name, buyer_email, quantity, total_price, sales_channel, door_payment"
    )
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit((filter.limit ?? 60) * 3);
  if (filter.eventId) orderQuery = orderQuery.eq("event_id", filter.eventId);

  const { data: orders, error: ordersError } = await orderQuery;
  if (ordersError || !orders?.length) return [];

  const ids = orders.map((o) => o.id as string);
  const { data: invoiced, error: invoicedError } = await supabase
    .from("invoices")
    .select("order_id")
    .in("order_id", ids);
  if (invoicedError) return [];

  const has = new Set((invoiced ?? []).map((row) => row.order_id as string));
  return (orders as unknown as UninvoicedOrder[])
    .filter((o) => !has.has(o.id))
    .slice(0, filter.limit ?? 60);
}

const CURRENCY_SYMBOL: Record<string, string> = { EUR: "€", TL: "₺", USD: "$" };
export function invoiceMoney(value: number, currency = "EUR"): string {
  const amount = Number(value ?? 0).toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${amount} ${CURRENCY_SYMBOL[currency] ?? currency}`;
}

export function invoiceDateDE(value: string | Date | null | undefined): string {
  if (!value) return "-";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
