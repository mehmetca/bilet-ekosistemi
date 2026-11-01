import { issueInvoiceForOrder } from "@/lib/invoice";
import { buildInvoicePdf } from "@/lib/invoice-pdf";

export type InvoiceMailAttachment = { number: string; base64: string };

/**
 * Bilet mailiyle gönderilecek Rechnung'u üretir. Satıcı eksikse fatura kesilmez
 * ama bilet gönderimi de durmaz; o sipariş paneldeki "faturasız siparişler"
 * listesinde kalır ve sonradan elle kesilebilir.
 */
export async function buildInvoiceMailAttachment(
  orderId?: string | null
): Promise<InvoiceMailAttachment | null> {
  if (!orderId) return null;
  try {
    const issued = await issueInvoiceForOrder(orderId);
    if (!issued.ok || !issued.row) {
      if (issued.code !== "test_order") {
        console.warn(
          "[invoice] otomatik fatura kesilmedi:",
          orderId,
          issued.code,
          issued.message
        );
      }
      return null;
    }
    const bytes = await buildInvoicePdf(issued.row);
    return { number: issued.row.invoice_number, base64: Buffer.from(bytes).toString("base64") };
  } catch (error) {
    console.error("[invoice] otomatik fatura üretimi:", orderId, error);
    return null;
  }
}
