import QRCode from "qrcode";
import bwipjs from "bwip-js";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { PDFDocument, PDFImage, PDFPage, StandardFonts, degrees, rgb } from "pdf-lib";
import { getSiteUrl } from "@/lib/site-url";
import { createBrevoClient } from "@/lib/brevo-client";
import { getLocalUploadDir } from "@/lib/local-upload";
import { normalizeAppLocale } from "@/i18n/config";
import { loadMessagesWithEnFallback, type MessageTree } from "@/i18n/load-messages";

export type SeatDetail = { section_name: string; row_label: string; seat_label: string; ticket_code?: string };
export type TicketUnitDetail = { ticket_code: string };

export type TicketMailPayload = {
  buyerEmail: string;
  buyerName: string;
  /** Satın alma sayfasının dili; tanınmayan ya da boş değer Türkçe'ye düşer. */
  locale?: string;
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
  /** Otomatik kesilen Rechnung (Almanca fatura) PDF'i — base64, bilet mailine ek olarak gider. */
  invoicePdfBase64?: string;
  invoiceNumber?: string;
  /** Fatura satıcısı = organizatör. Bilet üzerinde de bu ad ve logosu görünür. */
  organizerName?: string;
  organizerLogoPath?: string;
};

const PDF_TICKET_HEADER_TEXT = "KURDEVENTS E-TICKET";
const PDF_CUSTOMER_TICKET_TEXT = "EINTRITTSKARTE";

/** E-posta HTML enjeksiyonuna karşı kullanıcı/alan metinlerini kaçır. */
export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, "")
    .replace(/'/g, "&#39;");
}

/** Organizatör (fatura satıcısı) satırı — mailin üç varyantında da aynı biçimde kullanılır. */
function organizerHtmlLine(payload: TicketMailPayload, label: string): string {
  const name = escapeHtml(payload.organizerName || "");
  if (!name) return "";
  return `<p style="margin:12px 0 0;font-size:13px;color:#64748b;">${escapeHtml(label)}: <strong style="color:#0f172a;">${name}</strong></p>`;
}

type TicketEmailCopy = {
  locale: ReturnType<typeof normalizeAppLocale>;
  text: (key: string, fallback: string) => string;
};

const MAIL_DATE_LOCALES: Record<string, string> = { tr: "tr-TR", de: "de-DE", en: "en-GB" };

/** Mail metinleri messages/<locale>.json `ticketEmail` bloğundan; ku/ckb İngilizce'ye düşer. */
async function loadTicketEmailCopy(payload: TicketMailPayload): Promise<TicketEmailCopy> {
  const locale = normalizeAppLocale(payload.locale);
  let block: MessageTree = {};
  try {
    const messages = await loadMessagesWithEnFallback(locale);
    const raw = messages.ticketEmail;
    if (raw && typeof raw === "object" && !Array.isArray(raw)) block = raw as MessageTree;
  } catch {
    /* çeviri yüklenemezse aşağıdaki varsayılanlar kullanılır */
  }
  const text = (key: string, fallback: string): string => {
    const value = (block as Record<string, unknown>)[key];
    return typeof value === "string" && value.trim() ? value : fallback;
  };
  return { locale, text };
}

