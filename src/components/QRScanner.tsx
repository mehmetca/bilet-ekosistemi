"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { Html5Qrcode as Html5QrcodeInstance } from "html5-qrcode";
import { Camera, X, AlertCircle, Pause, Play, Flashlight } from "lucide-react";
import { feedbackService } from "@/lib/feedbackService";
import { extractTicketCode } from "@/lib/ticket-code";

const QR_SCAN_FPS = 10;
/** Aynı biletin art arda iki kez okunup çift istek açmasını engeller. */
const SCAN_COOLDOWN_MS = 1500;

interface QRScannerProps {
  onScan: (code: string) => void;
  onClose: () => void;
  /** true (varsayılan): okuma sonrası kamera kapanmaz, ardışık biletler taranır. */
  continuous?: boolean;
  /** Ebeveyn bir okumayı hâlâ işliyorsa true → yeni okumalar yok sayılır. */
  busy?: boolean;
  /** Sürekli taramada sonucun gösterildiği şerit (yeşil/kırmızı hüküm). */
  statusSlot?: ReactNode;
}

type CameraDevice = {
  id: string;
  label: string;
};

type CameraChoice = {
  id: string;
  label: "Arka Kamera" | "Ön Kamera";
};

export default function QRScanner({
  onScan,
  onClose,
  continuous = true,
  busy = false,
  statusSlot,
}: QRScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);

  const scannerRef = useRef<Html5QrcodeInstance | null>(null);
  const lastDecodeAtRef = useRef(0);
  // Geri çağrılar refs'te tutulur: satır içi fonksiyonlar effect'i yeniden
  // çalıştırıp kamerayı her render'da sökmesin.
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const continuousRef = useRef(continuous);
  continuousRef.current = continuous;
  const busyRef = useRef(busy);
  busyRef.current = busy;

  const [cameraChoices, setCameraChoices] = useState<CameraChoice[]>([]);
  // Yalnızca kullanıcı kamera seçtiğinde değişir → effect yeniden başlamaz.
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
    setIsPaused(false);
    setTorchOn(false);
    feedbackService.playScanStart();

    const elementId = "qr-reader";
    // Mobilde okuma kutusunu büyüt (uzaktan/rahat hizalama için).
    const isNarrow = typeof window !== "undefined" && window.innerWidth < 500;
    const config = {
      fps: QR_SCAN_FPS,
      qrbox: isNarrow ? { width: 320, height: 180 } : { width: 340, height: 240 },
      aspectRatio: 1.0,
    };

    async function startCamera() {
      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
        const cameras = await Html5Qrcode.getCameras();
        if (!mounted) return;
        if (!cameras || cameras.length === 0) {
          setError("Kamera bulunamadı. Cihazınızda kamera olduğundan emin olun.");
          setIsStarting(false);
          return;
        }

        const camList = cameras as CameraDevice[];
        const backCam = camList.find((c) =>
          /back|rear|environment|hinten|ruck|r\u00fcck|arka/i.test(c.label || "")
        );
        const frontCam = camList.find((c) =>
          /front|user|vorder|on|selfie|on kamera/i.test(c.label || "")
        );
        const choices: CameraChoice[] = [];
        if (backCam) choices.push({ id: backCam.id, label: "Arka Kamera" });
        if (frontCam && frontCam.id !== backCam?.id)
          choices.push({ id: frontCam.id, label: "Ön Kamera" });
        if (choices.length === 0 && camList[0])
          choices.push({ id: camList[0].id, label: "Arka Kamera" });
        if (choices.length === 1 && camList[1] && camList[1].id !== choices[0].id)
          choices.push({ id: camList[1].id, label: "Ön Kamera" });
        setCameraChoices(choices);

        if (scannerRef.current) {
          await stopAndClearScanner();
        }

        const scanner = new Html5Qrcode(elementId, {
          // Basılı bilette QR'ın yanında Code128 barkod da var — kapı ikisini de okumalı.
          formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.CODE_128,
          ],
          // Chrome/Android'de yazılım çözümleyicisi yerine donanım BarcodeDetector.
          useBarCodeDetectorIfSupported: true,
          verbose: false,
        });
        scannerRef.current = scanner;

        const onDecoded = (decodedText: string) => {
          if (!mounted || busyRef.current) return;
          const now = Date.now();
          if (now - lastDecodeAtRef.current < SCAN_COOLDOWN_MS) return;
          const code = extractTicketCode(decodedText);
          if (!code) return;
          lastDecodeAtRef.current = now;
          feedbackService.playSuccess();
          if (typeof navigator !== "undefined" && "vibrate" in navigator) {
            navigator.vibrate([40]);
          }
          onScanRef.current(code);
          if (!continuousRef.current) {
            void stopAndClearScanner().finally(() => onCloseRef.current());
          }
        };
        const onError = () => {
          /* kare bulunamadı — taramaya devam */
        };

        const spec: string | MediaTrackConstraints = selectedCameraId
          ? selectedCameraId
          : { facingMode: selectedFacingMode };

        try {
          await scanner.start(spec, config, onDecoded, onError);
        } catch (startError) {
          // facingMode seçeneği (masaüstünde arka kamera yoksa) başarısız olursa
          // açık kamera kimliğiyle bir kez daha dene.
          const fallbackId = (backCam ?? camList[0])?.id;
          if (typeof spec !== "string" && fallbackId) {
            await scanner.start(fallbackId, config, onDecoded, onError);
          } else {
            throw startError;
          }
        }

        if (!mounted) return;
        const caps = scanner.getRunningTrackCapabilities?.();
        setTorchSupported(Boolean(caps && "torch" in caps));
        setIsStarting(false);
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
    // selectedCameraId yalnızca kullanıcı seçiminde değişir; geri çağrılar refs'te.
  }, [selectedCameraId, selectedFacingMode]);

  useEffect(() => {
    const scanner = scannerRef.current;
    if (!scanner || isStarting || error) return;
    try {
      if (busy) scanner.pause(true);
      else if (!isPaused) scanner.resume();
    } catch {
      /* henüz akış yok veya tarayıcı desteklemiyor */
    }
  }, [busy, isStarting, error, isPaused]);

  const togglePause = useCallback(() => {
    const scanner = scannerRef.current;
    if (!scanner) return;
    try {
      if (isPaused) {
        scanner.resume();
        setIsPaused(false);
      } else {
        scanner.pause(true);
        setIsPaused(true);
      }
    } catch {
      /* duraklat/yeniden başlat desteklenmiyorsa sessiz geç */
    }
  }, [isPaused]);

  const toggleTorch = useCallback(async () => {
    const scanner = scannerRef.current;
    if (!scanner) return;
    const next = !torchOn;
    try {
      await scanner.applyVideoConstraints(
        { advanced: [{ torch: next }] } as unknown as MediaTrackConstraints
      );
      setTorchOn(next);
    } catch {
      setTorchSupported(false);
    }
  }, [torchOn]);

  const handleClose = useCallback(() => {
    void stopAndClearScanner().finally(() => onCloseRef.current());
  }, []);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-stretch justify-center sm:items-center sm:p-4">
      <div className="flex h-[100dvh] w-full flex-col gap-4 overflow-y-auto bg-white p-4 sm:h-auto sm:max-h-[92vh] sm:max-w-lg sm:rounded-xl sm:p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-slate-900">Bilet Tara</h3>
          <button
            type="button"
            onClick={handleClose}
            className="p-2 hover:bg-slate-100 rounded-lg"
            aria-label="Kapat"
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

        <div className="flex flex-1 flex-col gap-4">
          {statusSlot}
          <div className="relative min-h-[280px] flex-1 overflow-hidden rounded-lg bg-slate-100 sm:min-h-[380px]">
            <div id="qr-reader" className="w-full min-h-[280px] sm:min-h-[380px]" />
            {isStarting && !error && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
                <div className="text-center text-slate-600">
                  <Camera className="h-12 w-12 mx-auto mb-2 animate-pulse" />
                  <p className="text-sm">Kamera açılıyor...</p>
                </div>
              </div>
            )}
            {isPaused && !isStarting && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <p className="text-sm font-medium text-white">Tarama duraklatıldı</p>
              </div>
            )}
          </div>

          {!error && !isStarting && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={togglePause}
                className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                {isPaused ? "Taramaya devam" : "Duraklat"}
              </button>
              {torchSupported && (
                <button
                  type="button"
                  onClick={() => void toggleTorch()}
                  className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${
                    torchOn
                      ? "border-amber-500 bg-amber-50 text-amber-700"
                      : "border-slate-300 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <Flashlight className="h-4 w-4" />
                  Işık
                </button>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Kamera seç</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedCameraId(
                    cameraChoices.find((c) => c.label === "Arka Kamera")?.id ?? null
                  );
                  setSelectedFacingMode("environment");
                }}
                className={`min-h-[44px] rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
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
                  setSelectedCameraId(
                    cameraChoices.find((c) => c.label === "Ön Kamera")?.id ?? null
                  );
                  setSelectedFacingMode("user");
                }}
                className={`min-h-[44px] rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
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
              className="min-h-[48px] w-full rounded-lg border border-slate-300 px-3 text-base font-mono uppercase focus:border-primary-500 focus:ring-primary-500"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const target = e.target as HTMLInputElement;
                  if (target.value.trim()) {
                    feedbackService.playSuccess();
                    onScan(target.value.trim().toUpperCase());
                  }
                }
              }}
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="min-h-[48px] flex-1 rounded-lg border border-slate-300 px-4 py-2 hover:bg-slate-50"
            >
              Kapat
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
