import path from "node:path";
import { readFile } from "node:fs/promises";
import type { PDFDocument as PDFDocumentType, PDFFont, PDFImage } from "pdf-lib";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { getLocalUploadDir } from "@/lib/local-upload";
import type { InvoiceParty, InvoiceRow } from "@/lib/invoice";

/**
 * Almanca Rechnung PDF'i (A4). Mevcut bilet PDF'iyle aynı teknoloji: pdf-lib standart
 * fontları. PDF/A-3 içine XML gömme (Factur-X hibrit) standart fontlarla validasyondan
 * geçmez — font gömme gerekir; XML ayrı dosya olarak verilir (invoice-xrechnung.ts).
 */

const A4 = { width: 595, height: 842 };
const MARGIN = 50;

const brand = rgb(0.863, 0.043, 0.173);
const ink = rgb(0.09, 0.11, 0.15);
const muted = rgb(0.42, 0.45, 0.5);
const ruleColor = rgb(0.78, 0.81, 0.86);

/** WinAnsi'nin şifreleyemediği Türkçe harfler; Almanca umlautlar ve § korunur. */
function pdfText(value: unknown): string {
  return String(value ?? "")
    .replace(/ı/g, "i")
    .replace(/İ/g, "I")
    .replace(/ş/g, "s")
    .replace(/Ş/g, "S")
    .replace(/ğ/g, "g")
    .replace(/Ğ/g, "G");
}

function money(value: number, currency: string): string {
  const symbol = currency === "EUR" ? "€" : currency === "TL" ? "TRY" : currency;
  const amount = Number(value ?? 0).toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return pdfText(`${amount} ${symbol}`);
}

