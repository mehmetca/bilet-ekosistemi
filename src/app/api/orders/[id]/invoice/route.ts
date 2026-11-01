import { NextRequest, NextResponse } from "next/server";
import { getAuthUserWithSession } from "@/lib/api-auth";
import { canAccessOrder } from "@/lib/order-access";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getInvoiceByOrder } from "@/lib/invoice";
import { buildInvoicePdf } from "@/lib/invoice-pdf";
import { buildXRechnungXml } from "@/lib/invoice-xrechnung";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Fatura belgesi indirme: GET /api/orders/[id]/invoice/?format=pdf|xrechnung
 * Okuma tarafı bilet PDF'iyle aynı kapıdan geçer (müşteri kendi, personel yetkisi).
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await context.params;
    if (!orderId) {
      return NextResponse.json({ error: "Sipariş ID gerekli" }, { status: 400 });
    }

    const auth = await getAuthUserWithSession(request);
    if (auth instanceof NextResponse) return auth;
    const { user, supabase } = auth;

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, user_id, buyer_email, event_id, status, sales_channel, sold_by")
      .eq("id", orderId)
      .maybeSingle();

    if (orderError) {
      return NextResponse.json({ error: "Sipariş okunamadı." }, { status: 500 });
    }
    if (!order) {
      return NextResponse.json({ error: "Sipariş bulunamadı." }, { status: 404 });
    }
    if (!(await canAccessOrder(supabase, user, order))) {
      return NextResponse.json({ error: "Bu sipariş için yetkiniz yok." }, { status: 403 });
    }

    const invoice = await getInvoiceByOrder(orderId, getSupabaseAdmin());
    if (!invoice) {
      return NextResponse.json(
        { success: false, code: "not_issued", message: "Bu sipariş için fatura henüz kesilmemiş." },
        { status: 404 }
      );
    }

    const format = (request.nextUrl.searchParams.get("format") || "pdf").toLowerCase();

    if (format === "xrechnung" || format === "xml") {
      const xml = buildXRechnungXml(invoice);
      return new NextResponse(xml, {
        status: 200,
        headers: {
          "Content-Type": "application/xml; charset=utf-8",
          "Content-Disposition": `attachment; filename="${invoice.invoice_number}.xml"`,
          "Cache-Control": "no-store",
        },
      });
    }
    if (format !== "pdf") {
      return NextResponse.json({ error: "Bilinmeyen biçim." }, { status: 400 });
    }

    const bytes = await buildInvoicePdf(invoice);
    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${invoice.invoice_number}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("invoice document API error:", error);
    return NextResponse.json({ error: "Fatura belgesi üretilemedi." }, { status: 500 });
  }
}
