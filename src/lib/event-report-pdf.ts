import path from "node:path";
import { readFile } from "node:fs/promises";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";

import type { EventReportData } from "@/lib/event-report";

/**
 * Almanca Veranstaltungsabrechnung (A4, tek sayfa hedefli).
 * pdf-lib standart fontlarında € glifi yok (sessizce düşer) → para birimi "EUR" yazılır.
 */

const PAGE = { width: 595, height: 842 };
const MARGIN = 50;
const CONTENT = PAGE.width - MARGIN * 2;

const brand = rgb(0.863, 0.043, 0.173);
const ink = rgb(0.09, 0.11, 0.15);
const muted = rgb(0.42, 0.45, 0.5);
const rule = rgb(0.78, 0.81, 0.86);
const headerBg = rgb(0.953, 0.953, 0.953);
const noteBg = rgb(0.98, 0.965, 0.949);

/** WinAnsi'nin şifreleyemediği Türkçe harfler; Almanca umlautlar korunur. */
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
  const symbol = currency === "TL" ? "TRY" : currency || "EUR";
  const amount = Number(value ?? 0).toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return pdfText(`${amount} ${symbol}`);
}

function shortDate(value: string | null | undefined): string {
  const raw = String(value || "").slice(0, 10);
  const [year, month, day] = raw.split("-");
  if (!year || !month || !day) return "–";
  return `${day}.${month}.${year}`;
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
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

type Column = { label: string; width: number; align: "left" | "right" };
type Row = { values: string[]; emphasis?: boolean; accent?: boolean; ruleTop?: boolean };

/** Sabit marka logosu: her etkinlikte ve her organizatörde aynı White de Soul logosu. */
async function embedBrandLogo(doc: PDFDocument): Promise<PDFImage | null> {
  try {
    const bytes = await readFile(path.join(process.cwd(), "public", "images", "white-de-soul-logo.png"));
    return await doc.embedPng(bytes);
  } catch {
    return null;
  }
}

export async function buildEventReportPdf(data: EventReportData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const logo = await embedBrandLogo(doc);
  const pages: PDFPage[] = [];
  let page = doc.addPage([PAGE.width, PAGE.height]);
  pages.push(page);
  let y = PAGE.height - MARGIN;

  const need = (height: number) => {
    if (y - height >= MARGIN + 24) return;
    page = doc.addPage([PAGE.width, PAGE.height]);
    pages.push(page);
    y = PAGE.height - MARGIN;
  };

  const write = (
    value: string,
    x: number,
    baseline: number,
    options: { size?: number; font?: PDFFont; color?: typeof ink } = {}
  ) => {
    page.drawText(pdfText(value), {
      x,
      y: baseline,
      size: options.size ?? 9.5,
      font: options.font ?? font,
      color: options.color ?? ink,
    });
  };

  const writeRight = (
    value: string,
    rightX: number,
    baseline: number,
    options: { size?: number; font?: PDFFont; color?: typeof ink } = {}
  ) => {
    const text = pdfText(value);
    const size = options.size ?? 9.5;
    const usedFont = options.font ?? font;
    page.drawText(text, {
      x: rightX - usedFont.widthOfTextAtSize(text, size),
      y: baseline,
      size,
      font: usedFont,
      color: options.color ?? ink,
    });
  };

  // ---------- Başlık ----------
  // Logo metin bloğunun solunda; metin sütunu logo genişliği kadar sağa kayar.
  const logoHeight = 34;
  const logoWidth = logo ? (logo.width / logo.height) * logoHeight : 0;
  if (logo) {
    page.drawImage(logo, {
      x: MARGIN,
      y: y - 36,
      width: logoWidth,
      height: logoHeight,
    });
  }
  const headerTextX = logo ? MARGIN + logoWidth + 12 : MARGIN;
  write("KurdEvents", headerTextX, y - 16, { size: 17, font: bold });
  write(data.event.seller.name, headerTextX, y - 30, { size: 8.5, color: muted });
  writeRight("VERANSTALTUNGSABRECHNUNG", PAGE.width - MARGIN, y - 15, { size: 14.5, font: bold });
  writeRight("Abrechnung für die Buchhaltung – keine Rechnung", PAGE.width - MARGIN, y - 29, {
    size: 8,
    color: muted,
  });
  y -= 40;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE.width - MARGIN, y },
    thickness: 2,
    color: brand,
  });
  y -= 18;

  // ---------- Meta ----------
  const leftValueRight = MARGIN + 235;
  const rightLabel = MARGIN + 260;
  const rightValueRight = PAGE.width - MARGIN;

  const metaRow = (leftLabel: string, leftValue: string, rightLabelText: string, rightValue: string) => {
    write(leftLabel, MARGIN, y - 9, { size: 8.5, color: muted });
    writeRight(leftValue, leftValueRight, y - 9, { size: 9 });
    write(rightLabelText, rightLabel, y - 9, { size: 8.5, color: muted });
    writeRight(rightValue, rightValueRight, y - 9, { size: 9 });
    y -= 18;
    page.drawLine({
      start: { x: MARGIN, y: y + 5 },
      end: { x: PAGE.width - MARGIN, y: y + 5 },
      thickness: 0.4,
      color: rule,
    });
  };

  const dateText = data.event.date
    ? `${shortDate(data.event.date)}${data.event.time ? `, ${data.event.time} Uhr` : ""}`
    : "–";
  const periodText =
    data.sales.periodFrom && data.sales.periodTo
      ? `${shortDate(data.sales.periodFrom)} – ${shortDate(data.sales.periodTo)}`
      : data.sales.periodFrom
        ? shortDate(data.sales.periodFrom)
        : "–";

  metaRow("Veranstaltung", data.event.title, "Datum", dateText);
  metaRow("Veranstaltungsort", data.event.venue || "–", "Veranstalter", data.event.seller.name);
  metaRow("Verkäufer", data.event.seller.name, "Verkaufszeitraum", periodText);
  metaRow(
    "USt-Satz Tickets",
    data.event.vatRate > 0 ? `${data.event.vatRate.toLocaleString("de-DE")} %` : "0 % (§ 19 UStG)",
    "Währung",
    data.event.currency
  );
  y -= 12;

  // ---------- Tablo ----------
  const table = (columns: Column[], rows: Row[]) => {
    const drawHeader = () => {
      const headerHeight = 16;
      need(headerHeight + 4);
      page.drawRectangle({
        x: MARGIN,
        y: y - headerHeight + 3,
        width: CONTENT,
        height: headerHeight,
        color: headerBg,
      });
      let x = MARGIN;
      for (const column of columns) {
        write(column.label.toUpperCase(), x + 4, y - 9, { size: 7.5, font: bold, color: muted });
        x += column.width;
      }
      y -= headerHeight;
    };

    drawHeader();

    for (const row of rows) {
      need(18);
      if (row.ruleTop) {
        page.drawLine({
          start: { x: MARGIN, y: y + 2 },
          end: { x: PAGE.width - MARGIN, y: y + 2 },
          thickness: 0.7,
          color: rule,
        });
      }
      let x = MARGIN;
      row.values.forEach((value, index) => {
        const column = columns[index];
        if (!column) return;
        const color = row.accent ? brand : ink;
        const usedFont = row.emphasis || row.accent ? bold : font;
        if (column.align === "right") {
          writeRight(value, x + column.width - 4, y - 10, { size: 9, font: usedFont, color });
        } else {
          write(value, x + 4, y - 10, { size: 9, font: usedFont, color });
        }
        x += column.width;
      });
      y -= 17;
      page.drawLine({
        start: { x: MARGIN, y: y + 4 },
        end: { x: PAGE.width - MARGIN, y: y + 4 },
        thickness: 0.4,
        color: rgb(0.93, 0.93, 0.93),
      });
    }
    y -= 12;
  };

  const sectionTitle = (label: string) => {
    need(26);
    write(label.toUpperCase(), MARGIN, y - 10, { size: 9.5, font: bold, color: rgb(0.27, 0.27, 0.27) });
    y -= 18;
  };

  const online = data.channels.filter((channel) => channel.channel === "online");
  const door = data.channels.filter((channel) => channel.channel === "door");
  const onlineTickets = online.reduce((sum, channel) => sum + channel.tickets, 0);
  const doorTickets = door.reduce((sum, channel) => sum + channel.tickets, 0);

  sectionTitle("Verkauf");
  table(
    [
      { label: "Position", width: 315, align: "left" },
      { label: "Menge", width: 80, align: "right" },
      { label: "Betrag", width: 100, align: "right" },
    ],
    [
      { values: ["Verkaufte Tickets (gesamt)", String(data.sales.tickets), ""] },
      { values: ["   davon Online", String(onlineTickets), ""] },
      { values: ["   davon Abendkasse", String(doorTickets), ""] },
      {
        values: [
          "Storni / Erstattungen",
          String(data.sales.cancelledOrders),
          money(0, data.event.currency),
        ],
      },
      {
        values: ["Bruttoverkauf", "", money(data.sales.gross, data.event.currency)],
        emphasis: true,
        ruleTop: true,
      },
      {
        values: [
          `enthaltene USt ${data.event.vatRate.toLocaleString("de-DE")} %`,
          "",
          money(data.sales.tax, data.event.currency),
        ],
      },
      {
        values: ["Nettoverkauf", "", money(data.sales.net, data.event.currency)],
        accent: true,
      },
    ]
  );

  if (data.ticketTypes.length > 0) {
    sectionTitle("Verkauf nach Ticketart");
    table(
      [
        { label: "Ticketart", width: 265, align: "left" },
        { label: "Einzelpreis", width: 90, align: "right" },
        { label: "Menge", width: 60, align: "right" },
        { label: "Betrag", width: 80, align: "right" },
      ],
      [
        ...data.ticketTypes.map((ticket) => ({
          values: [
            ticket.name,
            money(ticket.price, data.event.currency),
            String(ticket.tickets),
            money(ticket.gross, data.event.currency),
          ],
        })),
        {
          values: [
            "Gesamt",
            "",
            String(data.sales.tickets),
            money(data.sales.gross, data.event.currency),
          ],
          emphasis: true,
          ruleTop: true,
        },
      ]
    );
  }

  if (data.commission) {
    sectionTitle("Provision und Auszahlung");
    table(
      [
        { label: "Position", width: 315, align: "left" },
        { label: "Satz", width: 80, align: "right" },
        { label: "Betrag", width: 100, align: "right" },
      ],
      [
        {
          values: [
            "Plattformprovision (vom Bruttoverkauf)",
            `${data.commission.rate.toLocaleString("de-DE")} %`,
            money(data.commission.gross, data.event.currency),
          ],
        },
        { values: ["USt 19 % auf Provision", "", money(data.commission.tax, data.event.currency)] },
        { values: ["Provision netto", "", money(data.commission.net, data.event.currency)] },
        {
          values: ["Auszahlung an Veranstalter", "", money(data.commission.payout, data.event.currency)],
          accent: true,
          ruleTop: true,
        },
      ]
    );
  }

  sectionTitle("Ausgestellte Rechnungen");
  table(
    [
      { label: "Dokument", width: 205, align: "left" },
      { label: "Anzahl", width: 60, align: "right" },
      { label: "Nummernbereich", width: 150, align: "right" },
      { label: "Brutto", width: 80, align: "right" },
    ],
    [
      {
        values: [
          "Rechnungen (je Bestellung)",
          String(data.invoices.issued),
          data.invoices.min && data.invoices.max ? `${data.invoices.min} – ${data.invoices.max}` : "–",
          money(data.invoices.gross, data.event.currency),
        ],
      },
      {
        values: [
          "Stornierte Rechnungen",
          String(data.invoices.cancelled),
          "–",
          money(0, data.event.currency),
        ],
      },
    ]
  );

  // ---------- Notlar ----------
  const notes: Array<{ label: string; text: string }> = [];
  if (data.commission) {
    notes.push({
      label: "Provision:",
      text: "Der Provisionssatz wird pro Veranstalter bzw. Künstler manuell eingegeben und in dieser Abrechnung angewendet.",
    });
  } else {
    notes.push({
      label: "Provision:",
      text: "Für diese Veranstaltung ist kein Provisionssatz hinterlegt; es wird keine Provision berechnet.",
    });
  }
  notes.push({
    label: "Nummerierung:",
    text: `Alle Rechnungen werden fortlaufend im Format RE-${new Date().getFullYear()}-ET###### nummeriert; bei Stornierung bleibt die Nummer der stornierten Rechnung vergeben.`,
  });
  notes.push({
    label: "Buchhaltung:",
    text: "Diese Abrechnung fasst Verkäufe und Rechnungen einer Veranstaltung zusammen. Sie ersetzt keine Rechnung an Käufer; Einzelrechnungen (B2C auf Anfrage, B2B verpflichtend) bleiben davon unberührt.",
  });

  const noteSize = 8;
  const noteLineHeight = 11;
  const noteWidth = CONTENT - 22;
  const noteLines: Array<{ label?: string; text: string }> = [];
  for (const note of notes) {
    const labelWidth = bold.widthOfTextAtSize(pdfText(note.label), noteSize) + 4;
    const wrapped = wrapText(note.text, font, noteSize, noteWidth - labelWidth);
    wrapped.forEach((text, index) => {
      noteLines.push(index === 0 ? { label: note.label, text } : { text });
    });
    noteLines.push({ text: "" });
  }

  const noteHeight = noteLines.length * noteLineHeight + 14;
  need(noteHeight + 10);
  page.drawRectangle({
    x: MARGIN,
    y: y - noteHeight,
    width: CONTENT,
    height: noteHeight,
    color: noteBg,
  });
  page.drawRectangle({
    x: MARGIN,
    y: y - noteHeight,
    width: 3,
    height: noteHeight,
    color: brand,
  });
  let noteY = y - 12;
  for (const line of noteLines) {
    if (line.text) {
      const labelText = line.label ? pdfText(line.label) : "";
      if (labelText) {
        page.drawText(labelText, {
          x: MARGIN + 11,
          y: noteY,
          size: noteSize,
          font: bold,
          color: rgb(0.25, 0.25, 0.25),
        });
      }
      page.drawText(pdfText(line.text), {
        x: MARGIN + 11 + (labelText ? bold.widthOfTextAtSize(labelText, noteSize) + 4 : 0),
        y: noteY,
        size: noteSize,
        font,
        color: rgb(0.29, 0.29, 0.29),
      });
    }
    noteY -= noteLineHeight;
  }
  y -= noteHeight + 12;

  // ---------- Alt bilgi ----------
  const printedAt = new Date().toLocaleDateString("de-DE");
  pages.forEach((current, index) => {
    current.drawLine({
      start: { x: MARGIN, y: 38 },
      end: { x: PAGE.width - MARGIN, y: 38 },
      thickness: 0.4,
      color: rule,
    });
    current.drawText(pdfText(`KurdEvents · ${data.event.seller.name} · Stand ${printedAt}`), {
      x: MARGIN,
      y: 26,
      size: 7,
      font,
      color: muted,
    });
    const pageLabel = `Seite ${index + 1} von ${pages.length}`;
    current.drawText(pageLabel, {
      x: PAGE.width - MARGIN - font.widthOfTextAtSize(pageLabel, 7),
      y: 26,
      size: 7,
      font,
      color: muted,
    });
  });

  doc.setTitle(pdfText(`Veranstaltungsabrechnung – ${data.event.title}`));
  doc.setSubject(pdfText(`${shortDate(data.event.date)} · ${data.event.venue}`));
  doc.setCreator("KurdEvents");
  doc.setProducer("KurdEvents");

  return doc.save();
}
