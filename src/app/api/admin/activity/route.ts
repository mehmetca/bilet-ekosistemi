import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

type ActivityKind =
  | "order"
  | "door"
  | "checkin"
  | "mail"
  | "invoice"
  | "user"
  | "organizer"
  | "controller"
  | "admin";

type ActivityItem = {
  id: string;
  kind: ActivityKind;
  at: string;
  title: string;
  detail?: string | null;
  amount?: number | null;
  eventId?: string | null;
  isTest?: boolean;
};

const LIMIT = 60;

/**
 * Yönetim "canlı akış": sitede olan her şeyi tek listede toplar
 * (sipariş, gişe, giriş taraması, mail, fatura, üyelik, başvuru, yönetici işlemi).
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const supabase = getSupabaseAdmin();
  const items: ActivityItem[] = [];

  const [orders, mails, invoices, profiles, organizers, controllers, audits] =
    await Promise.all([
      supabase
        .from("orders")
        .select(
          "id,event_id,quantity,total_price,buyer_name,buyer_email,status,is_test,sales_channel,created_at,events(title)"
        )
        .order("created_at", { ascending: false })
        .limit(LIMIT),
      supabase
        .from("ticket_email_logs")
        .select("id,order_id,sent_at,source")
        .order("sent_at", { ascending: false })
        .limit(LIMIT),
      supabase
        .from("invoices")
        .select("id,invoice_number,gross_total,status,issued_at,event_id")
        .order("issued_at", { ascending: false })
        .limit(LIMIT),
      supabase
        .from("user_profiles")
        .select("id,user_id,email,first_name,last_name,kundennummer,created_at")
        .order("created_at", { ascending: false })
        .limit(LIMIT),
      supabase
        .from("organizer_requests")
        .select("id,email,company_name,status,created_at,approved_at")
        .order("created_at", { ascending: false })
        .limit(LIMIT),
      supabase
        .from("controller_requests")
        .select("id,email,full_name,status,created_at")
        .order("created_at", { ascending: false })
        .limit(LIMIT),
      supabase
        .from("audit_logs")
        .select("id,user_email,action,entity_type,entity_id,details,created_at")
        .order("created_at", { ascending: false })
        .limit(LIMIT),
    ]);

  type OrderRow = {
    id: string;
    event_id: string | null;
    quantity: number | null;
    total_price: number | null;
    buyer_name: string | null;
    buyer_email?: string | null;
    status: string | null;
    is_test: boolean | null;
    sales_channel?: string | null;
    door_payment?: string | null;
    created_at: string | null;
    events?: { title?: string | null } | null;
  };

  for (const row of (orders.data || []) as OrderRow[]) {
    if (!row.created_at) continue;
    const title = row.events?.title || "Etkinlik";
    const doorSale = row.sales_channel === "door";
    items.push({
      id: `order-${row.id}`,
      kind: doorSale ? "door" : "order",
      at: row.created_at,
      title: `${doorSale ? "Gişe satışı" : "Yeni sipariş"}: ${title}`,
      detail: `${row.buyer_name || row.buyer_email || "—"} · ${row.quantity || 1} bilet · ${
        row.status || "-"
      }`,
      amount: row.total_price === null ? null : Number(row.total_price),
      eventId: row.event_id,
      isTest: Boolean(row.is_test),
    });
  }

  for (const row of (mails.data || []) as Array<{
    id: string;
    order_id: string;
    sent_at: string | null;
    source: string | null;
  }>) {
    if (!row.sent_at) continue;
    items.push({
      id: `mail-${row.id}`,
      kind: "mail",
      at: row.sent_at,
      title: "Bilet e-postası gönderildi",
      detail: `Kaynak: ${row.source || "purchase"} · Sipariş: ${String(row.order_id).slice(0, 8)}`,
    });
  }

  for (const row of (invoices.data || []) as Array<{
    id: string;
    invoice_number: string | null;
    gross_total: number | null;
    status: string | null;
    issued_at: string | null;
    event_id: string | null;
  }>) {
    if (!row.issued_at) continue;
    items.push({
      id: `invoice-${row.id}`,
      kind: "invoice",
      at: row.issued_at,
      title: `Fatura ${row.invoice_number || ""}`.trim(),
      detail: row.status === "cancelled" ? "Storno edildi" : "Kesildi",
      amount: row.gross_total === null ? null : Number(row.gross_total),
      eventId: row.event_id,
    });
  }

  for (const row of (profiles.data || []) as Array<{
    id: string;
    email: string | null;
    first_name: string | null;
    last_name: string | null;
    kundennummer: string | null;
    created_at: string | null;
  }>) {
    if (!row.created_at) continue;
    items.push({
      id: `profile-${row.id}`,
      kind: "user",
      at: row.created_at,
      title: "Yeni üye",
      detail: [row.first_name, row.last_name].filter(Boolean).join(" ") || row.email || "—",
    });
  }

  for (const row of (organizers.data || []) as Array<{
    id: string;
    email: string | null;
    company_name: string | null;
    status: string | null;
    created_at: string | null;
    approved_at: string | null;
  }>) {
    if (row.created_at) {
      items.push({
        id: `org-new-${row.id}`,
        kind: "organizer",
        at: row.created_at,
        title: "Organizatör başvurusu",
        detail: `${row.company_name || row.email || "—"} · ${row.status || "pending"}`,
      });
    }
    if (row.approved_at) {
      items.push({
        id: `org-approved-${row.id}`,
        kind: "organizer",
        at: row.approved_at,
        title: "Organizatör onaylandı",
        detail: row.company_name || row.email || "—",
      });
    }
  }

  for (const row of (controllers.data || []) as Array<{
    id: string;
    email: string | null;
    full_name: string | null;
    status: string | null;
    created_at: string | null;
  }>) {
    if (!row.created_at) continue;
    items.push({
      id: `controller-${row.id}`,
      kind: "controller",
      at: row.created_at,
      title: "Kontrolör başvurusu",
      detail: `${row.full_name || row.email || "—"} · ${row.status || "pending"}`,
    });
  }

  for (const row of (audits.data || []) as Array<{
    id: string;
    user_email: string | null;
    action: string;
    entity_type: string;
    entity_id: string | null;
    created_at: string | null;
  }>) {
    if (!row.created_at) continue;
    items.push({
      id: `audit-${row.id}`,
      kind: "admin",
      at: row.created_at,
      title: `Yönetici işlemi: ${row.action}`,
      detail: `${row.entity_type}${row.entity_id ? ` · ${String(row.entity_id).slice(0, 8)}` : ""}${
        row.user_email ? ` · ${row.user_email}` : ""
      }`,
    });
  }

  items.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));

  return NextResponse.json({ items: items.slice(0, 120) });
}
