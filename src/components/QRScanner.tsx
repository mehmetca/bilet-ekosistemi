"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, X, AlertCircle } from "lucide-react";
import { feedbackService } from "@/lib/feedbackService";
import { extractTicketCode } from "@/lib/ticket-code";

interface QRScannerProps {
  onScan: (code: string) => void;
  onClose: () => void;
  continuous?: boolean;
}

type CameraDevice = {
  id: string;
  label: string;
};

type CameraChoice = {
  id: string;
  label: "Arka Kamera" | "Ön Kamera";
};

export default function QRScanner({ onScan, onClose, continuous = false }: QRScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(true);
  const [isArmed, setIsArmed] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;
  const [availableCameras, setAvailableCameras] = useState<CameraDevice[]>([]);
  const [cameraChoices, setCameraChoices] = useState<CameraChoice[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [selectedFacingMode, setSelectedFacingMode] = useState<"environment" | "user">("environment");

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
    // Mobilde okuma kutusunu büyüt (uzaktan/rahat hizalama için).
    const isNarrow = typeof window !== "undefined" && window.innerWidth < 500;
    const config = {
      fps: 10,
      qrbox: isNarrow
        ? { width: 320, height: 180 }
        : { width: 340, height: 240 },
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

        const camList = cameras as CameraDevice[];
        setAvailableCameras(camList);

        const backCam = camList.find((c) =>
          /back|rear|environment|hinten|ruck|r\u00fcck|arka/i.test(c.label || "")
        );
        const frontCam = camList.find((c) =>
          /front|user|vorder|on|selfie|on kamera/i.test(c.label || "")
        );
        const choices: CameraChoice[] = [];
        if (backCam) choices.push({ id: backCam.id, label: "Arka Kamera" });
        if (frontCam && frontCam.id !== backCam?.id) choices.push({ id: frontCam.id, label: "Ön Kamera" });
        if (choices.length === 0 && camList[0]) choices.push({ id: camList[0].id, label: "Arka Kamera" });
        if (choices.length === 1 && camList[1] && camList[1].id !== choices[0].id) choices.push({ id: camList[1].id, label: "Ön Kamera" });
        setCameraChoices(choices);

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

        const onDecoded = (decodedText: string) => {
          if (!isArmed) return;
          feedbackService.playSuccess();
          setIsArmed(false);
          const code = extractTicketCode(decodedText);
          onScanRef.current(code);
          if (!continuous) {
            // Tarama biter bitmez scanner'ı güvenli şekilde durdur.
            stopAndClearScanner().finally(() => {
              onClose();
            });
          }
        };

        try {
          await scanner.start(
            { facingMode: selectedFacingMode },
            config,
            onDecoded,
            () => {
              /* scan error - ignore, keeps trying */
            }
          );
        } catch {
          await scanner.start(
            cameraId,
            config,
            onDecoded,
            () => {
              /* scan error - ignore, keeps trying */
            }
          );
        }

        if (mounted) setIsStarting(false);
      } catch (err) {
        if (!mounted) return;
        const msg = err instanceof Error ? err.message : String(err);

        // Bazı tarayıcılarda kamera değişimi / modal kapanışı sırasında
        // "The operation was aborted" veya benzeri AbortError hataları gelebiliyor.
        // Bunlar fatal değil, kullanıcıya hata göstermeden sessizce yutuyoruz.
        if (/abort/i.test(msg) || msg.includes("AbortError")) {
          console.warn("Kamera işlemi iptal edildi (abort):", err);
          setIsStarting(false);
          return;
        }

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
  }, [continuous, onClose, selectedCameraId, isArmed, selectedFacingMode]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-lg w-full p-6">
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
            style={{ minHeight: 380 }}
          >
            <div id="qr-reader" className="w-full min-h-[380px]" />
            {isStarting && !error && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
                <div className="text-center text-slate-600">
                  <Camera className="h-12 w-12 mx-auto mb-2 animate-pulse" />
                  <p className="text-sm">Kamera açılıyor...</p>
                </div>
              </div>
            )}
          </div>

          {!error && !isStarting && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
              <p className="text-sm text-blue-900 mb-2">
                QR kodu okuma alanına hizalayın, sonra butona basın.
              </p>
              <button
                type="button"
                onClick={() => setIsArmed(true)}
                className="w-full rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700"
              >
                {isArmed ? "Taranıyor..." : "Şimdi Tara"}
              </button>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Kamera seç</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsArmed(false);
                  setSelectedFacingMode("environment");
                  const back = cameraChoices.find((c) => c.label === "Arka Kamera");
                  void stopAndClearScanner().finally(() => {
                    setSelectedCameraId(back?.id ?? availableCameras[0]?.id ?? null);
                  });
                }}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  selectedFacingMode === "environment"
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                Arka Kamera
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsArmed(false);
                  setSelectedFacingMode("user");
                  const front = cameraChoices.find((c) => c.label === "Ön Kamera");
                  void stopAndClearScanner().finally(() => {
                    setSelectedCameraId(front?.id ?? availableCameras[1]?.id ?? availableCameras[0]?.id ?? null);
                  });
                }}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  selectedFacingMode === "user"
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                Ön Kamera
              </button>
            </div>
          </div>

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
