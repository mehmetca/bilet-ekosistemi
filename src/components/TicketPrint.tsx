"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useTranslations } from "next-intl";
import QRCode from "qrcode";
import { Printer, Download } from "lucide-react";
import type { EventCurrency, TicketType } from "@/types/database";
import { formatPrice } from "@/lib/formatPrice";
import { formatEventDateDMY } from "@/lib/date-utils";
import type { SeatDetail } from "@/types/seat-detail";
import deMessages from "../../messages/de.json";

export type { SeatDetail };

/** E-bilet kartındaki tüm sabit metinler (tablo başlıkları, QR ipucu, mavi şerit vb.) her zaman Almanca. */
type TicketDocumentDe = (typeof deMessages)["ticketPrint"];

/**
 * Bazı akışlarda etkinlik adı yerine "Bilet - BLT-…" veya yalın BLT kodu yanlışlıkla iletilebiliyor;
 * kartın büyük başlığında bilet kodu gösterme.
 */
function looksLikeTicketLabelInsteadOfEventTitle(raw: string): boolean {
  const s = String(raw || "").trim();
  if (!s) return true;
  if (/^(?:Bilet|Ticket|Bilêt|بلیت)\s*[-–:]\s*BLT-?[A-Z0-9]{4,}\s*$/iu.test(s)) return true;
  const compact = s.replace(/\s+/g, "").toUpperCase();
  return /^BLT-?[A-Z0-9]{4,}$/.test(compact);
}

/** `tickets.type`: yalnızca vip ise VIP Bilet gösterilir; katalog/bölüm adı bu satırda kullanılmaz */
function normalizedTicketTier(tier: TicketType | string | null | undefined): TicketType {
  return String(tier ?? "").trim().toLowerCase() === "vip" ? "vip" : "normal";
}

interface TicketPrintProps {
  ticketCode: string;
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  venue: string;
  location: string;
  buyerName: string;
  quantity: number;
  ticketTier?: TicketType | string | null;
  price: number;
  currency?: EventCurrency | null;
  /** KurdEvents bilgisi (Platz / Koltuk) */
  seatDetails?: SeatDetail[] | null;
  /** Koltuksuz çoklu alımlarda: her adet için tekil bilet kodları */
  ticketCodes?: string[] | null;
}

