import { NextRequest, NextResponse } from 'next/server';
import { createClient } from "@supabase/supabase-js";
import QRCode from "qrcode";
import bwipjs from "bwip-js";
import { PDFDocument, PDFPage, StandardFonts, degrees, rgb } from "pdf-lib";

function generateTicketCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "BLT-";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

type TicketMailPayload = {
  buyerEmail: string;
  buyerName: string;
  ticketCode: string;
  quantity: number;
  ticketType: string;
  totalPrice: number;
  eventTitle?: string;
  eventDate?: string;
  eventTime?: string;
  venue?: string;
  location?: string;
};

const PDF_TICKET_HEADER_TEXT = "BILET EKOSISTEMI E-TICKET";
const PDF_CUSTOMER_TICKET_TEXT = "MUSTERI/ETKINLIK BILETI";

async function getEventSummary(
  supabase: any,
  eventId: string | null | undefined
): Promise<{ title?: string; date?: string; time?: string; venue?: string; location?: string }> {
  if (!eventId) return {};

  const { data } = await supabase
    .from("events")
    .select("title, date, time, venue, location")
    .eq("id", eventId)
    .single();
  const row = data || {};

  return {
    title: row.title,
    date: row.date,
    time: row.time,
    venue: row.venue,
    location: row.location,
  };
}

function buildTicketEmailHtml(payload: TicketMailPayload, qrContentId: string, barcodeContentId: string) {
  const eventDateText = payload.eventDate
    ? new Date(payload.eventDate).toLocaleDateString("tr-TR")
    : "-";
  const timeText = payload.eventTime || "--:--";
  const priceText = Number(payload.totalPrice).toLocaleString("de-DE");
  const locationText = payload.location || "-";
  const venueText = payload.venue || "-";
  const leftVerticalTicketCodeHtml = payload.ticketCode
    .split("")
    .map((ch) => `<span style="display:block;line-height:9px;">${ch}</span>`)
    .join("");

  return `
    <div style="font-family:Arial,sans-serif;background:#eef2f7;padding:24px;">
      <div style="max-width:900px;margin:0 auto;">
        <h2 style="margin:0 0 10px;color:#0f172a;">Merhaba ${payload.buyerName},</h2>
        <p style="margin:0 0 14px;color:#334155;">Siparişiniz tamamlandı. Biletiniz aşağıdadır.</p>
        <div style="position:relative;background:#fff;border:1px solid #cbd5e1;border-radius:12px;overflow:hidden;">
          <div style="position:absolute;top:0;bottom:0;left:73%;border-left:2px dashed #94a3b8;"></div>
          <div style="background:#003f8c;color:#fff;padding:10px 18px;font-size:14px;font-weight:700;letter-spacing:.4px;">
            BILET EKOSISTEMI E-TICKET
          </div>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
            <tr>
              <td style="width:73%;padding:14px 16px;vertical-align:top;">
                <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                  <tr>
                    <td style="width:74px;vertical-align:top;padding-right:12px;">
                      <div style="display:flex;gap:6px;align-items:flex-start;">
                        <img src="cid:${barcodeContentId}" alt="Bilet Barkod" width="42" height="250" style="display:block;border:1px solid #cbd5e1;background:#fff;" />
                        <div style="margin-top:0;font-size:9px;color:#000;letter-spacing:.7px;font-family:monospace;display:inline-block;">${leftVerticalTicketCodeHtml}</div>
                      </div>
                    </td>
                    <td style="vertical-align:top;">
                      <p style="margin:0;color:#000;font-size:10px;font-weight:700;letter-spacing:.4px;">MUSTERI/ETKINLIK BILETI</p>
                      <p style="margin:6px 0 0;font-size:52px;line-height:50px;font-weight:900;color:#000;">${payload.eventTitle || "Etkinlik"}</p>
                      <p style="margin:12px 0 0;font-size:18px;line-height:22px;font-weight:800;color:#000;">${eventDateText}, ${timeText}</p>
                      <p style="margin:4px 0 0;font-size:13px;line-height:16px;color:#000;font-weight:700;">${venueText}</p>
                      <p style="margin:2px 0 0;font-size:13px;color:#000;">${locationText}</p>
                      <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;border-collapse:collapse;">
                        <tr>
                          <td style="padding:2px 0;font-size:12px;color:#000;">Bilet Turu</td>
                          <td style="padding:2px 0;font-size:12px;color:#000;font-weight:700;text-align:right;">${payload.ticketType}</td>
                        </tr>
                        <tr>
                          <td style="padding:2px 0;font-size:12px;color:#000;">Kisi/Adet</td>
                          <td style="padding:2px 0;font-size:12px;color:#000;font-weight:700;text-align:right;">${payload.buyerName} / ${payload.quantity}</td>
                        </tr>
                        <tr>
                          <td style="padding:2px 0;font-size:12px;color:#000;">Toplam</td>
                          <td style="padding:2px 0;font-size:12px;color:#000;font-weight:800;text-align:right;">EUR ${priceText}</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
              <td style="width:27%;padding:14px 16px;vertical-align:top;">
                <p style="margin:0;font-size:10px;color:#000;font-weight:700;letter-spacing:.6px;">KOPARILABILIR BOLUM</p>
                <p style="margin:8px 0 0;font-size:12px;color:#000;font-weight:700;">Bilet Kodu</p>
                <p style="margin:2px 0 0;font-size:18px;color:#000;font-weight:800;letter-spacing:1px;font-family:monospace;">${payload.ticketCode}</p>
                <p style="margin:10px 0 0;font-size:11px;color:#000;">Giris Noktasi</p>
                <p style="margin:2px 0 0;font-size:13px;color:#000;font-weight:700;">EINGANG X</p>
                <div style="margin-top:10px;text-align:center;">
                  <img src="cid:${qrContentId}" alt="Bilet QR Kodu" width="130" height="130" style="border:1px solid #cbd5e1;padding:6px;background:#fff;" />
                </div>
                <p style="margin:6px 0 0;font-size:10px;color:#000;text-align:center;">QR kodu giriste okutunuz</p>
              </td>
            </tr>
          </table>
        </div>
        <div style="font-size:11px;color:#64748b;margin-top:8px;">
          Bu e-posta otomatik olusturulmustur.
        </div>
      </div>
    </div>
  `;
}

