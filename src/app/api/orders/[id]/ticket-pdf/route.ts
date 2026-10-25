import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { buildTicketMailPayloadForOrder, type TicketMailOrderRow } from "@/lib/order-ticket-mail";
import { canAccessOrder } from "@/lib/order-access";
import { buildTicketPdfMultiPageBase64 } from "@/lib/ticket-email";

export const dynamic = "force-dynamic";

export async function GET(
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
    .select("id, user_id, buyer_email, buyer_name, event_id, ticket_id, ticket_code, quantity, total_price, status")
    .eq("id", orderId)
    .maybeSingle();

  if (orderError) {
    console.error("ticket-pdf order lookup error:", orderError);
    return NextResponse.json({ error: "Sipariş okunamadı." }, { status: 500 });
  }
  if (!order) {
    return NextResponse.json({ error: "Sipariş bulunamadı." }, { status: 404 });
  }

  const allowed = await canAccessOrder(supabase, user, order);
  if (!allowed) {
    return NextResponse.json({ error: "Bu sipariş için yetkiniz yok." }, { status: 403 });
  }

  const payload = await buildTicketMailPayloadForOrder(supabase, order as TicketMailOrderRow);
  if (!payload.ticketCode) {
    return NextResponse.json(
      { error: "Bu sipariş için bilet kodu bulunamadı." },
      { status: 400 }
    );
  }

  const pdfBase64 = await buildTicketPdfMultiPageBase64(payload);
  const pdfBuffer = Buffer.from(pdfBase64, "base64");
  const fileName = `kurdevents-e-bilet-${orderId.slice(0, 8)}.pdf`;

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