function dateDe(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = pdfText(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (!current || font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

/** Yapılandırılmış adresi fatura satırlarına çevirir; 153 öncesi düz metne düşer. */
function addressLines(party: InvoiceParty): string[] {
  const street = pdfText(party.street || "").trim();
  const plzCity = pdfText([party.postcode, party.city].filter(Boolean).join(" ")).trim();
  const parts = [street, plzCity].filter(Boolean);
  if (parts.length) {
    const country = pdfText(party.country || "").trim().toUpperCase();
    if (country && country !== "DE") parts.push(country);
    return parts;
  }
  return [pdfText(party.address || "").trim(), pdfText(party.city || "").trim()].filter(Boolean);
}

/**
 * Logo diskten okunur (webp pdf-lib tarafından gömülemez → yok sayılır).
 * Sıra: PNG, JPG/JPEG.
 */
async function embedLogo(doc: PDFDocumentType, logoPath?: string | null): Promise<PDFImage | null> {
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

export async function buildInvoicePdf(inv: InvoiceRow): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Rechnung ${inv.invoice_number}`);
  doc.setAuthor(String(inv.seller_snapshot.name || "Veranstalter"));
  doc.setSubject("Rechnung");
  doc.setProducer(String(inv.seller_snapshot.name || "Veranstalter"));
  doc.setCreationDate(new Date(inv.issued_at));

  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const page = doc.addPage([A4.width, A4.height]);
  const right = A4.width - MARGIN;
  const seller = inv.seller_snapshot;
  const buyer = inv.buyer_snapshot;
  const sellerAddress = addressLines(seller);

  // Sol üst: logo en solda, satıcı (organizatör) kimliği onun sağında ve aşağıda.
  const logo = await embedLogo(doc, seller.logo_path);
  let logoW = 0;
  let logoH = 0;
  if (logo) {
    const scale = Math.min(120 / logo.width, 48 / logo.height, 1);
    logoW = logo.width * scale;
    logoH = logo.height * scale;
  }
  const sellerX = MARGIN + (logo ? logoW + 16 : 0);
  const sellerTop = A4.height - 96;
  const sellerMaxWidth = Math.max(120, right - 215 - sellerX - 12);
  if (logo) {
    page.drawImage(logo, { x: MARGIN, y: sellerTop - logoH + 12, width: logoW, height: logoH });
  }

  let headerY = sellerTop;
  for (const line of wrap(seller.name || "Veranstalter", bold, 13, sellerMaxWidth)) {
    page.drawText(line, { x: sellerX, y: headerY, size: 13, font: bold, color: ink });
    headerY -= 15;
  }
  headerY -= 2;
  for (const line of sellerAddress) {
    for (const text of wrap(line, regular, 10.5, sellerMaxWidth)) {
      page.drawText(text, { x: sellerX, y: headerY, size: 10.5, font: regular, color: ink });
      headerY -= 13;
    }
  }
  const sellerTaxLine = [
    seller.vat_id ? `USt-IdNr. ${pdfText(seller.vat_id)}` : "",
    seller.tax_id ? `Steuer-Nr. ${pdfText(seller.tax_id)}` : "",
  ]
    .filter(Boolean)
    .join("  \u00B7  ");
  if (sellerTaxLine) {
    page.drawText(sellerTaxLine, {
      x: sellerX,
      y: headerY,
      size: 9.5,
      font: regular,
      color: muted,
    });
  }

  // Başlık ve meta (sağ sütun).
  page.drawText("RECHNUNG", {
    x: right - 210,
    y: A4.height - 96,
    size: 21,
    font: bold,
    color: brand,
  });
  const meta: Array<[string, string]> = [
    ["Rechnungs-Nr.", inv.invoice_number],
    ["Datum", dateDe(inv.issued_at)],
    ["Bestell-Nr.", String(inv.order_id).slice(0, 8).toUpperCase()],
    ["Zahlungsart", inv.payment_method || "-"],
  ];
  let metaY = A4.height - 120;
  for (const [label, value] of meta) {
    page.drawText(pdfText(label), {
      x: right - 210,
      y: metaY,
      size: 8.5,
      font: regular,
      color: muted,
    });
    page.drawText(pdfText(value), {
      x: right - 120,
      y: metaY,
      size: 9.5,
      font: bold,
      color: ink,
    });
    metaY -= 14;
  }

  // Empfänger bloğu.
  page.drawText("Rechnungsempf\u00E4nger", {
    x: MARGIN,
    y: A4.height - 202,
    size: 8,
    font: bold,
    color: muted,
  });
  let y = A4.height - 217;
  for (const raw of [buyer.name || "Gast", buyer.address || "", buyer.city || "", buyer.email || ""]) {
    for (const text of wrap(String(raw), regular, 11, 250)) {
      page.drawText(text, { x: MARGIN, y, size: 11, font: regular, color: ink });
      y -= 13.5;
    }
  }

  if (inv.status === "cancelled") {
    page.drawRectangle({
      x: right - 130,
      y: metaY - 12,
      width: 100,
      height: 26,
      borderColor: brand,
      borderWidth: 1.4,
    });
    page.drawText("STORNO", {
      x: right - 116,
      y: metaY - 4,
      size: 15,
      font: bold,
      color: brand,
    });
    if (inv.storno_reason) {
      page.drawText(pdfText(inv.storno_reason), {
        x: right - 210,
        y: metaY - 26,
        size: 8,
        font: regular,
        color: muted,
      });
    }
  }

  // Kalem tablosu.
  const tableTop = Math.min(y - 20, A4.height - 268);
  const colQty = A4.width - 262;
  const colUnit = A4.width - 190;
  const colTotal = right - 78;

  page.drawLine({
    start: { x: MARGIN, y: tableTop + 14 },
    end: { x: right, y: tableTop + 14 },
    thickness: 1,
    color: ruleColor,
  });
  page.drawText(pdfText("Leistungsbeschreibung"), {
    x: MARGIN,
    y: tableTop,
    size: 8.5,
    font: bold,
    color: muted,
  });
  page.drawText("Menge", { x: colQty, y: tableTop, size: 8.5, font: bold, color: muted });
  page.drawText("Einzelpreis", { x: colUnit, y: tableTop, size: 8.5, font: bold, color: muted });
  page.drawText("netto", { x: colUnit, y: tableTop - 10, size: 8.5, font: bold, color: muted });
  page.drawText("Gesamt", { x: colTotal, y: tableTop, size: 8.5, font: bold, color: muted });
  page.drawText("netto", { x: colTotal, y: tableTop - 10, size: 8.5, font: bold, color: muted });

  let rowY = tableTop - 26;
  for (const item of inv.line_items) {
    const descLines = wrap(item.text, regular, 10.5, 280);
    descLines.forEach((text, idx) => {
      page.drawText(text, {
        x: MARGIN,
        y: rowY - idx * 13,
        size: 10.5,
        font: regular,
        color: ink,
      });
    });
    page.drawText(String(item.qty), { x: colQty, y: rowY, size: 10.5, font: regular, color: ink });
    page.drawText(money(item.unit_net, inv.currency), {
      x: colUnit,
      y: rowY,
      size: 10.5,
      font: regular,
      color: ink,
    });
    page.drawText(money(item.line_net, inv.currency), {
      x: colTotal,
      y: rowY,
      size: 10.5,
      font: bold,
      color: ink,
    });
    rowY -= Math.max(descLines.length, 1) * 13 + 8;
  }

  page.drawLine({
    start: { x: MARGIN, y: rowY + 10 },
    end: { x: right, y: rowY + 10 },
    thickness: 1,
    color: ruleColor,
  });

  // Toplam bloğu.
  const sumX = right - 210;
  let sumY = rowY - 8;
  const totals: Array<[string, string, boolean]> = [
    ["Nettobetrag", money(inv.net_total, inv.currency), false],
    [
      inv.tax_category === "E"
        ? "Umsatzsteuer (\u00A7 19 UStG)"
        : `Umsatzsteuer ${String(inv.tax_rate).replace(".", ",")} %`,
      money(inv.tax_total, inv.currency),
      false,
    ],
    ["Gesamtbetrag", money(inv.gross_total, inv.currency), true],
  ];
  for (const [label, value, strong] of totals) {
    page.drawText(pdfText(label), {
      x: sumX,
      y: sumY,
      size: strong ? 11.5 : 10,
      font: strong ? bold : regular,
      color: strong ? brand : ink,
    });
    page.drawText(value, {
      x: colTotal,
      y: sumY,
      size: strong ? 11.5 : 10,
      font: strong ? bold : regular,
      color: strong ? brand : ink,
    });
    sumY -= strong ? 22 : 15;
  }

  // Notlar.
  let noteY = Math.min(sumY - 14, rowY - 52);
  const notes: string[] = [];
  if (inv.tax_category === "E") {
    notes.push(
      "Gem\u00E4\u00DF \u00A7 19 UStG wird keine Umsatzsteuer berechnet (Kleinunternehmerregelung)."
    );
  }
  notes.push(
    "Der Rechnungsbetrag ist mit der Buchung vollst\u00E4ndig bezahlt; eine weitere Zahlung ist nicht erforderlich."
  );
  if (inv.status === "cancelled") {
    notes.push("Diese Rechnung wurde storniert und darf nicht als Beleg verwendet werden.");
  }
  for (const note of notes) {
    for (const text of wrap(note, regular, 9, 470)) {
      page.drawText(text, { x: MARGIN, y: noteY, size: 9, font: regular, color: muted });
      noteY -= 12;
    }
    noteY -= 4;
  }

  // Altbilgi: satıcının vergi bilgileri.
  page.drawLine({
    start: { x: MARGIN, y: 76 },
    end: { x: right, y: 76 },
    thickness: 0.8,
    color: ruleColor,
  });
  const footerParts: string[][] = [
    [
      [seller.name, seller.legal_form].filter(Boolean).map((v) => pdfText(String(v))).join(", "),
      seller.representative ? `Vertreter: ${pdfText(seller.representative)}` : "",
    ].filter(Boolean),
    sellerAddress.map((line) => pdfText(line)),
    [
      seller.vat_id ? `USt-IdNr. ${pdfText(seller.vat_id)}` : "",
      seller.tax_id ? `Steuer-Nr. ${pdfText(seller.tax_id)}` : "",
      seller.register ? `Registernummer ${pdfText(seller.register)}` : "",
      seller.register_court ? pdfText(seller.register_court) : "",
    ].filter(Boolean),
    [
      seller.email ? pdfText(seller.email) : "",
      seller.phone ? pdfText(seller.phone) : "",
      "Verk\u00E4ufer ist der Veranstalter; KurdEvents vermittelt den Verkauf.",
    ].filter(Boolean),
  ];

  let footY = 64;
  for (const group of footerParts) {
    const text = group.join("  |  ");
    if (!text) continue;
    for (const line of wrap(text, regular, 8, 495)) {
      page.drawText(line, { x: MARGIN, y: footY, size: 8, font: regular, color: muted });
      footY -= 11;
    }
  }

  return doc.save();
}