async function buildQrCodeDataUrl(payload: TicketMailPayload) {
  const qrData = JSON.stringify({
    code: payload.ticketCode,
    event: payload.eventTitle,
    date: payload.eventDate,
    time: payload.eventTime,
    venue: payload.venue,
    buyer: payload.buyerName,
    quantity: payload.quantity,
  });

  return QRCode.toDataURL(qrData, {
    width: 220,
    margin: 1,
    color: {
      dark: "#1e293b",
      light: "#ffffff",
    },
  });
}

async function buildCode128DataUrl(ticketCode: string): Promise<string> {
  const barcodeBuffer = await bwipjs.toBuffer({
    bcid: "code128",
    text: ticketCode,
    scale: 2,
    height: 18,
    rotate: "R",
    includetext: false,
    paddingwidth: 0,
    paddingheight: 0,
    backgroundcolor: "FFFFFF",
  });
  return `data:image/png;base64,${barcodeBuffer.toString("base64")}`;
}

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",")[1] || "";
  return Uint8Array.from(Buffer.from(base64, "base64"));
}

function dataUrlToBase64(dataUrl: string): string {
  return dataUrl.split(",")[1] || "";
}

function toPdfSafeText(value: string | undefined | null): string {
  if (!value) return "-";

  // pdf-lib's standard fonts use WinAnsi and cannot encode Turkish chars.
  // Convert to close ASCII equivalents to keep PDF generation stable.
  return value
    .replace(/ı/g, "i")
    .replace(/İ/g, "I")
    .replace(/ş/g, "s")
    .replace(/Ş/g, "S")
    .replace(/ğ/g, "g")
    .replace(/Ğ/g, "G")
    .replace(/ü/g, "u")
    .replace(/Ü/g, "U")
    .replace(/ö/g, "o")
    .replace(/Ö/g, "O")
    .replace(/ç/g, "c")
    .replace(/Ç/g, "C");
}

function drawVerticalDashedLine(
  page: PDFPage,
  x: number,
  yTop: number,
  yBottom: number,
  dash: number,
  gap: number,
  thickness: number,
  color: ReturnType<typeof rgb>
) {
  let current = yBottom;
  while (current < yTop) {
    const next = Math.min(current + dash, yTop);
    page.drawLine({
      start: { x, y: current },
      end: { x, y: next },
      thickness,
      color,
    });
    current = next + gap;
  }
}

function drawWrappedText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  fontSize: number,
  lineHeight: number,
  font: any,
  color: ReturnType<typeof rgb>,
  maxLines = 2
) {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
      if (lines.length >= maxLines - 1) break;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);

  lines.forEach((line, idx) => {
    page.drawText(line, { x, y: y - idx * lineHeight, size: fontSize, font, color });
  });
}

