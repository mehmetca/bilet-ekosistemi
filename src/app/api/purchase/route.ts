import { NextRequest, NextResponse } from 'next/server';
import { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
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

type SeatDetail = { section_name: string; row_label: string; seat_label: string; ticket_code?: string };

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
  /** Yer seçerek alınan biletlerde: koltuk bilgisi (bilet üzerinde gösterilir) */
  seatDetails?: SeatDetail[];
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

/** Fiyat kategorisine göre bilet alımında: bu kategorideki en iyi müsait yan yana N koltuğu döndürür. */
async function assignBestAvailableSeats(
  supabase: SupabaseClient,
  eventId: string,
  seatingPlanId: string,
  ticketTypeName: string,
  quantity: number
): Promise<string[]> {
  let sections: { id: string; name?: string; sort_order?: number }[] | null = null;
  const hasTicketType = (ticketTypeName || "").trim().length > 0;

  if (hasTicketType) {
    const { data: sectionsExact } = await supabase
      .from("seating_plan_sections")
      .select("id, name, sort_order")
      .eq("seating_plan_id", seatingPlanId)
      .ilike("ticket_type_label", ticketTypeName);
    if (sectionsExact?.length) {
      sections = sectionsExact;
    } else {
      const { data: sectionsContains } = await supabase
        .from("seating_plan_sections")
        .select("id, name, sort_order, ticket_type_label")
        .eq("seating_plan_id", seatingPlanId)
        .ilike("ticket_type_label", `%${ticketTypeName}%`);
      if (sectionsContains?.length) {
        const exact = sectionsContains.filter(
          (s: { ticket_type_label?: string }) =>
            (s.ticket_type_label || "").trim().toLowerCase() === ticketTypeName.toLowerCase()
        );
        sections = exact.length ? exact : sectionsContains;
      }
    }
  }

  if (!sections?.length) {
    // Bilet türü eşleşmedi veya boş: planın tüm bölümlerinden müsait koltuk ata
    const { data: allSections } = await supabase
      .from("seating_plan_sections")
      .select("id, name, sort_order")
      .eq("seating_plan_id", seatingPlanId)
      .order("sort_order", { ascending: true });
    sections = allSections?.length ? allSections : null;
  }
  if (!sections?.length) return [];

  const sectionIds = sections.map((s: { id: string }) => s.id);
  const sectionOrder = new Map(sections.map((s: { id: string; sort_order?: number }) => [s.id, s.sort_order ?? 0]));

  const { data: rows } = await supabase
    .from("seating_plan_rows")
    .select("id, section_id, row_label, sort_order")
    .in("section_id", sectionIds)
    .order("sort_order", { ascending: true });

  if (!rows?.length) return [];

  const rowIds = rows.map((r: { id: string }) => r.id);
  const { data: seats } = await supabase
    .from("seats")
    .select("id, row_id, seat_label")
    .in("row_id", rowIds);

  if (!seats?.length) return [];

  const rowById = new Map(rows.map((r: { id: string; section_id: string; row_label: string; sort_order?: number }) => [r.id, r]));
  const soldSet = new Set<string>();
  const { data: completedOrders } = await supabase
    .from("orders")
    .select("id")
    .eq("event_id", eventId)
    .eq("status", "completed");
  if (completedOrders?.length) {
    const { data: orderSeats } = await supabase
      .from("order_seats")
      .select("seat_id")
      .in("order_id", completedOrders.map((o: { id: string }) => o.id));
    (orderSeats || []).forEach((s: { seat_id: string }) => soldSet.add(s.seat_id));
  }

  type SeatInfo = { id: string; row_id: string; seat_label: string; section_sort: number; row_sort: number };
  const available: SeatInfo[] = [];
  for (const s of seats as { id: string; row_id: string; seat_label: string }[]) {
    if (soldSet.has(s.id)) continue;
    const row = rowById.get(s.row_id);
    if (!row) continue;
    available.push({
      id: s.id,
      row_id: s.row_id,
      seat_label: s.seat_label,
      section_sort: sectionOrder.get(row.section_id) ?? 0,
      row_sort: (row as { sort_order?: number }).sort_order ?? 0,
    });
  }

  available.sort((a, b) => {
    if (a.section_sort !== b.section_sort) return a.section_sort - b.section_sort;
    if (a.row_sort !== b.row_sort) return a.row_sort - b.row_sort;
    const na = parseInt(a.seat_label, 10);
    const nb = parseInt(b.seat_label, 10);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
    return String(a.seat_label).localeCompare(String(b.seat_label));
  });

  const byRow = new Map<string, SeatInfo[]>();
  for (const s of available) {
    const list = byRow.get(s.row_id) || [];
    list.push(s);
    byRow.set(s.row_id, list);
  }

  for (const list of byRow.values()) {
    if (list.length < quantity) continue;
    for (let i = 0; i <= list.length - quantity; i++) {
      const slice = list.slice(i, i + quantity);
      const consecutive = slice.every((s, j) => {
        if (j === 0) return true;
        const prev = parseInt(slice[j - 1].seat_label, 10);
        const curr = parseInt(s.seat_label, 10);
        if (!Number.isNaN(prev) && !Number.isNaN(curr)) return curr === prev + 1;
        return true;
      });
      if (consecutive) return slice.map((s) => s.id);
    }
  }

  return available.slice(0, quantity).map((s) => s.id);
}

function buildTicketEmailHtml(payload: TicketMailPayload, qrContentId: string, barcodeContentId: string) {
  const eventDateText = payload.eventDate
    ? new Date(payload.eventDate).toLocaleDateString("tr-TR")
    : "-";
  const timeText = payload.eventTime || "--:--";
  const priceText = Number(payload.totalPrice).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const locationText = payload.location || "-";
  const venueText = payload.venue || "-";
  const multiSeat = payload.seatDetails && payload.seatDetails.length > 1;

  if (multiSeat) {
    const rows = payload.seatDetails!.map(
      (s, i) =>
        `<tr><td style="padding:8px 12px;border:1px solid #e2e8f0;">${i + 1}</td><td style="padding:8px 12px;border:1px solid #e2e8f0;font-family:monospace;font-weight:700;">${s.ticket_code || payload.ticketCode}</td><td style="padding:8px 12px;border:1px solid #e2e8f0;">${s.section_name} · Sıra ${s.row_label} · Nr ${s.seat_label}</td></tr>`
    ).join("");
    return `
    <div style="font-family:Arial,sans-serif;background:#eef2f7;padding:24px;">
      <div style="max-width:900px;margin:0 auto;">
        <h2 style="margin:0 0 10px;color:#0f172a;">Merhaba ${payload.buyerName},</h2>
        <p style="margin:0 0 8px;color:#334155;">Siparişiniz tamamlandı. <strong>${payload.seatDetails!.length} adet bilet</strong> siparişiniz oluşturuldu.</p>
        <p style="margin:0 0 14px;color:#334155;">Ekteki PDF dosyasında her bilet <strong>ayrı sayfada</strong> yer alır; her sayfada o bilete özel bilet kodu ve koltuk bilgisi vardır.</p>
        <p style="margin:0 0 6px;color:#0f172a;font-weight:700;">${payload.eventTitle || "Etkinlik"}</p>
        <p style="margin:0 0 14px;color:#64748b;font-size:14px;">${eventDateText}, ${timeText} · ${venueText}</p>
        <table style="border-collapse:collapse;width:100%;max-width:600px;background:#fff;border:1px solid #cbd5e1;border-radius:8px;">
          <thead><tr style="background:#f1f5f9;"><th style="padding:8px 12px;text-align:left;border:1px solid #e2e8f0;">No</th><th style="padding:8px 12px;text-align:left;border:1px solid #e2e8f0;">Bilet Kodu</th><th style="padding:8px 12px;text-align:left;border:1px solid #e2e8f0;">Koltuk</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <p style="margin:14px 0 0;font-size:12px;color:#64748b;">Toplam: EUR ${priceText}</p>
        <p style="margin:16px 0 0;font-size:14px;color:#0f172a;font-weight:600;">Ekteki PDF sayfasında biletleriniz gönderilmiştir. Yazdırabilirsiniz. İyi seyirler dileriz.</p>
        <div style="font-size:11px;color:#64748b;margin-top:16px;">Bu e-posta otomatik olusturulmustur.</div>
      </div>
    </div>
  `;
  }

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
                        ${(payload.seatDetails && payload.seatDetails.length > 0)
    ? `<tr><td style="padding:2px 0;font-size:12px;color:#000;">Platz / Koltuk</td><td style="padding:2px 0;font-size:12px;color:#000;font-weight:700;text-align:right;">${payload.seatDetails.map((s) => `${s.section_name} · Sıra ${s.row_label} · Nr ${s.seat_label}`).join("; ")}</td></tr>`
    : ""}
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
        <p style="margin:16px 0 0;font-size:14px;color:#0f172a;font-weight:600;">Ekteki PDF sayfasında biletiniz gönderilmiştir. Yazdırabilirsiniz. İyi seyirler dileriz.</p>
        <div style="font-size:11px;color:#64748b;margin-top:16px;">
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

  const seatRow: [string, string] | null =
    payload.seatDetails && payload.seatDetails.length > 0
      ? ["Platz / Koltuk", payload.seatDetails.map((s) => `${s.section_name} · Sıra ${s.row_label} · Nr ${s.seat_label}`).join("; ")]
      : null;
  const rows: Array<[string, string]> = [
    ["Bilet Turu", safeTicketType],
    ...(seatRow ? [seatRow] : []),
    ["Kisi/Adet", `${safeBuyerName} / ${payload.quantity}`],
    ["Toplam", `EUR ${Number(payload.totalPrice).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
    ["Giris", "EINGANG X"],
  ];
  let y = ticketY + 92;
  for (const [label, value] of rows) {
    const safeValue = toPdfSafeText(value);
    page.drawText(label, { x: leftX, y, size: 11, font: regularFont, color: slate500 });
    page.drawText(safeValue.length > 50 ? safeValue.slice(0, 47) + "..." : safeValue, { x: leftX + 110, y, size: 10, font: boldFont, color: slate900 });
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

/** Çok koltuklu siparişte her koltuk için ayrı sayfa (1 bilet = 1 sayfa); her sayfada o koltuğun benzersiz bilet kodu. */
async function buildTicketPdfMultiPageBase64(payload: TicketMailPayload): Promise<string> {
  if (!payload.seatDetails || payload.seatDetails.length <= 1) {
    return buildTicketPdfBase64(payload);
  }
  const combinedDoc = await PDFDocument.create();
  for (const seat of payload.seatDetails) {
    const seatCode = seat.ticket_code || payload.ticketCode;
    const singlePayload: TicketMailPayload = {
      ...payload,
      ticketCode: seatCode,
      quantity: 1,
      ticketType: seat.section_name,
      seatDetails: [{ ...seat, ticket_code: seatCode }],
      totalPrice: Number((payload.totalPrice / payload.quantity).toFixed(2)),
    };
    const singleBase64 = await buildTicketPdfBase64(singlePayload);
    const donorDoc = await PDFDocument.load(Buffer.from(singleBase64, "base64"));
    const [copiedPage] = await combinedDoc.copyPages(donorDoc, [0]);
    combinedDoc.addPage(copiedPage);
  }
  const bytes = await combinedDoc.save();
  return Buffer.from(bytes).toString("base64");
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
    const pdfAttachment = await buildTicketPdfMultiPageBase64(payload);
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
    const buyerAddress = (formData.get("buyer_address") as string)?.trim() || null;
    const buyerPlz = (formData.get("buyer_plz") as string)?.trim() || null;
    const buyerCity = (formData.get("buyer_city") as string)?.trim() || null;
    let seatIds: string[] = [];
    try {
      const raw = formData.get("seat_ids") as string | null;
      if (raw) {
        const parsed = JSON.parse(raw);
        seatIds = Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
      }
    } catch {
      /* ignore */
    }
    if (seatIds.length > 0 && seatIds.length !== quantity) {
      return NextResponse.json(
        { success: false, message: "Koltuk sayısı ile adet uyuşmuyor." },
        { status: 400 }
      );
    }

    if (!ticketId || !quantity || !buyerName || !buyerEmail) {
      return NextResponse.json(
        { success: false, message: "Lütfen tüm alanları doldurun." },
        { status: 400 }
      );
    }

    if (quantity < 1) {
      return NextResponse.json(
        { success: false, message: "Miktar en az 1 olmalıdır." },
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

    let supabase: SupabaseClient;
    try {
      supabase = getSupabaseAdmin();
    } catch {
      return NextResponse.json(
        { success: false, message: "Sunucu yapılandırması eksik. Lütfen yöneticiye bildirin." },
        { status: 500 }
      );
    }

    // Site ayarından maksimum bilet adedini al (varsayılan 10; tablo yoksa 10 kullanılır)
    let maxTicketQuantity = 10;
    try {
      const { data: settingsRow } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "max_ticket_quantity")
        .maybeSingle();
      if (settingsRow && typeof (settingsRow as { value?: number }).value === "number") {
        maxTicketQuantity = Math.max(1, Math.min(100, (settingsRow as { value: number }).value));
      }
    } catch {
      /* tablo yok veya hata: varsayılan 10 */
    }
    if (quantity > maxTicketQuantity) {
      return NextResponse.json(
        { success: false, message: `Sipariş başına en fazla ${maxTicketQuantity} bilet alabilirsiniz.` },
        { status: 400 }
      );
    }

    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    let userId: string | null = null;
    if (token) {
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) userId = user.id;
    }

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

    // Sadece onaylanmış etkinliklerde bilet satışı; otomatik koltuk ataması için seating_plan_id gerekir
    const { data: eventRow } = await supabase
      .from("events")
      .select("id, is_approved, seating_plan_id")
      .eq("id", ticket.event_id)
      .single();
    if (!eventRow || eventRow.is_approved !== true) {
      return NextResponse.json(
        { success: false, message: "Bu etkinlik henüz onaylanmadığı için bilet satın alınamaz." },
        { status: 403 }
      );
    }

    const seatingPlanId = (eventRow as { seating_plan_id?: string }).seating_plan_id;
    const ticketTypeName = (ticket.name || ticket.ticket_type || "").toString().trim();

    // Fiyat kategorisine göre bilet (seat_ids yok): oturum planı varsa en iyi müsait N koltuğu ata
    if (seatIds.length === 0 && quantity >= 1 && seatingPlanId) {
      const assigned = await assignBestAvailableSeats(
        supabase,
        ticket.event_id,
        seatingPlanId,
        ticketTypeName,
        quantity
      );
      if (assigned.length >= quantity) {
        seatIds = assigned.slice(0, quantity);
      } else {
        return NextResponse.json(
          {
            success: false,
            message: assigned.length > 0
              ? `Bu kategoride yan yana ${quantity} koltuk bulunamadı. En fazla ${assigned.length} müsait koltuk var. Lütfen "Yer seçerek bilet al" ile koltuk seçin.`
              : "Bu etkinlikte oturum planı var; koltuk ataması yapılamadı (yeterli müsait koltuk yok veya plan tanımlı değil). Lütfen \"Yer seçerek bilet al\" kullanın.",
          },
          { status: 400 }
        );
      }
    }

    // Grup indirimli bilet: minimum adet (açıklamadaki "Min. X adet." ile uyumlu)
    const desc = (ticket.description || "").toString();
    const minAdetMatch = desc.match(/Min\.\s*(\d+)\s*adet/i);
    const minQuantity = minAdetMatch ? Math.max(1, parseInt(minAdetMatch[1], 10)) : 1;
    if (quantity < minQuantity) {
      return NextResponse.json(
        { success: false, message: `Bu bilet türünden en az ${minQuantity} adet alınmalıdır.` },
        { status: 400 }
      );
    }

    const totalPrice = Number(ticket.price) * quantity;
    const ticketCode = generateTicketCode(); // sipariş ana kodu (yer seçilmediyse veya tek bilet)

    if (Number(ticket.available || 0) < quantity) {
      return NextResponse.json(
        { success: false, message: `Yetersiz stok. Kalan bilet: ${ticket.available || 0}` },
        { status: 400 }
      );
    }

    // Yer seçerek bilet: koltukların daha önce satılmamış olduğunu kontrol et (bir bilet bir defa satılır)
    if (seatIds.length > 0) {
      const { data: completedOrders } = await supabase
        .from("orders")
        .select("id")
        .eq("event_id", ticket.event_id)
        .eq("status", "completed");
      if (completedOrders?.length) {
        const { data: orderSeats } = await supabase
          .from("order_seats")
          .select("seat_id")
          .in("order_id", completedOrders.map((o) => o.id));
        const soldSet = new Set((orderSeats || []).map((s) => (s as { seat_id: string }).seat_id));
        const alreadySold = seatIds.filter((id) => soldSet.has(id));
        if (alreadySold.length > 0) {
          return NextResponse.json(
            { success: false, message: "Seçilen koltuklardan biri veya birkaçı zaten satılmış. Lütfen salon planından müsait koltuk seçin." },
            { status: 400 }
          );
        }
      }
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
        buyer_email: buyerEmail,
        ...(buyerAddress ? { buyer_address: buyerAddress } : {}),
        ...(buyerPlz ? { buyer_plz: buyerPlz } : {}),
        ...(buyerCity ? { buyer_city: buyerCity } : {}),
        ...(userId ? { user_id: userId } : {}),
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

    let seatDetails: SeatDetail[] = [];
    if (orderData?.id && seatIds.length > 0) {
      for (const seatId of seatIds) {
        const { data: seatRow } = await supabase
          .from("seats")
          .select("id, seat_label, row_id")
          .eq("id", seatId)
          .single();
        if (!seatRow?.row_id) continue;
        const { data: rowRow } = await supabase
          .from("seating_plan_rows")
          .select("id, row_label, section_id")
          .eq("id", seatRow.row_id)
          .single();
        if (!rowRow?.section_id) continue;
        const { data: sectionRow } = await supabase
          .from("seating_plan_sections")
          .select("id, name")
          .eq("id", rowRow.section_id)
          .single();
        const section_name = sectionRow?.name ?? "";
        const row_label = rowRow?.row_label ?? "";
        const seat_label = seatRow?.seat_label ?? "";
        const seatTicketCode = generateTicketCode();
        seatDetails.push({ section_name, row_label, seat_label, ticket_code: seatTicketCode });
        const { error: seatInsertError } = await supabase.from("order_seats").insert({
          order_id: orderData.id,
          seat_id: seatId,
          section_name,
          row_label,
          seat_label,
          ticket_code: seatTicketCode,
        });
        if (seatInsertError) {
          const isDuplicateSeat = seatInsertError.code === "23505";
          if (isDuplicateSeat) {
            await supabase.from("orders").delete().eq("id", orderData.id);
            const nextAvailable = Math.min(Number(ticket.available || 0) + quantity, Number(ticket.quantity || 0));
            await supabase.from("tickets").update({ available: nextAvailable }).eq("id", ticketId);
          }
          return NextResponse.json(
            {
              success: false,
              message: isDuplicateSeat
                ? "Seçilen koltuklardan biri veya birkaçı zaten satılmış. Lütfen salon planından müsait koltuk seçin."
                : seatInsertError.message,
            },
            { status: 400 }
          );
        }
      }
    }

    const eventSummary = await getEventSummary(supabase, ticket.event_id);
    const ticketTypeDisplay =
      seatDetails.length > 0
        ? [...new Set(seatDetails.map((s) => s.section_name))].join(", ")
        : (ticket.name || ticket.ticket_type || "Standart");
    const emailResult = await sendTicketEmail({
      buyerEmail,
      buyerName,
      ticketCode,
      quantity,
      ticketType: ticketTypeDisplay,
      totalPrice,
      eventTitle: eventSummary.title,
      eventDate: eventSummary.date,
      eventTime: eventSummary.time,
      venue: eventSummary.venue,
      location: eventSummary.location || ticket.city || ticket.location,
      seatDetails: seatDetails.length > 0 ? seatDetails : undefined,
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
        ticketType: ticketTypeDisplay,
        price: totalPrice,
        seatDetails: seatDetails.length > 0 ? seatDetails : undefined,
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
