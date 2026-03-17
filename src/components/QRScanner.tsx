"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, X, AlertCircle } from "lucide-react";
import { feedbackService } from "@/lib/feedbackService";

interface QRScannerProps {
  onScan: (code: string) => void;
  onClose: () => void;
  continuous?: boolean;
}

type CameraDevice = {
  id: string;
  label: string;
};

export default function QRScanner({ onScan, onClose, continuous = false }: QRScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(true);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;
  const [availableCameras, setAvailableCameras] = useState<CameraDevice[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);

  async function stopAndClearScanner() {
    const scanner = scannerRef.current;
    if (!scanner) return;
    try {
      // stop() hem senkron hata fırlatabiliyor hem de Promise döndürebiliyor; hepsini yut.
      await Promise.resolve(scanner.stop()).catch(() => {});
    } catch {
      /* ignore */
    }
    scannerRef.current = null;
  }

  useEffect(() => {
    let mounted = true;
    setError(null);
    setIsStarting(true);
    feedbackService.playScanStart();

    const elementId = "qr-reader";
    const config = {
      fps: 10,
      qrbox: { width: 250, height: 250 },
      aspectRatio: 1.0,
    };

    async function startCamera() {
      try {
        const cameras = await Html5Qrcode.getCameras();
        if (!cameras || cameras.length === 0) {
          setError("Kamera bulunamadı. Cihazınızda kamera olduğundan emin olun.");
          setIsStarting(false);
          return;
        }

        if (!mounted) return;

        setAvailableCameras(cameras as CameraDevice[]);

        const scanner = new Html5Qrcode(elementId);
        scannerRef.current = scanner;

        // Varsayılan: arka (environment) kamera; yoksa ilk kamera.
        let cameraId = selectedCameraId;
        if (!cameraId) {
          const backCamera = cameras.find((c) =>
            /back|rear|environment|hinten|r\u00fcck/i.test(c.label || "")
          );
          cameraId = (backCamera ?? cameras[0]).id;
          if (mounted) setSelectedCameraId(cameraId);
        }

        if (!cameraId) {
          setError("Kamera bulunamadı.");
          setIsStarting(false);
          return;
        }

        await scanner.start(
          cameraId,
          config,
          (decodedText) => {
            feedbackService.playSuccess();
            let code = decodedText.trim();
            try {
              const parsed = JSON.parse(code);
              if (parsed && typeof parsed.code === "string") {
                code = parsed.code;
              }
            } catch {
              /* plain text ticket code */
            }
            onScanRef.current(code.toUpperCase());
            if (!continuous) {
              // Tarama biter bitmez scanner'ı güvenli şekilde durdur.
              stopAndClearScanner().finally(() => {
                onClose();
              });
            }
          },
          () => {
            /* scan error - ignore, keeps trying */
          }
        );

        if (mounted) setIsStarting(false);
      } catch (err) {
        if (!mounted) return;
        const msg = err instanceof Error ? err.message : String(err);
        console.error("Kamera hatası:", err);
        if (msg.includes("Permission") || msg.includes("NotAllowed")) {
          setError("Kamera izni reddedildi. Tarayıcı ayarlarından kamera erişimine izin verin.");
        } else if (msg.includes("NotFound") || msg.includes("not found")) {
          setError("Kamera bulunamadı.");
        } else if (msg.includes("NotReadable") || msg.includes("in use")) {
          setError("Kamera kullanımda. Başka bir uygulama kamerayı kullanıyor olabilir.");
        } else {
          setError("Kamera açılamadı. HTTPS üzerinden eriştiğinizden emin olun.");
        }
        setIsStarting(false);
      }
    }

    startCamera();

    return () => {
      mounted = false;
      void stopAndClearScanner();
    };
  }, [continuous, onClose, selectedCameraId]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-slate-900">QR Kod Tara</h3>
          <button
            type="button"
            onClick={() => {
              void stopAndClearScanner().finally(() => {
                onClose();
              });
            }}
            className="p-2 hover:bg-slate-100 rounded-lg"
          >
            <X className="h-5 w-5 text-slate-600" />
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-600 mb-4 p-3 bg-red-50 rounded-lg">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        <div className="space-y-4">
          <div
            className="relative bg-slate-100 rounded-lg overflow-hidden"
            style={{ minHeight: 300 }}
          >
            <div id="qr-reader" className="w-full min-h-[300px]" />
            {isStarting && !error && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
                <div className="text-center text-slate-600">
                  <Camera className="h-12 w-12 mx-auto mb-2 animate-pulse" />
                  <p className="text-sm">Kamera açılıyor...</p>
                </div>
              </div>
            )}
          </div>

          {availableCameras.length > 1 && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Kamera seç
              </label>
              <select
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={selectedCameraId ?? ""}
                onChange={(e) => {
                  const id = e.target.value || null;
                  void stopAndClearScanner().finally(() => {
                    setSelectedCameraId(id);
                  });
                }}
              >
                {availableCameras.map((cam) => (
                  <option key={cam.id} value={cam.id}>
                    {cam.label || cam.id}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Veya Bilet Kodu Girin
            </label>
            <input
              type="text"
              placeholder="BLT-XXXXXXXX"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-primary-500 focus:ring-primary-500 font-mono uppercase"
              onKeyDown={(e) => {
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

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                void stopAndClearScanner().finally(() => {
                  onClose();
                });
              }}
              className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              İptal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
