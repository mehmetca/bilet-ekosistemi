// src/components/QRScanner.tsx (veya nerede ise)
"use client";

import { useEffect, useRef, useState } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { Camera, X, AlertCircle } from "lucide-react";
import { feedbackService } from "@/lib/feedbackService";

interface QRScannerProps {
  onScan: (code: string) => void;
  onClose: () => void;
}

export default function QRScanner({ onScan, onClose }: QRScannerProps) {
  const [error] = useState<string | null>(null);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    // Play scan start feedback
    feedbackService.playScanStart();
    
    // Scanner'ı başlat
    scannerRef.current = new Html5QrcodeScanner(
      "qr-reader", // div id'si (aşağıda kullanacağız)
      {
        fps: 10,                      // tarama hızı
        qrbox: { width: 250, height: 250 }, // tarama kutusu boyutu
        aspectRatio: 1.0,
        disableFlip: false,
        showTorchButtonIfSupported: true,
        rememberLastUsedCamera: true,
      },
      false // verbose log kapalı
    );

    scannerRef.current.render(
      (decodedText) => {
        // QR başarıyla okundu - play success feedback
        feedbackService.playSuccess();
        onScan(decodedText.trim().toUpperCase());
        stopScanning();
      },
      (err) => {
        // Tarama hatası (genelde sessiz olur, önemli değil)
        console.debug("QR tarama hatası:", err);
      }
    );

    return () => {
      stopScanning();
    };
  }, [onScan]);

  function stopScanning() {
    if (scannerRef.current) {
      scannerRef.current.clear().catch(() => {});
      scannerRef.current = null;
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-slate-900">QR Kod Tara</h3>
          <button
            onClick={() => {
              stopScanning();
              onClose();
            }}
            className="p-2 hover:bg-slate-100 rounded-lg"
          >
            <X className="h-5 w-5 text-slate-600" />
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-600 mb-4">
            <AlertCircle className="h-5 w-5" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        <div className="space-y-4">
          {/* Kamera / Tarama Alanı */}
          <div className="relative aspect-video bg-slate-100 rounded-lg overflow-hidden">
            <div id="qr-reader" className="w-full h-full" />
            {/* Tarama kutusu overlay (görsel efekt) */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-64 h-64 border-2 border-primary-500 rounded-xl animate-pulse-slow" />
            </div>
          </div>

          {/* Manuel Giriş (senin kodundan korudum) */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Veya Bilet Kodu Girin
            </label>
            <input
              type="text"
              placeholder="BLT-XXXXXXXX"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-primary-500 focus:ring-primary-500 font-mono uppercase"
              onKeyPress={(e) => {
                if (e.key === "Enter") {
                  const target = e.target as HTMLInputElement;
                  if (target.value.trim()) {
                    feedbackService.playSuccess();
                    onScan(target.value.trim().toUpperCase());
                    onClose();
                  }
                }
              }}
            />
          </div>

          {/* Butonlar */}
          <div className="flex gap-3">
            <button
              onClick={() => {
                stopScanning();
                // Yeniden başlatmak istersen burada scanner'ı tekrar render edebilirsin
              }}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700"
            >
              <Camera className="h-4 w-4" />
              Yeniden Tara
            </button>
            <button
              onClick={() => {
                stopScanning();
                onClose();
              }}
              className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              İptal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}