async function buildTicketEmailHtml(payload: TicketMailPayload, copy: TicketEmailCopy) {
  const t = copy.text;
  const dateLocale = MAIL_DATE_LOCALES[copy.locale] ?? "en-GB";
  const eventTitle = escapeHtml(payload.eventTitle || t("eventFallback", "Event"));
  const ticketCode = escapeHtml(payload.ticketCode);
  const venueText = escapeHtml(payload.venue || "-");
  const locationText = escapeHtml(payload.location || "-");
  const eventDateText = payload.eventDate
    ? escapeHtml(new Date(payload.eventDate).toLocaleDateString(dateLocale))
    : "-";
  const timeText = escapeHtml(payload.eventTime || "--:--");
  const priceText = Number(payload.totalPrice).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const multiSeat = payload.seatDetails && payload.seatDetails.length > 1;
  const multiCode = payload.ticketCodes && payload.ticketCodes.length > 1;

  // Primary HTML - tek bilet veya çoklu koltuk
  if (multiSeat) {
    const seatValue = (s: SeatDetail) =>
      `${escapeHtml(s.section_name)} · ${t("rowWord", "Row")} ${escapeHtml(s.row_label)} · ${t("seatNrWord", "No")} ${escapeHtml(s.seat_label)}`;
    const rows = payload.seatDetails!.map(
      (s, i) =>
        `<tr><td style="padding:8px 12px;border:1px solid #e2e8f0;">${i + 1}</td><td style="padding:8px 12px;border:1px solid #e2e8f0;font-family:monospace;font-weight:700;">${escapeHtml(s.ticket_code || payload.ticketCode)}</td><td style="padding:8px 12px;border:1px solid #e2e8f0;">${seatValue(s)}</td></tr>`
    ).join("");
    return `
    <div style="font-family:Arial,sans-serif;background:#eef2f7;padding:24px;">
      <div style="max-width:900px;margin:0 auto;">
        <h2 style="margin:0 0 10px;color:#0f172a;">${escapeHtml(t("greeting", "Hello {name},").replace("{name}", payload.buyerName || ""))}</h2>
        <p style="margin:0 0 8px;color:#334155;">${escapeHtml(t("orderCompletedMulti", "{count} tickets have been issued.").replace("{count}", String(payload.seatDetails!.length)))}</p>
        <p style="margin:0 0 14px;color:#334155;">${escapeHtml(t("seatPdfNote", "Each ticket is on its own page of the attached PDF."))}</p>
        <p style="margin:0 0 6px;color:#0f172a;font-weight:700;">${eventTitle}</p>
        <p style="margin:0 0 14px;color:#64748b;font-size:14px;">${eventDateText}, ${timeText} · ${venueText}</p>
        <table style="border-collapse:collapse;width:100%;max-width:600px;background:#fff;border:1px solid #cbd5e1;border-radius:8px;">
          <thead><tr style="background:#f1f5f9;"><th style="padding:8px 12px;text-align:left;border:1px solid #e2e8f0;">${escapeHtml(t("noColumn", "No"))}</th><th style="padding:8px 12px;text-align:left;border:1px solid #e2e8f0;">${escapeHtml(t("ticketCodeColumn", "Ticket code"))}</th><th style="padding:8px 12px;text-align:left;border:1px solid #e2e8f0;">${escapeHtml(t("seatColumn", "Seat"))}</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <p style="margin:14px 0 0;font-size:12px;color:#64748b;">${escapeHtml(t("totalWord", "Total"))}: EUR ${priceText}</p>
        ${organizerHtmlLine(payload, t("labelOrganizer", "Organizer"))}
        <p style="margin:16px 0 0;font-size:14px;color:#0f172a;font-weight:600;">${escapeHtml(t("printNote", "Your tickets are in the attached PDF. You can print them. Enjoy the show."))}</p>
        <div style="font-size:11px;color:#64748b;margin-top:16px;">${escapeHtml(t("autoGenerated", "This email was generated automatically."))}</div>
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
        <h2 style="margin:0 0 10px;color:#0f172a;">${escapeHtml(t("greeting", "Hello {name},").replace("{name}", payload.buyerName || ""))}</h2>
        <p style="margin:0 0 8px;color:#334155;">${escapeHtml(t("orderCompletedMulti", "{count} tickets have been issued.").replace("{count}", String(payload.ticketCodes!.length)))}</p>
        <p style="margin:0 0 14px;color:#334155;">${escapeHtml(t("codePdfNote", "Each ticket is on its own page of the attached PDF, with its own code and QR."))}</p>
        <p style="margin:0 0 6px;color:#0f172a;font-weight:700;">${eventTitle}</p>
        <p style="margin:0 0 14px;color:#64748b;font-size:14px;">${eventDateText}, ${timeText} · ${venueText}</p>
        <table style="border-collapse:collapse;width:100%;max-width:600px;background:#fff;border:1px solid #cbd5e1;border-radius:8px;">
          <thead><tr style="background:#f1f5f9;"><th style="padding:8px 12px;text-align:left;border:1px solid #e2e8f0;">${escapeHtml(t("noColumn", "No"))}</th><th style="padding:8px 12px;text-align:left;border:1px solid #e2e8f0;">${escapeHtml(t("ticketCodeColumn", "Ticket code"))}</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <p style="margin:14px 0 0;font-size:12px;color:#64748b;">${escapeHtml(t("totalWord", "Total"))}: EUR ${priceText}</p>
        ${organizerHtmlLine(payload, t("labelOrganizer", "Organizer"))}
        <p style="margin:16px 0 0;font-size:14px;color:#0f172a;font-weight:600;">${escapeHtml(t("printNote", "Your tickets are in the attached PDF. You can print them. Enjoy the show."))}</p>
        <div style="font-size:11px;color:#64748b;margin-top:16px;">${escapeHtml(t("autoGenerated", "This email was generated automatically."))}</div>
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
              `${escapeHtml(s.section_name)} · ${t("rowWord", "Row")} ${escapeHtml(s.row_label)} · ${t("seatNrWord", "No")} ${escapeHtml(s.seat_label)}`
          )
          .join("; ")
      : "";

  const cellLabel = "padding:12px 16px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#64748b;";
  return `
    <div style="font-family:Arial,sans-serif;background:#eef2f7;padding:24px;">
      <div style="max-width:600px;margin:0 auto;">
        <h2 style="margin:0 0 10px;color:#0f172a;">${escapeHtml(t("greeting", "Hello {name},").replace("{name}", payload.buyerName || ""))}</h2>
        <p style="margin:0 0 6px;color:#334155;">${escapeHtml(t("orderCompleted", "Your order is complete. Your ticket is attached."))}</p>
        <p style="margin:0 0 16px;color:#334155;">${escapeHtml(t("singlePdfNote", "You can download and print the attached PDF. Enjoy the show."))}</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#fff;border:1px solid #cbd5e1;border-radius:8px;">
          <tr>
            <td style="${cellLabel}width:40%;">${escapeHtml(t("labelEvent", "Event"))}</td>
            <td style="${cellLabel}color:#0f172a;font-weight:600;">${eventTitle}</td>
          </tr>
          <tr>
            <td style="${cellLabel}">${escapeHtml(t("labelDateTime", "Date / time"))}</td>
            <td style="${cellLabel}color:#0f172a;">${eventDateText}, ${timeText}</td>
          </tr>
          <tr>
            <td style="${cellLabel}">${escapeHtml(t("labelVenue", "Venue"))}</td>
            <td style="${cellLabel}color:#0f172a;">${venueText}, ${locationText}</td>
          </tr>
          <tr>
            <td style="${cellLabel}">${escapeHtml(t("labelTicketCode", "Ticket code"))}</td>
            <td style="${cellLabel}color:#0f172a;font-family:monospace;font-weight:700;letter-spacing:1px;">${ticketCode}</td>
          </tr>
          ${seatLine ? `<tr><td style="${cellLabel}">${escapeHtml(t("labelSeat", "Seat"))}</td><td style="${cellLabel}color:#0f172a;font-weight:600;">${seatLine}</td></tr>` : ""}
          <tr>
            <td style="padding:12px 16px;font-size:13px;color:#64748b;">${escapeHtml(t("labelTotal", "Total"))}</td>
            <td style="padding:12px 16px;font-size:13px;color:#0f172a;font-weight:700;">EUR ${priceText}</td>
          </tr>
          ${
            payload.organizerName
              ? `<tr><td style="padding:12px 16px;font-size:13px;color:#64748b;">${escapeHtml(t("labelOrganizer", "Organizer"))}</td><td style="padding:12px 16px;font-size:13px;color:#0f172a;font-weight:600;">${escapeHtml(
                  payload.organizerName
                )}</td></tr>`
              : ""
          }
        </table>
        <div style="font-size:11px;color:#64748b;margin-top:20px;">${escapeHtml(t("autoGenerated", "This email was generated automatically."))}</div>
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

function wrapPdfLines(
  text: string,
  font: any,
  fontSize: number,
  maxWidth: number,
  maxLines = 2
): string[] {
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

  return lines.length ? lines : [""];
}

/**
 * Organizatör logosu diskten okunur ve bilet PDF'ine gömülür. webp pdf-lib
 * tarafından gömülemediği için yok sayılır — fatura PDF'iyle aynı kısıt.
 */
async function embedOrganizerLogo(doc: PDFDocument, logoPath?: string | null): Promise<PDFImage | null> {
  const relative = String(logoPath || "")
    .trim()
    .replace(/^\/+/, "");
  if (!relative || relative.includes("..") || relative.includes("\\")) return null;

  const ext = relative.toLowerCase().split(".").pop();
  if (ext !== "png" && ext !== "jpg" && ext !== "jpeg") return null;

  try {
    const bytes = await readFile(path.join(getLocalUploadDir(), relative));
    if (!bytes.length) return null;
    return ext === "png" ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
  } catch {
    return null;
  }
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
    ? new Date(payload.eventDate).toLocaleDateString("de-DE")
    : "-";

  const safeEventTitle = toPdfSafeText(payload.eventTitle || "Veranstaltung");
  const safeBuyerName = toPdfSafeText(payload.buyerName);
  const safeTicketType = toPdfSafeText(payload.ticketType);
  const safeVenue = toPdfSafeText(payload.venue);
  const safeLocation = toPdfSafeText(payload.location);
  const safeTicketCode = toPdfSafeText(payload.ticketCode);
  const safeDate = toPdfSafeText(eventDateText);
  const safeTime = toPdfSafeText(payload.eventTime || "--:--");

  const primary = rgb(220 / 255, 11 / 255, 44 / 255);
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
  const titleLines = wrapPdfLines(
    safeEventTitle,
    boldFont,
    20,
    stubX - leftX - 20,
    2
  );
  // Başlık, son satırı tarihin 22 puan üstünde kalacak şekilde aşağıdan yaslanır.
  titleLines.forEach((line, idx) => {
    page.drawText(line, {
      x: leftX,
      y: ticketY + 212 + (titleLines.length - 1 - idx) * 22,
      size: 20,
      font: boldFont,
      color: slate900,
    });
  });
  page.drawText(`${safeDate}, ${safeTime}`, {
    x: leftX,
    y: ticketY + 190,
    size: 14,
    font: boldFont,
    color: slate900,
  });
  page.drawText(safeVenue, {
    x: leftX,
    y: ticketY + 170,
    size: 12,
    font: boldFont,
    color: slate900,
  });
  page.drawText(safeLocation, {
    x: leftX,
    y: ticketY + 155,
    size: 11,
    font: regularFont,
    color: slate900,
  });

  // Veranstalter: adı salon adresinin altında, logosu çerçevenin içinde sağda.
  const organizerName = toPdfSafeText(payload.organizerName || "");
  const organizerLogo = await embedOrganizerLogo(pdfDoc, payload.organizerLogoPath);
  if (organizerName !== "-") {
    page.drawText("VERANSTALTER", {
      x: leftX,
      y: ticketY + 134,
      size: 8,
      font: regularFont,
      color: slate500,
    });
    page.drawText(organizerName.slice(0, 46), {
      x: leftX,
      y: ticketY + 120,
      size: 12,
      font: boldFont,
      color: slate900,
    });
  }
  if (organizerLogo) {
    const scale = Math.min(130 / organizerLogo.width, 58 / organizerLogo.height, 1);
    const logoW = organizerLogo.width * scale;
    const logoH = organizerLogo.height * scale;
    page.drawImage(organizerLogo, {
      x: stubX - 22 - logoW,
      y: ticketY + 138 - logoH,
      width: logoW,
      height: logoH,
    });
  }

  const seatRow: [string, string] | null =
    payload.seatDetails && payload.seatDetails.length > 0
      ? ["Platz / Reihe", payload.seatDetails.map((s) => `${s.section_name} · Reihe ${s.row_label} · Nr. ${s.seat_label}`).join("; ")]
      : null;
  const buyerRow: [string, string] | null =
    safeBuyerName !== "-" && safeBuyerName !== "Musteri" ? ["Inhaber", safeBuyerName] : null;
  const rows: Array<[string, string]> = [
    ["Kategorie", safeTicketType],
    ...(seatRow ? [seatRow] : []),
    ...(buyerRow ? [buyerRow] : []),
    ["Gesamtpreis", `${Number(payload.totalPrice).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR`],
  ];
  let y = ticketY + 98;
  for (const [label, value] of rows) {
    const safeValue = toPdfSafeText(value);
    page.drawText(label, { x: leftX, y, size: 11, font: regularFont, color: slate500 });
    page.drawText(safeValue.length > 50 ? safeValue.slice(0, 47) + "..." : safeValue, { x: leftX + 110, y, size: 10, font: boldFont, color: slate900 });
    y -= 19;
  }

  page.drawText("ABTRENNBARER ABSCHNITT", {
    x: stubX + 18,
    y: ticketY + 255,
    size: 10,
    font: boldFont,
    color: slate500,
  });
  page.drawText("Ticketnummer", {
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
  page.drawText(`${safeDate}, ${safeTime}`, {
    x: stubX + 18,
    y: ticketY + 187,
    size: 12,
    font: boldFont,
    color: slate900,
  });
  page.drawImage(qrImage, { x: stubX + 38, y: ticketY + 40, width: 120, height: 120 });
  page.drawText("QR-Code am Eingang scannen.", {
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

    const copy = await loadTicketEmailCopy(payload);
    const subject = copy
      .text("subject", "Your ticket is ready: {code}")
      .replace("{code}", payload.ticketCode);
    let html = await buildTicketEmailHtml(payload, copy);
    const pdfAttachment = await buildTicketPdfMultiPageBase64(payload);

    // QR ve barkod PDF'in içine gömülü; ayrı PNG ek yanıltıcıydı (çok biletli siparişte
    // yalnız ana kodun görseli gidiyordu) ve maile gereksiz ağırlık katıyordu.
    const attachment: Array<{ content: string; name: string }> = [
      { content: pdfAttachment, name: "kurdevents-e-bilet.pdf" },
    ];

    if (payload.invoicePdfBase64 && payload.invoiceNumber) {
      attachment.push({
        content: payload.invoicePdfBase64,
        name: `Rechnung-${payload.invoiceNumber}.pdf`,
      });
      const invoiceNote = copy
        .text(
          "invoiceNote",
          "The invoice for your ticket ({number}) is attached as a PDF file. You can download it again anytime from your account."
        )
        .replace("{number}", payload.invoiceNumber);
      html += `<div style="max-width:900px;margin:12px auto 0;padding:12px 16px;background:#ffffff;border:1px solid #cbd5e1;border-radius:8px;font-family:Arial,sans-serif;font-size:13px;color:#334155;">${escapeHtml(invoiceNote)}</div>`;
    }

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
      attachment: attachment
    };

    await brevo.transactionalEmails.sendTransacEmail(sendSmtpEmail);
    return { sent: true };
  } catch (error: any) {
    return { sent: false, reason: error.message };
  }
}
