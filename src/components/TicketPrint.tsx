"use client";

import { useState, useEffect } from "react";
import QRCode from "qrcode";
import { Printer, Download } from "lucide-react";
import type { EventCurrency } from "@/types/database";
import { formatPrice } from "@/lib/formatPrice";
import { formatEventDateDMY } from "@/lib/date-utils";

export type SeatDetail = { section_name: string; row_label: string; seat_label: string; ticket_code?: string };

interface TicketPrintProps {
  ticketCode: string;
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  venue: string;
  location: string;
  buyerName: string;
  quantity: number;
  ticketType: string;
  price: number;
  currency?: EventCurrency | null;
  /** EventSeat bilgisi (Platz / Koltuk) */
  seatDetails?: SeatDetail[] | null;
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
  ticketType,
  price,
  currency,
  seatDetails,
}: TicketPrintProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  /** Her koltuk için ayrı bilet kodu olduğunda code -> QR data URL */
  const [qrCodesMap, setQrCodesMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const getCodeForSeat = (seat: SeatDetail | null) =>
    seat?.ticket_code ?? ticketCode;

  const eventDateText = eventDate ? formatEventDateDMY(eventDate) : "-";
  const timeText = eventTime || "--:--";
  const title = `${eventTitle} | EventSeat`;
  const totalPriceNumber = Number(price);
  const priceText = formatPrice(totalPriceNumber, currency);
  const multiSeat = !!seatDetails && seatDetails.length > 1;
  const perSeatPrice =
    multiSeat && quantity > 0 ? Number((totalPriceNumber / quantity).toFixed(2)) : totalPriceNumber;
  const barcodeSrc = `/api/barcode?code=${encodeURIComponent(ticketCode)}`;

  useEffect(() => {
    const generateQR = async () => {
      try {
        const origin =
          typeof window !== "undefined" ? window.location.origin : "";
        const codesToGenerate =
          seatDetails?.length && seatDetails.some((s) => s.ticket_code)
            ? seatDetails.map((s) => s.ticket_code ?? ticketCode)
            : [ticketCode];

        if (codesToGenerate.length === 1) {
          // QR içeriği: sitemiz URL'i – cep kamerasıyla okutulunca bu sayfa açılır
          const qrData = origin
            ? `${origin}/kontrol?code=${encodeURIComponent(ticketCode)}`
            : ticketCode;
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
              ? `${origin}/kontrol?code=${encodeURIComponent(code)}`
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
  }, [ticketCode, eventTitle, eventDate, eventTime, venue, buyerName, quantity, seatDetails]);

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const esc = (s: string) =>
      String(s || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

    const hasMultipleSeats = !!seatDetails && seatDetails.length > 1;
    const seatsArray = hasMultipleSeats && seatDetails ? seatDetails : [null];

    const makeTicketHtmlForSeat = (seat: SeatDetail | null) => {
      const codeForSeat = getCodeForSeat(seat);
      const barcodeFullUrlForSeat = `${origin}/api/barcode?code=${encodeURIComponent(codeForSeat)}`;
      const verticalCodeHtmlForSeat = codeForSeat
        .split("")
        .map((ch) => `<span style="display:block;line-height:9px;font-size:9px;font-family:monospace;">${esc(ch)}</span>`)
        .join("");
      const qrUrlForSeat = qrCodesMap[codeForSeat] ?? qrCodeUrl;

      const seatLine =
        seat != null
          ? `${seat.section_name} · Sıra ${seat.row_label} · Nr ${seat.seat_label}`
          : seatDetails && seatDetails.length === 1
            ? `${seatDetails[0].section_name} · Sıra ${seatDetails[0].row_label} · Nr ${seatDetails[0].seat_label}`
            : "";
      const qty = seat ? 1 : quantity;
      const priceForThis =
        seat && quantity > 0 ? Number((totalPriceNumber / quantity).toFixed(2)) : totalPriceNumber;
      const priceTextForThis = formatPrice(priceForThis, currency);

      return `
      <div style="max-width:900px;margin:0 auto;border:1px solid #cbd5e1;border-radius:12px;overflow:hidden;background:#fff;">
        <div style="background:#003f8c;color:#fff;padding:10px 18px;font-size:14px;font-weight:700;letter-spacing:.4px;">
          EventSeat E-TICKET
        </div>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          <tr>
            <td style="width:73%;padding:14px 16px;vertical-align:top;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                <tr>
                  <td style="width:74px;vertical-align:top;padding-right:12px;">
                    <div style="display:flex;gap:6px;align-items:flex-start;">
                      <div style="width:42px;height:250px;border:1px solid #e2e8f0;background:#fff;overflow:hidden;">
                        <img src="${barcodeFullUrlForSeat}" alt="Barkod" width="36" height="238" style="display:block;" />
                      </div>
                      <div style="font-size:9px;letter-spacing:.7px;font-family:monospace;color:#000;">${verticalCodeHtmlForSeat}</div>
                    </div>
                  </td>
                  <td style="vertical-align:top;">
                    <p style="margin:0;font-size:10px;font-weight:700;letter-spacing:.4px;color:#000;">MUSTERI/ETKINLIK BILETI</p>
                    <p style="margin:6px 0 0;font-size:36px;line-height:42px;font-weight:900;color:#000;">${esc(title || "Etkinlik")}</p>
                    <p style="margin:12px 0 0;font-size:18px;line-height:22px;font-weight:800;color:#000;">${eventDateText}, ${timeText}</p>
                    <p style="margin:4px 0 0;font-size:13px;line-height:16px;color:#000;font-weight:700;">${esc(venue)}</p>
                    <p style="margin:2px 0 0;font-size:13px;color:#000;">${esc(location)}</p>
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;border-collapse:collapse;font-size:12px;color:#000;">
                      <tr><td style="padding:2px 0;">Bilet Turu</td><td style="padding:2px 0;font-weight:700;text-align:right;">${esc(ticketType)}</td></tr>
                      ${
                        seatLine
                          ? `<tr><td style="padding:2px 0;">Platz / Koltuk</td><td style="padding:2px 0;font-weight:700;text-align:right;">${esc(
                              seatLine
                            )}</td></tr>`
                          : ""
                      }
                      <tr><td style="padding:2px 0;">Kisi/Adet</td><td style="padding:2px 0;font-weight:700;text-align:right;">${esc(
                        buyerName
                      )} / ${qty}</td></tr>
                      <tr><td style="padding:2px 0;">Toplam</td><td style="padding:2px 0;font-weight:800;text-align:right;">${esc(
                        priceTextForThis
                      )}</td></tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
            <td style="width:27%;padding:14px 16px;vertical-align:top;border-left:2px dashed #94a3b8;">
              <p style="margin:0;font-size:10px;font-weight:700;letter-spacing:.6px;color:#000;">KOPARILABILIR BOLUM</p>
              <p style="font-medium text-slate-800 mb-2">EventSeat</p>
              <p style="margin:8px 0 0;font-size:12px;font-weight:700;color:#000;">Bilet Kodu</p>
              <p style="margin:2px 0 0;font-size:18px;font-weight:800;letter-spacing:1px;font-family:monospace;color:#000;">${esc(codeForSeat)}</p>
              <p style="margin:10px 0 0;font-size:11px;color:#000;">Giris Noktasi</p>
              <p style="margin:2px 0 0;font-size:13px;font-weight:700;color:#000;">EINGANG X</p>
              <div style="margin-top:10px;text-align:center;">
                <img src="${qrUrlForSeat}" alt="QR" width="130" height="130" style="border:1px solid #e2e8f0;padding:6px;background:#fff;" />
              </div>
              <p style="margin:6px 0 0;font-size:10px;color:#000;text-align:center;">QR kodu giriste okutunuz</p>
            </td>
          </tr>
        </table>
      </div>
    `;
    };

    const ticketHtml = seatsArray
      .map((seat) => `<div class="print-ticket">${makeTicketHtmlForSeat(seat)}</div>`)
      .join("");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Bilet - ${ticketCode}</title>
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

  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    setDownloading(true);
    const hasMultipleSeats = !!seatDetails && seatDetails.length > 1;
    const seatsArray = hasMultipleSeats && seatDetails ? seatDetails : [null];
    const distinctCodes = [...new Set(seatsArray.map((s) => getCodeForSeat(s)))];

    const fallbackBarcode = "data:image/svg+xml," + encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="238" viewBox="0 0 36 238"><rect width="36" height="238" fill="#f1f5f9"/><text x="18" y="120" text-anchor="middle" font-size="10" fill="#64748b">Barkod</text></svg>`
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

    const makeTicketHtmlForSeat = (seat: SeatDetail | null) => {
      const codeForSeat = getCodeForSeat(seat);
      const barcodeDataUrl = barcodeDataUrls[codeForSeat] ?? fallbackBarcode;
      const verticalCodeHtmlForSeat = codeForSeat
        .split("")
        .map((ch) => `<span style="display:block;line-height:9px;font-size:9px;font-family:monospace;">${esc(ch)}</span>`)
        .join("");
      const qrUrlForSeat = qrCodesMap[codeForSeat] ?? qrCodeUrl;

      const seatLine =
        seat != null
          ? `${seat.section_name} · Sıra ${seat.row_label} · Nr ${seat.seat_label}`
          : seatDetails && seatDetails.length === 1
            ? `${seatDetails[0].section_name} · Sıra ${seatDetails[0].row_label} · Nr ${seatDetails[0].seat_label}`
            : "";
      const qty = seat ? 1 : quantity;
      const priceForThis =
        seat && quantity > 0 ? Number((totalPriceNumber / quantity).toFixed(2)) : totalPriceNumber;
      const priceTextForThis = formatPrice(priceForThis, currency);

      return `
      <div style="max-width:900px;margin:0 auto;border:1px solid #cbd5e1;border-radius:12px;overflow:hidden;background:#fff;">
        <div style="background:#003f8c;color:#fff;padding:10px 18px;font-size:14px;font-weight:700;letter-spacing:.4px;">
          EventSeat E-TICKET
        </div>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          <tr>
            <td style="width:73%;padding:14px 16px;vertical-align:top;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                <tr>
                  <td style="width:74px;vertical-align:top;padding-right:12px;">
                    <div style="display:flex;gap:6px;align-items:flex-start;">
                      <div style="width:42px;height:250px;border:1px solid #e2e8f0;background:#fff;overflow:hidden;">
                        <img src="${esc(barcodeDataUrl)}" alt="Barkod" width="36" height="238" style="display:block;" />
                      </div>
                      <div style="font-size:9px;letter-spacing:.7px;font-family:monospace;color:#000;">${verticalCodeHtmlForSeat}</div>
                    </div>
                  </td>
                  <td style="vertical-align:top;">
                    <p style="margin:0;font-size:10px;font-weight:700;letter-spacing:.4px;color:#000;">MUSTERI/ETKINLIK BILETI</p>
                    <p style="margin:6px 0 0;font-size:36px;line-height:42px;font-weight:900;color:#000;">${esc(title || "Etkinlik")}</p>
                    <p style="margin:12px 0 0;font-size:18px;line-height:22px;font-weight:800;color:#000;">${eventDateText}, ${timeText}</p>
                    <p style="margin:4px 0 0;font-size:13px;line-height:16px;color:#000;font-weight:700;">${esc(venue)}</p>
                    <p style="margin:2px 0 0;font-size:13px;color:#000;">${esc(location)}</p>
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;border-collapse:collapse;font-size:12px;color:#000;">
                      <tr><td style="padding:2px 0;">Bilet Turu</td><td style="padding:2px 0;font-weight:700;text-align:right;">${esc(ticketType)}</td></tr>
                      ${seatLine ? `<tr><td style="padding:2px 0;">Platz / Koltuk</td><td style="padding:2px 0;font-weight:700;text-align:right;">${esc(seatLine)}</td></tr>` : ""}
                      <tr><td style="padding:2px 0;">Kisi/Adet</td><td style="padding:2px 0;font-weight:700;text-align:right;">${esc(buyerName)} / ${qty}</td></tr>
                      <tr><td style="padding:2px 0;">Toplam</td><td style="padding:2px 0;font-weight:800;text-align:right;">${esc(priceTextForThis)}</td></tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
            <td style="width:27%;padding:14px 16px;vertical-align:top;border-left:2px dashed #94a3b8;">
              <p style="margin:0;font-size:10px;font-weight:700;letter-spacing:.6px;color:#000;">KOPARILABILIR BOLUM</p>
              <p style="font-medium text-slate-800 mb-2">EventSeat</p>
              <p style="margin:8px 0 0;font-size:12px;font-weight:700;color:#000;">Bilet Kodu</p>
              <p style="margin:2px 0 0;font-size:18px;font-weight:800;letter-spacing:1px;font-family:monospace;color:#000;">${esc(codeForSeat)}</p>
              <p style="margin:10px 0 0;font-size:11px;color:#000;">Giris Noktasi</p>
              <p style="margin:2px 0 0;font-size:13px;font-weight:700;color:#000;">EINGANG X</p>
              <div style="margin-top:10px;text-align:center;">
                <img src="${qrUrlForSeat ? esc(qrUrlForSeat) : ""}" alt="QR" width="130" height="130" style="border:1px solid #e2e8f0;padding:6px;background:#fff;" />
              </div>
              <p style="margin:6px 0 0;font-size:10px;color:#000;text-align:center;">QR kodu giriste okutunuz</p>
            </td>
          </tr>
        </table>
      </div>
    `;
    };

    const fullHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Bilet - ${esc(ticketCode)}</title>
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
            ${seatsArray
              .map((seat) => `<div class="print-ticket">${makeTicketHtmlForSeat(seat)}</div>`)
              .join("")}
          </div>
        </body>
      </html>
    `;

    const blob = new Blob([fullHtml], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bilet-${ticketCode}.html`;
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

  const seatsForRender: (SeatDetail | null)[] =
    multiSeat && seatDetails ? seatDetails : [null];

  return (
    <div className="space-y-6">
      {/* Bilet Kartı - Tasarımlı (her koltuk için ayrı) */}
      <div className="space-y-6">
        {seatsForRender.map((seat, idx) => {
          const codeForSeat = getCodeForSeat(seat);
          const barcodeSrcForSeat = `/api/barcode?code=${encodeURIComponent(codeForSeat)}`;
          const qrUrlForSeat = qrCodesMap[codeForSeat] ?? qrCodeUrl;
          const seatLine =
            seat != null
              ? `${seat.section_name} · Sıra ${seat.row_label} · Nr ${seat.seat_label}`
              : seatDetails && seatDetails.length === 1
                ? `${seatDetails[0].section_name} · Sıra ${seatDetails[0].row_label} · Nr ${seatDetails[0].seat_label}`
                : "";
          const qty = seat ? 1 : quantity;
          const priceForThis =
            seat && quantity > 0 ? Number((totalPriceNumber / quantity).toFixed(2)) : totalPriceNumber;
          const priceTextForThis = formatPrice(priceForThis, currency);

          return (
            <div
              key={idx}
              className="relative mx-auto max-w-[900px] overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm"
            >
        {/* Header */}
        <div className="bg-[#003f8c] px-4 py-2.5 text-sm font-bold tracking-wide text-white">
          EventSeat E-TICKET
        </div>

        {/* Ana içerik */}
        <div className="relative flex">
          {/* Sol: Barkod + Bilgiler (73%) */}
          <div className="flex min-w-0 flex-1 gap-4 p-4" style={{ width: "73%" }}>
            <div className="flex flex-shrink-0 items-start gap-1.5">
              <div className="flex h-[250px] w-[42px] items-center justify-center overflow-hidden rounded border border-slate-200 bg-white">
                <img
                  src={barcodeSrcForSeat}
                  alt="Bilet Barkod"
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
              <p className="text-[10px] font-bold tracking-wide text-black">
                MUSTERI/ETKINLIK BILETI
              </p>
              <p className="mt-1.5 truncate text-4xl font-black leading-tight text-black md:text-5xl">
                {title || "Etkinlik"}
              </p>
              <p className="mt-3 text-lg font-extrabold text-black">
                {eventDateText}, {timeText}
              </p>
              <p className="mt-1 text-[13px] font-bold text-black">{venue}</p>
              <p className="mt-0.5 text-[13px] text-black">{location}</p>
              <table className="mt-3 w-full border-collapse text-xs text-black">
                <tbody>
                  <tr>
                    <td className="py-0.5">Bilet Turu</td>
                    <td className="py-0.5 text-right font-bold">{ticketType}</td>
                  </tr>
                  {seatLine && (
                    <tr>
                      <td className="py-0.5">Platz / Koltuk</td>
                      <td className="py-0.5 text-right font-bold">{seatLine}</td>
                    </tr>
                  )}
                  <tr>
                    <td className="py-0.5">Kisi/Adet</td>
                    <td className="py-0.5 text-right font-bold">
                      {buyerName} / {qty}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-0.5">Toplam</td>
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
            <p className="text-[10px] font-bold tracking-wide text-black">
              KOPARILABILIR BOLUM
            </p>
            <p className="font-medium text-slate-800 mb-2">eventseat</p>
            <p className="mt-0.5 font-mono text-lg font-extrabold tracking-wide text-black">
              {codeForSeat}
            </p>
            <p className="mt-2.5 text-[11px] text-black">Giris Noktasi</p>
            <p className="mt-0.5 text-[13px] font-bold text-black">EINGANG X</p>
            <div className="mt-2.5 flex justify-center">
              <img
                src={qrUrlForSeat}
                alt="Bilet QR Kodu"
                className="h-[130px] w-[130px] rounded border border-slate-200 bg-white p-1.5"
              />
            </div>
            <p className="mt-1.5 text-center text-[10px] text-black">
              QR kodu giriste okutunuz
            </p>
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
          Yazdır
        </button>
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="flex items-center gap-2 rounded-lg border-2 border-primary-600 bg-white px-6 py-3 font-semibold text-primary-600 transition-colors hover:bg-primary-50 disabled:opacity-60"
        >
          <Download className="h-5 w-5" />
          {downloading ? "İndiriliyor…" : "İndir"}
        </button>
      </div>
      <p className="text-center text-xs text-slate-500 print:hidden">
        Yazdır: Her sayfada 2 bilet. İndir: Barkod ve QR kodu dosyaya gömülür; internet olmadan da salon girişinde gösterebilirsiniz. Bu e-posta, EventSeat hesabınız için şifre sıfırlama talebiniz üzerine gönderilmiştir.
      </p>
    </div>
  );
}