export default function TicketPrint({
  ticketCode,
  eventTitle,
  eventDate,
  eventTime,
  venue,
  location,
  buyerName,
  quantity,
  ticketTier,
  price,
  currency,
  seatDetails,
  ticketCodes,
}: TicketPrintProps) {
  const tpDe = deMessages.ticketPrint;
  const tTicket = useCallback(
    (key: keyof TicketDocumentDe) => String(tpDe[key] ?? ""),
    []
  );
  /** Sayfa dilinde: yazdır / indir butonları, ipucu, indirme dosya adı ve yazdırma sekmesi başlığı */
  const tUi = useTranslations("ticketPrint");
  const printDocumentTitleResolved = tUi("printDocumentTitle");
  const downloadHtmlFilenameResolved = tUi("downloadHtmlFilename");

  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  /** Her koltuk için ayrı bilet kodu olduğunda code -> QR data URL */
  const [qrCodesMap, setQrCodesMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const eventDateText = eventDate ? formatEventDateDMY(eventDate) : "-";
  const timeText = eventTime || "--:--";
  const displayEventTitle = looksLikeTicketLabelInsteadOfEventTitle(eventTitle)
    ? tTicket("fallbackEventTitle")
    : eventTitle.trim() || tTicket("fallbackEventTitle");
  const displayTicketTierLabel =
    normalizedTicketTier(ticketTier) === "vip" ? tTicket("ticketClassVip") : tTicket("ticketClassStandard");
  const totalPriceNumber = Number(price);
  const normalizedTicketCodes = useMemo(
    () =>
      (ticketCodes || [])
        .map((code) => String(code || "").trim())
        .filter((code) => code.length > 0),
    [ticketCodes]
  );
  const ticketItems = useMemo(
    () =>
      seatDetails && seatDetails.length > 0
        ? seatDetails.map((seat) => ({ seat, code: seat.ticket_code || ticketCode }))
        : normalizedTicketCodes.length > 0
          ? normalizedTicketCodes.map((code) => ({ seat: null as SeatDetail | null, code }))
          : [{ seat: null as SeatDetail | null, code: ticketCode }],
    [seatDetails, normalizedTicketCodes, ticketCode]
  );
  const singleSeatDetail = seatDetails && seatDetails.length === 1 ? seatDetails[0] : null;
  const hasMultipleTickets = ticketItems.length > 1;
  const unitCount = quantity > 0 ? quantity : ticketItems.length;
  const unitPrice = Number((totalPriceNumber / Math.max(unitCount, 1)).toFixed(2));

  const formatSeatLine = useCallback(
    (seat: SeatDetail) =>
      tTicket("seatLine")
        .replace("{section}", String(seat.section_name ?? ""))
        .replace("{row}", String(seat.row_label ?? ""))
        .replace("{seat}", String(seat.seat_label ?? "")),
    [tTicket]
  );

  const printBannerTitle = tTicket("printBannerTitle");

  useEffect(() => {
    const generateQR = async () => {
      try {
        const origin =
          typeof window !== "undefined" ? window.location.origin : "";
        const codesToGenerate = [...new Set(ticketItems.map((item) => item.code))];

        if (codesToGenerate.length === 1) {
          // Tek satırda da gerçek okutma kodu kullanılmalı: order_ticket_units veya koltuk kodu,
          // orders.ticket_code (ana sipariş kodu) ile ayrı olabilir; yanlış QR "tekil kod okutun" hatası verir.
          const codeForQr = codesToGenerate[0]!;
          const qrData = origin
            ? `${origin}/yonetim/bilet-kontrol?code=${encodeURIComponent(codeForQr)}`
            : codeForQr;
          const url = await QRCode.toDataURL(qrData, {
            width: 130,
            margin: 1,
            color: { dark: "#1e293b", light: "#ffffff" },
          });
          setQrCodeUrl(url);
          setQrCodesMap({});
        } else {
          const map: Record<string, string> = {};
          for (const code of codesToGenerate) {
            const qrData = origin
              ? `${origin}/yonetim/bilet-kontrol?code=${encodeURIComponent(code)}`
              : code;
            map[code] = await QRCode.toDataURL(qrData, {
              width: 130,
              margin: 1,
              color: { dark: "#1e293b", light: "#ffffff" },
            });
          }
          setQrCodesMap(map);
          setQrCodeUrl("");
        }
      } catch (error) {
        console.error("QR kod oluşturma hatası:", error);
      } finally {
        setLoading(false);
      }
    };

    generateQR();
  }, [ticketCode, eventTitle, eventDate, eventTime, venue, buyerName, quantity, ticketItems]);

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const documentTitlePlain = printDocumentTitleResolved;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const esc = (s: string) =>
      String(s || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

    const L = {
      subtitle: esc(tTicket("ticketSubtitle")),
      colTicketType: esc(tTicket("ticketType")),
      ticketClass: esc(displayTicketTierLabel),
      seatCol: esc(tTicket("seat")),
      guestCol: esc(tTicket("personOnly")),
      totalCol: esc(tTicket("total")),
      tearOff: esc(tTicket("tearOffSection")),
      ticketCodeLbl: esc(tTicket("ticketCode")),
      qrHint: esc(tTicket("qrHint")),
      barcodeAltTxt: esc(tTicket("barcodeAlt")),
      qrAltTxt: esc(tTicket("qrAlt")),
    };

    const printItems = ticketItems;
    const makeTicketHtmlForSeat = (item: { seat: SeatDetail | null; code: string }) => {
      const { seat, code: codeForSeat } = item;
      const barcodeFullUrlForSeat = `${origin}/api/barcode?code=${encodeURIComponent(codeForSeat)}`;
      const verticalCodeHtmlForSeat = codeForSeat
        .split("")
        .map((ch) => `<span style="display:block;line-height:9px;font-size:9px;font-family:monospace;">${esc(ch)}</span>`)
        .join("");
      const qrUrlForSeat = qrCodesMap[codeForSeat] ?? qrCodeUrl;

      const seatLine =
        seat != null
          ? formatSeatLine(seat)
          : singleSeatDetail
            ? formatSeatLine(singleSeatDetail)
            : "";
      const priceForThis = hasMultipleTickets ? unitPrice : totalPriceNumber;
      const priceTextForThis = formatPrice(priceForThis, currency);

      return `
      <div style="max-width:900px;margin:0 auto;border:1px solid #cbd5e1;border-radius:12px;overflow:hidden;background:#fff;">
        <div style="background:#003f8c;color:#fff;padding:10px 18px;font-size:14px;font-weight:700;letter-spacing:.4px;">
          ${esc(printBannerTitle)}
        </div>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          <tr>
            <td style="width:73%;padding:14px 16px;vertical-align:top;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                <tr>
                  <td style="width:74px;vertical-align:top;padding-right:12px;">
                    <div style="display:flex;gap:6px;align-items:flex-start;">
                      <div style="width:42px;height:250px;border:1px solid #e2e8f0;background:#fff;overflow:hidden;">
                        <img src="${barcodeFullUrlForSeat}" alt="${L.barcodeAltTxt}" width="36" height="238" style="display:block;" />
                      </div>
                      <div style="font-size:9px;letter-spacing:.7px;font-family:monospace;color:#000;">${verticalCodeHtmlForSeat}</div>
                    </div>
                  </td>
                  <td style="vertical-align:top;">
                    <p style="margin:0;font-size:10px;font-weight:700;letter-spacing:.4px;color:#000;">${L.subtitle}</p>
                    <p style="margin:6px 0 0;font-size:36px;line-height:42px;font-weight:900;color:#000;">${esc(displayEventTitle)}</p>
                    <p style="margin:12px 0 0;font-size:18px;line-height:22px;font-weight:800;color:#000;">${eventDateText}, ${timeText}</p>
                    <p style="margin:4px 0 0;font-size:13px;line-height:16px;color:#000;font-weight:700;">${esc(venue)}</p>
                    <p style="margin:2px 0 0;font-size:13px;color:#000;">${esc(location)}</p>
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;border-collapse:collapse;font-size:12px;color:#000;">
                      <tr><td style="padding:2px 0;">${L.colTicketType}</td><td style="padding:2px 0;font-weight:700;text-align:right;">${L.ticketClass}</td></tr>
                      ${
                        seatLine
                          ? `<tr><td style="padding:2px 0;">${L.seatCol}</td><td style="padding:2px 0;font-weight:700;text-align:right;">${esc(
                              seatLine
                            )}</td></tr>`
                          : ""
                      }
                      <tr><td style="padding:2px 0;">${L.guestCol}</td><td style="padding:2px 0;font-weight:700;text-align:right;">${esc(
                        buyerName
                      )}</td></tr>
                      <tr><td style="padding:2px 0;">${L.totalCol}</td><td style="padding:2px 0;font-weight:800;text-align:right;">${esc(
                        priceTextForThis
                      )}</td></tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
            <td style="width:27%;padding:14px 16px;vertical-align:top;border-left:2px dashed #94a3b8;">
              <p style="margin:0;font-size:10px;font-weight:700;letter-spacing:.6px;color:#000;">${L.tearOff}</p>
              <p style="margin:0 0 8px 0;font-weight:500;color:#1e293b;">kurdevents</p>
              <p style="margin:8px 0 0;font-size:12px;font-weight:700;color:#000;">${L.ticketCodeLbl}</p>
              <p style="margin:2px 0 0;font-size:18px;font-weight:800;letter-spacing:1px;font-family:monospace;color:#000;">${esc(codeForSeat)}</p>
              <div style="margin-top:10px;text-align:center;">
                <img src="${qrUrlForSeat}" alt="${L.qrAltTxt}" width="130" height="130" style="border:1px solid #e2e8f0;padding:6px;background:#fff;" />
              </div>
              <p style="margin:6px 0 0;font-size:10px;color:#000;text-align:center;">${L.qrHint}</p>
            </td>
          </tr>
        </table>
      </div>
    `;
    };

    const ticketHtml = printItems
      .map((item) => `<div class="print-ticket">${makeTicketHtmlForSeat(item)}</div>`)
      .join("");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${esc(documentTitlePlain)}</title>
          <style>
            * { box-sizing: border-box; }
            body { margin: 0; padding: 12px; font-family: Arial, sans-serif; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
            .print-page { display: block; page-break-after: always; }
            .print-page:last-child { page-break-after: auto; }
            .print-ticket { width: 100%; max-width: 900px; margin: 0 auto 12px auto; }
            .print-ticket > div { max-width: 100% !important; }
            @media print { body { padding: 8px; } .print-ticket { margin-bottom: 8px; } }
          </style>
        </head>
        <body>${ticketHtml}</body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();

    const printWhenReady = () => {
      const imgs = printWindow.document.images;
      if (imgs.length === 0) {
        printWindow.print();
        printWindow.close();
        return;
      }
      let loaded = 0;
      const check = () => {
        loaded++;
        if (loaded >= imgs.length) {
          setTimeout(() => {
            printWindow.print();
            printWindow.close();
          }, 100);
        }
      };
      for (let i = 0; i < imgs.length; i++) {
        if (imgs[i].complete) check();
        else imgs[i].onload = check;
      }
    };
    setTimeout(printWhenReady, 300);
  };

  const handleDownload = async () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    setDownloading(true);
    const downloadItems = ticketItems;
    const distinctCodes = [...new Set(downloadItems.map((item) => item.code))];

    const fallbackBarcode = "data:image/svg+xml," + encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="238" viewBox="0 0 36 238"><rect width="36" height="238" fill="#f1f5f9"/><text x="18" y="120" text-anchor="middle" font-size="10" fill="#64748b">${tTicket("barcodeLoadingPlaceholder")}</text></svg>`
    );
    const barcodeDataUrls: Record<string, string> = {};
    for (const code of distinctCodes) {
      try {
        const barcodeRes = await fetch(`${origin}/api/barcode?code=${encodeURIComponent(code)}`);
        if (barcodeRes.ok) {
          const blob = await barcodeRes.blob();
          barcodeDataUrls[code] = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        }
      } catch (e) {
        console.warn("Barkod yüklenemedi:", e);
      }
      if (!barcodeDataUrls[code]) barcodeDataUrls[code] = fallbackBarcode;
    }

    const esc = (s: string) =>
      String(s || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

    const LD = {
      subtitle: esc(tTicket("ticketSubtitle")),
      colTicketType: esc(tTicket("ticketType")),
      ticketClass: esc(displayTicketTierLabel),
      seatCol: esc(tTicket("seat")),
      guestCol: esc(tTicket("personOnly")),
      totalCol: esc(tTicket("total")),
      tearOff: esc(tTicket("tearOffSection")),
      ticketCodeLbl: esc(tTicket("ticketCode")),
      qrHint: esc(tTicket("qrHint")),
      barcodeAltTxt: esc(tTicket("barcodeAlt")),
      qrAltTxt: esc(tTicket("qrAlt")),
    };

    const makeTicketHtmlForSeat = (item: { seat: SeatDetail | null; code: string }) => {
      const { seat, code: codeForSeat } = item;
      const barcodeDataUrl = barcodeDataUrls[codeForSeat] ?? fallbackBarcode;
      const verticalCodeHtmlForSeat = codeForSeat
        .split("")
        .map((ch) => `<span style="display:block;line-height:9px;font-size:9px;font-family:monospace;">${esc(ch)}</span>`)
        .join("");
      const qrUrlForSeat = qrCodesMap[codeForSeat] ?? qrCodeUrl;

      const seatLine =
        seat != null
          ? formatSeatLine(seat)
          : singleSeatDetail
            ? formatSeatLine(singleSeatDetail)
            : "";
      const priceForThis = hasMultipleTickets ? unitPrice : totalPriceNumber;
      const priceTextForThis = formatPrice(priceForThis, currency);

      return `
      <div style="max-width:900px;margin:0 auto;border:1px solid #cbd5e1;border-radius:12px;overflow:hidden;background:#fff;">
        <div style="background:#003f8c;color:#fff;padding:10px 18px;font-size:14px;font-weight:700;letter-spacing:.4px;">
          ${esc(printBannerTitle)}
        </div>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          <tr>
            <td style="width:73%;padding:14px 16px;vertical-align:top;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                <tr>
                  <td style="width:74px;vertical-align:top;padding-right:12px;">
                    <div style="display:flex;gap:6px;align-items:flex-start;">
                      <div style="width:42px;height:250px;border:1px solid #e2e8f0;background:#fff;overflow:hidden;">
                        <img src="${esc(barcodeDataUrl)}" alt="${LD.barcodeAltTxt}" width="36" height="238" style="display:block;" />
                      </div>
                      <div style="font-size:9px;letter-spacing:.7px;font-family:monospace;color:#000;">${verticalCodeHtmlForSeat}</div>
                    </div>
                  </td>
                  <td style="vertical-align:top;">
                    <p style="margin:0;font-size:10px;font-weight:700;letter-spacing:.4px;color:#000;">${LD.subtitle}</p>
                    <p style="margin:6px 0 0;font-size:36px;line-height:42px;font-weight:900;color:#000;">${esc(displayEventTitle)}</p>
                    <p style="margin:12px 0 0;font-size:18px;line-height:22px;font-weight:800;color:#000;">${eventDateText}, ${timeText}</p>
                    <p style="margin:4px 0 0;font-size:13px;line-height:16px;color:#000;font-weight:700;">${esc(venue)}</p>
                    <p style="margin:2px 0 0;font-size:13px;color:#000;">${esc(location)}</p>
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;border-collapse:collapse;font-size:12px;color:#000;">
                      <tr><td style="padding:2px 0;">${LD.colTicketType}</td><td style="padding:2px 0;font-weight:700;text-align:right;">${LD.ticketClass}</td></tr>
                      ${seatLine ? `<tr><td style="padding:2px 0;">${LD.seatCol}</td><td style="padding:2px 0;font-weight:700;text-align:right;">${esc(seatLine)}</td></tr>` : ""}
                      <tr><td style="padding:2px 0;">${LD.guestCol}</td><td style="padding:2px 0;font-weight:700;text-align:right;">${esc(buyerName)}</td></tr>
                      <tr><td style="padding:2px 0;">${LD.totalCol}</td><td style="padding:2px 0;font-weight:800;text-align:right;">${esc(priceTextForThis)}</td></tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
            <td style="width:27%;padding:14px 16px;vertical-align:top;border-left:2px dashed #94a3b8;">
              <p style="margin:0;font-size:10px;font-weight:700;letter-spacing:.6px;color:#000;">${LD.tearOff}</p>
              <p style="margin:0 0 8px 0;font-weight:500;color:#1e293b;">kurdevents</p>
              <p style="margin:8px 0 0;font-size:12px;font-weight:700;color:#000;">${LD.ticketCodeLbl}</p>
              <p style="margin:2px 0 0;font-size:18px;font-weight:800;letter-spacing:1px;font-family:monospace;color:#000;">${esc(codeForSeat)}</p>
              <div style="margin-top:10px;text-align:center;">
                <img src="${qrUrlForSeat ? esc(qrUrlForSeat) : ""}" alt="${LD.qrAltTxt}" width="130" height="130" style="border:1px solid #e2e8f0;padding:6px;background:#fff;" />
              </div>
              <p style="margin:6px 0 0;font-size:10px;color:#000;text-align:center;">${LD.qrHint}</p>
            </td>
          </tr>
        </table>
      </div>
    `;
    };

    const documentTitlePlain = printDocumentTitleResolved;
    const fullHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${esc(documentTitlePlain)}</title>
          <style>
            * { box-sizing: border-box; }
            body { margin: 0; padding: 12px; font-family: Arial, sans-serif; }
            .print-page { display: block; page-break-after: always; }
            .print-page:last-child { page-break-after: auto; }
            .print-ticket { width: 100%; max-width: 900px; margin: 0 auto 12px auto; }
            .print-ticket > div { max-width: 100% !important; }
          </style>
        </head>
        <body>
          <div class="print-page">
            ${downloadItems
              .map((item) => `<div class="print-ticket">${makeTicketHtmlForSeat(item)}</div>`)
              .join("")}
          </div>
        </body>
      </html>
    `;

    const blob = new Blob([fullHtml], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = downloadHtmlFilenameResolved;
    a.click();
    URL.revokeObjectURL(url);
    setDownloading(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
      </div>
    );
  }

  const ticketsForRender = ticketItems;

  return (
    <div className="space-y-6">
      {/* Bilet Kartı - Tasarımlı (her koltuk için ayrı) */}
      <div className="space-y-6">
        {ticketsForRender.map((item, idx) => {
          const { seat, code: codeForSeat } = item;
          const barcodeSrcForSeat = `/api/barcode?code=${encodeURIComponent(codeForSeat)}`;
          const qrUrlForSeat = qrCodesMap[codeForSeat] ?? qrCodeUrl;
          const seatLine =
            seat != null
              ? formatSeatLine(seat)
              : singleSeatDetail
                ? formatSeatLine(singleSeatDetail)
                : "";
          const priceForThis = hasMultipleTickets ? unitPrice : totalPriceNumber;

          return (
            <div
              key={idx}
              className="relative mx-auto max-w-[900px] overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm"
            >
        {/* Header */}
        <div className="bg-[#003f8c] px-4 py-2.5 text-sm font-bold tracking-wide text-white">
          {printBannerTitle}
        </div>

        {/* Ana içerik */}
        <div className="relative flex">
          {/* Sol: Barkod + Bilgiler (73%) */}
          <div className="flex min-w-0 flex-1 gap-4 p-4" style={{ width: "73%" }}>
            <div className="flex flex-shrink-0 items-start gap-1.5">
              <div className="flex h-[250px] w-[42px] items-center justify-center overflow-hidden rounded border border-slate-200 bg-white">
                <img
                  src={barcodeSrcForSeat}
                  alt={tTicket("barcodeAlt")}
                  className="h-[238px] w-[36px] object-contain"
                />
              </div>
              <div className="flex flex-col text-[9px] font-mono leading-[9px] tracking-wide text-black">
                {codeForSeat.split("").map((ch, i) => (
                  <span key={i}>{ch}</span>
                ))}
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold tracking-wide text-black">{tTicket("ticketSubtitle")}</p>
              <p className="mt-1.5 truncate text-4xl font-black leading-tight text-black md:text-5xl">
                {displayEventTitle}
              </p>
              <p className="mt-3 text-lg font-extrabold text-black">
                {eventDateText}, {timeText}
              </p>
              <p className="mt-1 text-[13px] font-bold text-black">{venue}</p>
              <p className="mt-0.5 text-[13px] text-black">{location}</p>
              <table className="mt-3 w-full border-collapse text-xs text-black">
                <tbody>
                  <tr>
                    <td className="py-0.5">{tTicket("ticketType")}</td>
                    <td className="py-0.5 text-right font-bold">{displayTicketTierLabel}</td>
                  </tr>
                  {seatLine && (
                    <tr>
                      <td className="py-0.5">{tTicket("seat")}</td>
                      <td className="py-0.5 text-right font-bold">{seatLine}</td>
                    </tr>
                  )}
                  <tr>
                    <td className="py-0.5">{tTicket("personOnly")}</td>
                    <td className="py-0.5 text-right font-bold">{buyerName}</td>
                  </tr>
                  <tr>
                    <td className="py-0.5">{tTicket("total")}</td>
                    <td className="py-0.5 text-right font-extrabold">
                      {formatPrice(priceForThis, currency)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Kesik çizgi */}
          <div
            className="absolute top-0 bottom-0 left-[73%] border-l-2 border-dashed border-slate-400"
            style={{ width: 0 }}
          />

          {/* Sağ: Koparılabilir bölüm (27%) */}
          <div
            className="flex w-[27%] flex-shrink-0 flex-col p-4"
            style={{ minWidth: "180px" }}
          >
            <p className="text-[10px] font-bold tracking-wide text-black">{tTicket("tearOffSection")}</p>
            <p className="font-medium text-slate-800 mb-2">kurdevents</p>
            <p className="text-xs font-semibold text-black">{tTicket("ticketCode")}</p>
            <p className="mt-0.5 font-mono text-lg font-extrabold tracking-wide text-black">
              {codeForSeat}
            </p>
            <div className="mt-2.5 flex justify-center">
              <img
                src={qrUrlForSeat}
                alt={tTicket("qrAlt")}
                className="h-[130px] w-[130px] rounded border border-slate-200 bg-white p-1.5"
              />
            </div>
            <p className="mt-1.5 text-center text-[10px] text-black">{tTicket("qrHint")}</p>
          </div>
        </div>
      </div>
        );
        })}
      </div>

      {/* Yazdır ve İndir butonları */}
      <div className="flex flex-wrap justify-center gap-3 print:hidden">
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 rounded-lg bg-primary-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-primary-700"
        >
          <Printer className="h-5 w-5" />
          {tUi("print")}
        </button>
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="flex items-center gap-2 rounded-lg border-2 border-primary-600 bg-white px-6 py-3 font-semibold text-primary-600 transition-colors hover:bg-primary-50 disabled:opacity-60"
        >
          <Download className="h-5 w-5" />
          {downloading ? tUi("downloading") : tUi("download")}
        </button>
      </div>
      <p className="text-center text-xs text-slate-500 print:hidden">
        {tUi("printDownloadHint")}
      </p>
    </div>
  );
}
