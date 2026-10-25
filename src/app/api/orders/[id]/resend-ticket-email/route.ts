import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { buildTicketMailPayloadForOrder, type TicketMailOrderRow } from "@/lib/order-ticket-mail";
import { canAccessOrder, isTicketIssuedOrder } from "@/lib/order-access";
import { sendTicketEmail } from "@/lib/ticket-email";

export const dynamic = "force-dynamic";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const PER_HOUR_LIMIT = 1;
const PER_DAY_LIMIT = 5;

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: orderId } = await context.params;
  if (!orderId) {
    return NextResponse.json({ error: "Sipariş ID gerekli" }, { status: 400 });
  }

  const auth = await getAuthUser(request);
  if (auth instanceof NextResponse) return auth;
  const { user, supabase } = auth;

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select(
      "id, user_id, buyer_email, buyer_name, event_id, ticket_id, ticket_code, quantity, total_price, status"
    )
    .eq("id", orderId)
    .maybeSingle();

  if (orderError) {
    console.error("resend-ticket-email order lookup error:", orderError);
    return NextResponse.json({ error: "Sipariş okunamadı." }, { status: 500 });
  }
  if (!order) {
    return NextResponse.json({ error: "Sipariş bulunamadı." }, { status: 404 });
  }

  const allowed = await canAccessOrder(supabase, user, order);
  if (!allowed) {
    return NextResponse.json({ error: "Bu sipariş için yetkiniz yok." }, { status: 403 });
  }

  if (!isTicketIssuedOrder(order.status)) {
    return NextResponse.json(
      { error: "Bilet yalnız onaylanmış siparişler için gönderilebilir." },
      { status: 400 }
    );
  }

  const since = new Date(Date.now() - DAY_MS).toISOString();
  const { data: logs, error: logError } = await supabase
    .from("ticket_email_logs")
    .select("sent_at")
    .eq("order_id", orderId)
    .gte("sent_at", since)
    .order("sent_at", { ascending: false });

  if (logError) {
    console.error("resend-ticket-email log lookup error:", logError);
    return NextResponse.json({ error: "Gönderim geçmişi okunamadı." }, { status: 500 });
  }

  const sentTimes = (logs || []).map((row) => new Date(row.sent_at as string).getTime());
  const lastHourCount = sentTimes.filter((t) => Date.now() - t < HOUR_MS).length;

  if (lastHourCount >= PER_HOUR_LIMIT) {
    return NextResponse.json(
      { error: "Bu sipariş için son 1 saat içinde mail gönderildi. Lütfen daha sonra tekrar deneyin." },
      { status: 429 }
    );
  }
  if (sentTimes.length >= PER_DAY_LIMIT) {
    return NextResponse.json(
      { error: "Günlük gönderim sınırına ulaşıldı (5). Yarın tekrar deneyebilirsiniz." },
      { status: 429 }
    );
  }

  const payload = await buildTicketMailPayloadForOrder(supabase, order as TicketMailOrderRow);
  if (!payload.ticketCode) {
    return NextResponse.json(
      { error: "Bu sipariş için bilet kodu bulunamadı." },
      { status: 400 }
    );
  }
  if (!payload.buyerEmail) {
    return NextResponse.json(
      { error: "Siparişte alıcı e-postası yok." },
      { status: 400 }
    );
  }

  const result = await sendTicketEmail(payload);
  if (!result.sent) {
    console.error("resend-ticket-email send failed:", result.reason);
    return NextResponse.json(
      { error: "Mail gönderilemedi. Lütfen tekrar deneyin." },
      { status: 502 }
    );
  }

  const isAdmin = (await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .limit(1)).data?.length;

  const sentAt = new Date().toISOString();
  const { error: insertError } = await supabase.from("ticket_email_logs").insert({
    order_id: orderId,
    sent_by: user.id,
    source: isAdmin ? "admin" : "customer",
    sent_at: sentAt,
  });

  if (insertError) {
    // Mail gitti; log yazılamadıysa kullanıcıya başarı dön ama sunucuda iz bırak.
    console.error("resend-ticket-email log insert error:", insertError);
  }

  return NextResponse.json({
    success: true,
    sentAt,
    lastSentAt: sentAt,
    limit: { perHour: PER_HOUR_LIMIT, perDay: PER_DAY_LIMIT },
  });
}