async function buildTicketPdfBase64(payload: TicketMailPayload) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([842, 595]);
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const qrDataUrl = await buildQrCodeDataUrl(payload);
  const barcodeDataUrl = await buildCode128DataUrl(payload.ticketCode);
  const qrImage = await pdfDoc.embedPng(dataUrlToUint8Array(qrDataUrl));
  const barcodeImage = await pdfDoc.embedPng(dataUrlToUint8Array(barcodeDataUrl));

  const eventDateText = payload.eventDate
    ? new Date(payload.eventDate).toLocaleDateString("tr-TR")
    : "-";

  const safeEventTitle = toPdfSafeText(payload.eventTitle || "Etkinlik");
  const safeBuyerName = toPdfSafeText(payload.buyerName);
  const safeTicketType = toPdfSafeText(payload.ticketType);
  const safeVenue = toPdfSafeText(payload.venue);
  const safeLocation = toPdfSafeText(payload.location);
  const safeTicketCode = toPdfSafeText(payload.ticketCode);
  const safeDate = toPdfSafeText(eventDateText);
  const safeTime = toPdfSafeText(payload.eventTime || "--:--");

  const primary = rgb(0.0, 0.25, 0.55);
  const slate900 = rgb(0.06, 0.09, 0.16);
  const slate500 = rgb(0, 0, 0);
  const white = rgb(1, 1, 1);
  const border = rgb(0.8, 0.84, 0.89);

  const ticketX = 38;
  const ticketY = 140;
  const ticketW = 766;
  const ticketH = 320;
  const stubW = 206;
  const stubX = ticketX + ticketW - stubW;
  const headerH = 34;

  page.drawRectangle({
    x: ticketX,
    y: ticketY,
    width: ticketW,
    height: ticketH,
    color: white,
    borderColor: border,
    borderWidth: 1.2,
  });
  page.drawRectangle({
    x: ticketX,
    y: ticketY + ticketH - headerH,
    width: ticketW,
    height: headerH,
    color: primary,
  });
  page.drawText(PDF_TICKET_HEADER_TEXT, {
    x: ticketX + 14,
    y: ticketY + ticketH - 23,
    size: 12,
    font: boldFont,
    color: white,
  });

  drawVerticalDashedLine(
    page,
    stubX,
    ticketY + ticketH - 1,
    ticketY + 1,
    7,
    5,
    1.2,
    rgb(0.58, 0.64, 0.71)
  );

  const barcodeX = ticketX + 18;
  const barcodeY = ticketY + 30;
  const barcodeAreaW = 72;

  page.drawRectangle({
    x: barcodeX + 4,
    y: barcodeY + 10,
    width: 44,
    height: 246,
    borderColor: border,
    borderWidth: 1,
    color: white,
  });

  page.drawImage(barcodeImage, {
    x: barcodeX + 8,
    y: barcodeY + 14,
    width: 36,
    height: 238,
  });
  // Ticket code: single-line text, aligned along barcode from bottom to top.
  page.drawText(safeTicketCode, {
    x: barcodeX + 56,
    y: barcodeY + 14,
    size: 8,
    font: regularFont,
    color: slate900,
    rotate: degrees(90),
  });

  const leftX = barcodeX + barcodeAreaW + 26;
  page.drawText(PDF_CUSTOMER_TICKET_TEXT, {
    x: leftX,
    y: ticketY + 257,
    size: 9,
    font: boldFont,
    color: slate500,
  });
  drawWrappedText(
    page,
    safeEventTitle,
    leftX,
    ticketY + 225,
    stubX - leftX - 20,
    26,
    28,
    boldFont,
    slate900,
    2
  );
  page.drawText(`${safeDate}, ${safeTime}`, {
    x: leftX,
    y: ticketY + 163,
    size: 18,
    font: boldFont,
    color: slate900,
  });
  page.drawText(safeVenue, {
    x: leftX,
    y: ticketY + 141,
    size: 13,
    font: boldFont,
    color: slate900,
  });
  page.drawText(safeLocation, {
    x: leftX,
    y: ticketY + 124,
    size: 12,
    font: regularFont,
    color: slate900,
  });

  const rows: Array<[string, string]> = [
    ["Bilet Turu", safeTicketType],
    ["Kisi/Adet", `${safeBuyerName} / ${payload.quantity}`],
    ["Toplam", `EUR ${Number(payload.totalPrice).toLocaleString("de-DE")}`],
    ["Giris", "EINGANG X"],
  ];
  let y = ticketY + 92;
  for (const [label, value] of rows) {
    page.drawText(label, { x: leftX, y, size: 11, font: regularFont, color: slate500 });
    page.drawText(value, { x: leftX + 110, y, size: 12, font: boldFont, color: slate900 });
    y -= 21;
  }

  page.drawText("KOPARILABILIR BOLUM", {
    x: stubX + 18,
    y: ticketY + 255,
    size: 10,
    font: boldFont,
    color: slate500,
  });
  page.drawText("Bilet Kodu", {
    x: stubX + 18,
    y: ticketY + 232,
    size: 11,
    font: regularFont,
    color: slate500,
  });
  page.drawText(safeTicketCode, {
    x: stubX + 18,
    y: ticketY + 212,
    size: 18,
    font: boldFont,
    color: slate900,
  });
  page.drawText("EINGANG X", {
    x: stubX + 18,
    y: ticketY + 187,
    size: 13,
    font: boldFont,
    color: slate900,
  });
  page.drawImage(qrImage, { x: stubX + 38, y: ticketY + 40, width: 120, height: 120 });
  page.drawText("QR kodu giriste okutunuz.", {
    x: stubX + 31,
    y: ticketY + 26,
    size: 9,
    font: regularFont,
    color: slate500,
  });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes).toString("base64");
}

