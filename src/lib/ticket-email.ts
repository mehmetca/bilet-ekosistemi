import QRCode from "qrcode";
import bwipjs from "bwip-js";
import { PDFDocument, PDFPage, StandardFonts, degrees, rgb } from "pdf-lib";
import { getSiteUrl } from "@/lib/site-url";
import { createBrevoClient } from "@/lib/brevo-client";

export type SeatDetail = { section_name: string; row_label: string; seat_label: string; ticket_code?: string };
export type TicketUnitDetail = { ticket_code: string };

export type TicketMailPayload = {
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
  /** Koltuksuz çoklu alımlarda: her adet için tekil bilet kodları */
  ticketCodes?: string[];
};

const PDF_TICKET_HEADER_TEXT = "KURDEVENTS E-TICKET";
const PDF_CUSTOMER_TICKET_TEXT = "MUSTERI/ETKINLIK BILETI";

/** E-posta HTML enjeksiyonuna karşı kullanıcı/alan metinlerini kaçır. */
export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, "")
    .replace(/'/g, "&#39;");
}

function buildTicketEmailHtml(payload: TicketMailPayload, qrCodeDataUrl: string, barcodeDataUrl: string) {
  const buyerName = escapeHtml(payload.buyerName);
  const eventTitle = escapeHtml(payload.eventTitle || "Etkinlik");
  const ticketCode = escapeHtml(payload.ticketCode);
  const venueText = escapeHtml(payload.venue || "-");
  const locationText = escapeHtml(payload.location || "-");
  const eventDateText = payload.eventDate
    ? escapeHtml(new Date(payload.eventDate).toLocaleDateString("tr-TR"))
    : "-";
  const timeText = escapeHtml(payload.eventTime || "--:--");
  const priceText = Number(payload.totalPrice).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const multiSeat = payload.seatDetails && payload.seatDetails.length > 1;
  const multiCode = payload.ticketCodes && payload.ticketCodes.length > 1;

  // Primary HTML - tek bilet veya çoklu koltuk
  if (multiSeat) {
    const rows = payload.seatDetails!.map(
      (s, i) =>
        `<tr><td style="padding:8px 12px;border:1px solid #e2e8f0;">${i + 1}</td><td style="padding:8px 12px;border:1px solid #e2e8f0;font-family:monospace;font-weight:700;">${escapeHtml(s.ticket_code || payload.ticketCode)}</td><td style="padding:8px 12px;border:1px solid #e2e8f0;">${escapeHtml(s.section_name)} · Sıra ${escapeHtml(s.row_label)} · Nr ${escapeHtml(s.seat_label)}</td></tr>`
    ).join("");
    return `
    <div style="font-family:Arial,sans-serif;background:#eef2f7;padding:24px;">
      <div style="max-width:900px;margin:0 auto;">
        <h2 style="margin:0 0 10px;color:#0f172a;">Merhaba ${buyerName},</h2>
        <p style="margin:0 0 8px;color:#334155;">Siparişiniz tamamlandı. <strong>${payload.seatDetails!.length} adet bilet</strong> siparişiniz oluşturuldu.</p>
        <p style="margin:0 0 14px;color:#334155;">Ekteki PDF dosyasında her bilet <strong>ayrı sayfada</strong> yer alır; her sayfada o bilete özel bilet kodu ve koltuk bilgisi vardır.</p>
        <p style="margin:0 0 6px;color:#0f172a;font-weight:700;">${eventTitle}</p>
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

  // Single ticket mode or multiCode
  const isMultiCode = payload.ticketCodes && payload.ticketCodes.length > 1;

  if (isMultiCode) {
    const rows = payload.ticketCodes!
      .map(
        (code, i) =>
          `<tr><td style="padding:8px 12px;border:1px solid #e2e8f0;">${i + 1}</td><td style="padding:8px 12px;border:1px solid #e2e8f0;font-family:monospace;font-weight:700;">${escapeHtml(code)}</td></tr>`
      )
      .join("");
    return `
    <div style="font-family:Arial,sans-serif;background:#eef2f7;padding:24px;">
      <div style="max-width:900px;margin:0 auto;">
        <h2 style="margin:0 0 10px;color:#0f172a;">Merhaba ${buyerName},</h2>
        <p style="margin:0 0 8px;color:#334155;">Siparişiniz tamamlandı. <strong>${payload.ticketCodes!.length} adet bilet</strong> siparişiniz oluşturuldu.</p>
        <p style="margin:0 0 14px;color:#334155;">Ekteki PDF dosyasında her bilet <strong>ayrı sayfada</strong> yer alır; her sayfada o bilete özel bilet kodu ve QR bulunur.</p>
        <p style="margin:0 0 6px;color:#0f172a;font-weight:700;">${eventTitle}</p>
        <p style="margin:0 0 14px;color:#64748b;font-size:14px;">${eventDateText}, ${timeText} · ${venueText}</p>
        <table style="border-collapse:collapse;width:100%;max-width:600px;background:#fff;border:1px solid #cbd5e1;border-radius:8px;">
          <thead><tr style="background:#f1f5f9;"><th style="padding:8px 12px;text-align:left;border:1px solid #e2e8f0;">No</th><th style="padding:8px 12px;text-align:left;border:1px solid #e2e8f0;">Bilet Kodu</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <p style="margin:14px 0 0;font-size:12px;color:#64748b;">Toplam: EUR ${priceText}</p>
        <p style="margin:16px 0 0;font-size:14px;color:#0f172a;font-weight:600;">Ekteki PDF sayfasında biletleriniz gönderilmiştir. Yazdırabilirsiniz. İyi seyirler dileriz.</p>
        <div style="font-size:11px;color:#64748b;margin-top:16px;">Bu e-posta otomatik olusturulmustur.</div>
      </div>
    </div>
  `;
  }

  // Single ticket - sadece metin, HTML bilet görseli yok (ekte PDF var)
  const seatLine =
    payload.seatDetails && payload.seatDetails.length > 0
      ? payload.seatDetails
          .map(
            (s) =>
              `${escapeHtml(s.section_name)} · Sıra ${escapeHtml(s.row_label)} · Nr ${escapeHtml(s.seat_label)}`
          )
          .join("; ")
      : "";

  return `
    <div style="font-family:Arial,sans-serif;background:#eef2f7;padding:24px;">
      <div style="max-width:600px;margin:0 auto;">
        <h2 style="margin:0 0 10px;color:#0f172a;">Merhaba ${buyerName},</h2>
        <p style="margin:0 0 6px;color:#334155;">Siparişiniz tamamlandı. Biletiniz ektedir.</p>
        <p style="margin:0 0 16px;color:#334155;">Ekteki PDF dosyasını indirip yazdırabilirsiniz. İyi seyirler dileriz.</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#fff;border:1px solid #cbd5e1;border-radius:8px;">
          <tr>
            <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#64748b;width:40%;">Etkinlik</td>
            <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#0f172a;font-weight:600;">${eventTitle}</td>
          </tr>
          <tr>
            <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#64748b;">Tarih / Saat</td>
            <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#0f172a;">${eventDateText}, ${timeText}</td>
          </tr>
          <tr>
            <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#64748b;">Mekan</td>
            <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#0f172a;">${venueText}, ${locationText}</td>
          </tr>
          <tr>
            <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#64748b;">Bilet Kodu</td>
            <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#0f172a;font-family:monospace;font-weight:700;letter-spacing:1px;">${ticketCode}</td>
          </tr>
          ${seatLine ? `<tr><td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#64748b;">Koltuk</td><td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#0f172a;font-weight:600;">${seatLine}</td></tr>` : ""}
          <tr>
            <td style="padding:12px 16px;font-size:13px;color:#64748b;">Toplam</td>
            <td style="padding:12px 16px;font-size:13px;color:#0f172a;font-weight:700;">EUR ${priceText}</td>
          </tr>
        </table>
        <div style="font-size:11px;color:#64748b;margin-top:20px;">Bu e-posta otomatik oluşturulmuştur.</div>
      </div>
    </div>
  `;
}

async function buildQrCodeDataUrl(payload: TicketMailPayload) {
  const baseOrigin = getSiteUrl();
  let ticketOrigin = baseOrigin;
  try {
    const originUrl = new URL(baseOrigin);
    // Eski domain gelirse kanonik alan adına normalize et.
    if (originUrl.hostname.toLowerCase() === "eventseat.de" || originUrl.hostname.toLowerCase() === "www.eventseat.de") {
      ticketOrigin = "https://kurdevents.com";
    } else {
      ticketOrigin = originUrl.origin;
    }
  } catch {
    ticketOrigin = "https://kurdevents.com";
  }

  const qrData = `${ticketOrigin}/kontrol?code=${encodeURIComponent(payload.ticketCode)}`;

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
  pdfDoc.setTitle("KurdEvents E-Ticket");
  pdfDoc.setSubject(String(payload.eventTitle || "Event").slice(0, 200));

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
export async function buildTicketPdfMultiPageBase64(payload: TicketMailPayload): Promise<string> {
  if (payload.seatDetails && payload.seatDetails.length > 1) {
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
    combinedDoc.setTitle("KurdEvents E-Ticket");
    combinedDoc.setSubject(String(payload.eventTitle || "Event").slice(0, 200));
    const bytes = await combinedDoc.save();
    return Buffer.from(bytes).toString("base64");
  }

  if (payload.ticketCodes && payload.ticketCodes.length > 1) {
    const combinedDoc = await PDFDocument.create();
    for (const code of payload.ticketCodes) {
      const singlePayload: TicketMailPayload = {
        ...payload,
        ticketCode: code,
        quantity: 1,
        seatDetails: undefined,
        totalPrice: Number((payload.totalPrice / payload.quantity).toFixed(2)),
      };
      const singleBase64 = await buildTicketPdfBase64(singlePayload);
      const donorDoc = await PDFDocument.load(Buffer.from(singleBase64, "base64"));
      const [copiedPage] = await combinedDoc.copyPages(donorDoc, [0]);
      combinedDoc.addPage(copiedPage);
    }
    combinedDoc.setTitle("KurdEvents E-Ticket");
    combinedDoc.setSubject(String(payload.eventTitle || "Event").slice(0, 200));
    const bytes = await combinedDoc.save();
    return Buffer.from(bytes).toString("base64");
  }

  return buildTicketPdfBase64(payload);
}

export async function sendTicketEmail(payload: TicketMailPayload) {
  try {
    const brevoApiKey = process.env.BREVO_API_KEY;
    const fromEmail = process.env.BREVO_FROM_EMAIL;
    const fromName = process.env.BREVO_FROM_NAME;

    if (!brevoApiKey || !fromEmail || !fromName) {
      return { sent: false, reason: "Brevo yapılandırması eksik." };
    }

    const subject = `Biletiniz hazır: ${payload.ticketCode}`;
    const qrCodeDataUrl = await buildQrCodeDataUrl(payload);
    const barcodeDataUrl = await buildCode128DataUrl(payload.ticketCode);
    const html = buildTicketEmailHtml(payload, qrCodeDataUrl, barcodeDataUrl);
    const pdfAttachment = await buildTicketPdfMultiPageBase64(payload);
    const qrAttachment = dataUrlToBase64(qrCodeDataUrl);
    const barcodeAttachment = dataUrlToBase64(barcodeDataUrl);

    const brevo = createBrevoClient(brevoApiKey);

    const sendSmtpEmail = {
      to: [{
        email: payload.buyerEmail,
        name: payload.buyerName || "Müşteri"
      }],
      sender: {
        name: fromName,
        email: fromEmail
      },
      subject: subject,
      htmlContent: html,
      attachment: [
        {
          content: pdfAttachment,
          name: "kurdevents-e-bilet.pdf"
        },
        {
          content: qrAttachment,
          name: "kurdevents-e-ticket-qr.png"
        },
        {
          content: barcodeAttachment,
          name: "kurdevents-e-ticket-barcode.png"
        }
      ]
    };

    await brevo.transactionalEmails.sendTransacEmail(sendSmtpEmail);
    return { sent: true };
  } catch (error: any) {
    return { sent: false, reason: error.message };
  }
}
