"use client";

import { useState, useEffect } from "react";
import QRCode from "qrcode";
import { Download, Printer, Share2 } from "lucide-react";
import type { EventCurrency } from "@/types/database";
import { formatPrice } from "@/lib/formatPrice";

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
}: TicketPrintProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // QR kodu oluştur
  useEffect(() => {
    const generateQR = async () => {
      try {
        const qrData = JSON.stringify({
          code: ticketCode,
          event: eventTitle,
          date: eventDate,
          time: eventTime,
          venue,
          buyer: buyerName,
          quantity,
        });

        const url = await QRCode.toDataURL(qrData, {
          width: 200,
          margin: 2,
          color: {
            dark: "#1e293b",
            light: "#ffffff",
          },
        });

        setQrCodeUrl(url);
      } catch (error) {
        console.error("QR kod oluşturma hatası:", error);
      } finally {
        setLoading(false);
      }
    };

    generateQR();
  }, [ticketCode, eventTitle, eventDate, eventTime, venue, buyerName, quantity]);

  const handlePrint = () => {
    // Sadece bilet kartını yazdırmak için
    const printContent = document.getElementById('ticket-card');
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Bilet - ${ticketCode}</title>
          <style>
            body {
              margin: 0;
              padding: 20px;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              print-color-adjust: exact;
              -webkit-print-color-adjust: exact;
            }
            .ticket-card {
              max-width: 400px;
              margin: 0 auto;
              background: white;
              border: 2px solid #1e293b;
              border-radius: 12px;
              overflow: hidden;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .ticket-header {
              background: linear-gradient(to right, #2563eb, #1d4ed8);
              color: white;
              padding: 16px;
              text-align: center;
            }
            .ticket-title {
              font-size: 18px;
              font-weight: bold;
              margin: 0 0 8px 0;
            }
            .ticket-datetime {
              font-size: 14px;
              opacity: 0.9;
            }
            .ticket-body {
              padding: 16px;
            }
            .ticket-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 16px;
              margin-bottom: 16px;
            }
            .ticket-info {
              space-y: 8px;
            }
            .ticket-label {
              font-size: 12px;
              color: #64748b;
              margin-bottom: 4px;
            }
            .ticket-value {
              font-size: 14px;
              font-weight: 600;
              color: #1e293b;
            }
            .ticket-code {
              text-align: center;
              margin: 16px 0;
            }
            .ticket-code-label {
              font-size: 12px;
              color: #64748b;
              margin-bottom: 4px;
            }
            .ticket-code-value {
              font-size: 20px;
              font-weight: bold;
              font-family: 'Courier New', monospace;
              letter-spacing: 2px;
              color: #1e293b;
            }
            .qr-section {
              text-align: center;
              margin: 16px 0;
            }
            .qr-code {
              width: 120px;
              height: 120px;
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              padding: 8px;
              background: white;
            }
            .qr-instruction {
              font-size: 11px;
              color: #64748b;
              margin-top: 8px;
            }
            .ticket-footer {
              background: #f8fafc;
              padding: 12px 16px;
              border-top: 1px solid #e2e8f0;
              display: flex;
              justify-content: space-between;
              align-items: center;
              font-size: 11px;
              color: #64748b;
            }
            @media print {
              body { margin: 0; padding: 10px; }
              .ticket-card { 
                max-width: 100%; 
                box-shadow: none;
                page-break-inside: avoid;
              }
            }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    
    // Yazdırma dialogunu aç
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const handleDownload = () => {
    const link = document.createElement("a");
    link.download = `bilet-${ticketCode}.png`;
    link.href = qrCodeUrl;
    link.click();
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${eventTitle} Bileti`,
          text: `${eventTitle} etkinliği için biletim. Bilet kodu: ${ticketCode}`,
        });
      } catch (error) {
        console.error("Paylaşım hatası:", error);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Bilet Kartı */}
      <div id="ticket-card" className="bg-white rounded-xl border-2 border-slate-200 overflow-hidden print:border-2 print:border-black max-w-md mx-auto">
        <div className="bg-gradient-to-r from-primary-600 to-primary-700 text-white p-4">
          <h2 className="text-lg font-bold mb-1">{eventTitle}</h2>
          <div className="flex items-center gap-3 text-primary-100 text-sm">
            <span>{new Date(eventDate).toLocaleDateString("tr-TR")}</span>
            <span>•</span>
            <span>{eventTime}</span>
          </div>
        </div>

        <div className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Sol Taraf - Bilet Bilgileri */}
            <div className="space-y-3">
              <div>
                <h3 className="text-xs font-medium text-slate-500 mb-1">Bilet Kodu</h3>
                <p className="text-lg font-mono font-bold text-slate-900 tracking-wider">
                  {ticketCode}
                </p>
              </div>

              <div>
                <h3 className="text-xs font-medium text-slate-500 mb-1">Bilet Sahibi</h3>
                <p className="text-sm font-semibold text-slate-900">{buyerName}</p>
              </div>

              <div>
                <h3 className="text-xs font-medium text-slate-500 mb-1">Bilet Türü</h3>
                <p className="text-sm font-semibold text-slate-900">
                  {ticketType} ({quantity} adet)
                </p>
              </div>

              <div>
                <h3 className="text-xs font-medium text-slate-500 mb-1">Fiyat</h3>
                <p className="text-sm font-bold text-primary-600">
                  {formatPrice(Number(price), currency)}
                </p>
              </div>

              <div>
                <h3 className="text-xs font-medium text-slate-500 mb-1">Mekan</h3>
                <p className="text-sm text-slate-900">{venue}</p>
                <p className="text-xs text-slate-600">{location}</p>
              </div>
            </div>

            {/* Sağ Taraf - QR Kod */}
            <div className="flex flex-col items-center justify-center space-y-3">
              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <img 
                  src={qrCodeUrl} 
                  alt="Bilet QR Kodu" 
                  className="w-32 h-32"
                />
              </div>
              <p className="text-xs text-slate-500 text-center">
                Bu QR kodu etkinlik giriş noktasında okutunuz
              </p>
            </div>
          </div>
        </div>

        {/* Alt Bilgi */}
        <div className="bg-slate-50 px-4 py-3 border-t border-slate-200">
          <div className="flex items-center justify-between text-xs text-slate-600">
            <span>Bilet Ekosistemi</span>
            <span>{new Date().toLocaleDateString("tr-TR")}</span>
          </div>
        </div>
      </div>

      {/* Aksiyon Butonları */}
      <div className="flex flex-wrap gap-3 justify-center print:hidden">
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors"
        >
          <Printer className="h-5 w-5" />
          Yazdır
        </button>
        
        <button
          onClick={handleDownload}
          className="flex items-center gap-2 px-6 py-3 bg-slate-600 text-white rounded-lg font-semibold hover:bg-slate-700 transition-colors"
        >
          <Download className="h-5 w-5" />
          QR Kod İndir
        </button>
        
        <button
          onClick={handleShare}
          className="flex items-center gap-2 px-6 py-3 border border-slate-300 text-slate-700 rounded-lg font-semibold hover:bg-slate-50 transition-colors"
        >
          <Share2 className="h-5 w-5" />
          Paylaş
        </button>
      </div>

      {/* Yazdırma Stilleri */}
      <style jsx>{`
        @media print {
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          
          .print\\:hidden {
            display: none !important;
          }
          
          .print\\:border-black {
            border-color: black !important;
          }
        }
      `}</style>
    </div>
  );
}