async function sendTicketEmail(payload: TicketMailPayload) {
  try {
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      return { sent: false, reason: "RESEND_API_KEY tanımlı değil." };
    }

    const fromAddress = process.env.TICKET_EMAIL_FROM;
    if (!fromAddress) {
      return { sent: false, reason: "TICKET_EMAIL_FROM tanımlı değil (doğrulanmış gönderici adresi girin)." };
    }

    const subject = `Biletiniz hazır: ${payload.ticketCode}`;
  const qrCodeDataUrl = await buildQrCodeDataUrl(payload);
  const barcodeDataUrl = await buildCode128DataUrl(payload.ticketCode);
  const qrContentId = `ticket-qr-${payload.ticketCode.toLowerCase()}`;
  const barcodeContentId = `ticket-barcode-${payload.ticketCode.toLowerCase()}`;
  const html = buildTicketEmailHtml(payload, qrContentId, barcodeContentId);
    const pdfAttachment = await buildTicketPdfBase64(payload);
  const qrAttachment = dataUrlToBase64(qrCodeDataUrl);
  const barcodeAttachment = dataUrlToBase64(barcodeDataUrl);

    const primaryResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [payload.buyerEmail],
        subject,
        html,
        attachments: [
          {
            filename: `bilet-${payload.ticketCode}.pdf`,
            content: pdfAttachment,
          },
          {
            filename: `qr-${payload.ticketCode}.png`,
            content: qrAttachment,
            content_id: qrContentId,
          },
          {
            filename: `barcode-${payload.ticketCode}.png`,
            content: barcodeAttachment,
            content_id: barcodeContentId,
          },
        ],
      }),
    });

    if (primaryResponse.ok) {
      return { sent: true };
    }

    const primaryErrorText = await primaryResponse.text();

    // Fallback: daha da sade içerik, sadece PDF eki.
    const fallbackHtml = `
      <div style="font-family:Arial,sans-serif;color:#0f172a;">
        <h2 style="margin:0 0 10px;">Merhaba ${payload.buyerName},</h2>
        <p style="margin:0 0 8px;">Biletiniz hazır.</p>
        <p style="margin:0 0 4px;"><strong>Bilet Kodu:</strong> ${payload.ticketCode}</p>
        <p style="margin:0 0 4px;"><strong>Etkinlik:</strong> ${payload.eventTitle || "Etkinlik"}</p>
        <p style="margin:0 0 4px;"><strong>Tarih/Saat:</strong> ${payload.eventDate || "-"} ${payload.eventTime || "--:--"}</p>
        <p style="margin:0;">PDF bilet ektedir.</p>
      </div>
    `;

    const fallbackResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [payload.buyerEmail],
        subject,
        html: fallbackHtml,
        attachments: [
          {
            filename: `bilet-${payload.ticketCode}.pdf`,
            content: pdfAttachment,
          },
        ],
      }),
    });

    if (fallbackResponse.ok) {
      return { sent: true };
    }

    const fallbackErrorText = await fallbackResponse.text();
    return {
      sent: false,
      reason: `Primary: ${primaryErrorText || `HTTP ${primaryResponse.status}`} | Fallback: ${
        fallbackErrorText || `HTTP ${fallbackResponse.status}`
      }`,
    };
  } catch (error) {
    return {
      sent: false,
      reason: error instanceof Error ? error.message : "Bilinmeyen e-posta hatası",
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    
    const formData = await request.formData();
    const ticketId = formData.get("ticket_id") as string;
    const quantity = parseInt(formData.get("quantity") as string, 10);
    const buyerName = (formData.get("buyer_name") as string)?.trim();
    const buyerEmail = (formData.get("buyer_email") as string)?.trim();

    if (!ticketId || !quantity || !buyerName || !buyerEmail) {
      return NextResponse.json(
        { success: false, message: "Lütfen tüm alanları doldurun." },
        { status: 400 }
      );
    }

    if (quantity < 1 || quantity > 10) {
      return NextResponse.json(
        { success: false, message: "Miktar 1–10 arasında olmalıdır." },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(buyerEmail)) {
      return NextResponse.json(
        { success: false, message: "Geçerli bir e-posta adresi girin." },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { success: false, message: "Sunucu yapılandırması eksik. Lütfen yöneticiye bildirin." },
        { status: 500 }
      );
    }

    // Purchase API needs elevated DB permissions for orders/ticket stock writes.
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Get ticket details
    const { data: ticket, error: ticketError } = await supabase
      .from("tickets")
      .select("*")
      .eq("id", ticketId)
      .single();

    if (ticketError || !ticket) {
      return NextResponse.json(
        { success: false, message: "Bilet bulunamadı." },
        { status: 404 }
      );
    }

    const totalPrice = Number(ticket.price) * quantity;
    const ticketCode = generateTicketCode();

    if (Number(ticket.available || 0) < quantity) {
      return NextResponse.json(
        { success: false, message: `Yetersiz stok. Kalan bilet: ${ticket.available || 0}` },
        { status: 400 }
      );
    }

    // Direct insert
    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .insert({
        event_id: ticket.event_id,
        ticket_id: ticketId,
        quantity: quantity,
        total_price: totalPrice,
        ticket_code: ticketCode,
        status: 'completed',
        buyer_name: buyerName,
        buyer_email: buyerEmail
      })
      .select()
      .single();

    if (orderError) {
      console.error("API Order error:", orderError);
      return NextResponse.json(
        { success: false, message: `Sipariş oluşturulamadı: ${orderError.message}. Tekrar deneyin.` },
        { status: 500 }
      );
    }

    // Update ticket stock. Keep quantity as total capacity (never below available).
    const currentTotalQuantity = Math.max(
      Number(ticket.quantity || 0),
      Number(ticket.available || 0)
    );
    const nextAvailable = Math.max(0, Number(ticket.available || 0) - quantity);
    const { error: updateError } = await supabase
      .from("tickets")
      .update({
        available: nextAvailable,
        quantity: currentTotalQuantity,
      })
      .eq("id", ticketId);

    if (updateError) {
      console.error("API Stock update error:", updateError);
    }

    const eventSummary = await getEventSummary(supabase, ticket.event_id);
    const emailResult = await sendTicketEmail({
      buyerEmail,
      buyerName,
      ticketCode,
      quantity,
      ticketType: ticket.name || ticket.ticket_type || "Standart",
      totalPrice,
      eventTitle: eventSummary.title,
      eventDate: eventSummary.date,
      eventTime: eventSummary.time,
      venue: eventSummary.venue,
      location: eventSummary.location || ticket.city || ticket.location,
    });

    if (!emailResult.sent) {
      console.error("Bilet e-postası gönderilemedi:", emailResult.reason);
    }

    return NextResponse.json({
      success: true,
      message: "Siparişiniz başarıyla oluşturuldu!",
      ticketCode,
      emailSent: emailResult.sent,
      emailError: emailResult.sent ? undefined : emailResult.reason,
      orderDetails: {
        buyerName,
        quantity,
        ticketType: ticket.name || ticket.ticket_type,
        price: totalPrice,
      },
    });

  } catch (error) {
    console.error("API Purchase error:", error);
    return NextResponse.json(
      { success: false, message: "Bilet satın alınırken bir hata oluştu. Lütfen tekrar deneyin." },
      { status: 500 }
    );
  }
}
