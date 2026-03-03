"use client";

import { useState, useEffect } from "react";
import { FileCheck, CheckCircle, XCircle, Calendar, MapPin, User, AlertCircle, Camera, Users } from "lucide-react";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";
import { checkTicket, type CheckResult } from "@/app/kontrol/actions";
import QRScanner from "@/components/QRScanner";
import MultiTicketScanner from "@/components/MultiTicketScanner";

export default function BiletKontrolPage() {
  const { isAdmin, isController } = useSimpleAuth();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [ticketCode, setTicketCode] = useState("");
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showMultiScanner, setShowMultiScanner] = useState(false);

  // URL'dan kod parametresini al
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      if (code) {
        setTicketCode(code);
        // Otomatik kontrol et
        const formData = new FormData();
        formData.append('ticket_code', code);
        setTimeout(() => handleSubmit(formData), 500);
      }
    }
  }, []);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setResult(null);
    const res = await checkTicket(formData);
    console.log("Bilet kontrol sonucu:", res);
    setResult(res);
    setLoading(false);
  }

  async function handleCheck() {
    if (!ticketCode.trim()) return;
    
    const formData = new FormData();
    formData.append('ticket_code', ticketCode);
    await handleSubmit(formData);
  }

  // Sadece admin ve controller erişebilir
  if (!isAdmin && !isController) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-red-800 mb-2">
            Erişim Reddedildi
          </h2>
          <p className="text-red-600">
            Bu sayfaya sadece yöneticiler ve kontrolörler erişebilir.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">
          Bilet Kontrol
        </h1>
        <p className="text-slate-600 mb-8">
          Bilet kodunu girin, geçerliliği kontrol edilsin ve girişte kullanıldı olarak işaretlensin.
        </p>

        <form action={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm mb-6">
          <label htmlFor="ticket_code" className="block text-sm font-medium text-slate-700 mb-2">
            Bilet Kodu
          </label>
          <div className="flex gap-3">
            <input
              id="ticket_code"
              name="ticket_code"
              type="text"
              value={ticketCode}
              onChange={(e) => setTicketCode(e.target.value)}
              required
              placeholder="BLT-XXXXXXXX"
              className="flex-1 rounded-lg border border-slate-300 px-4 py-3 font-mono text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:ring-primary-500 uppercase"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 rounded-lg bg-primary-600 px-6 py-3 font-semibold text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              <FileCheck className="h-5 w-5" />
              {loading ? "Kontrol..." : "Kontrol Et"}
            </button>
          </div>
        </form>

        <button
          type="button"
          onClick={() => setShowQRScanner(true)}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-medium hover:from-blue-700 hover:to-indigo-700 transition shadow-md mb-3"
        >
          <Camera className="h-5 w-5" />
          Kamera ile Tara
        </button>

        <button
          type="button"
          onClick={() => setShowMultiScanner(true)}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-medium hover:from-purple-700 hover:to-pink-700 transition shadow-md mb-6"
        >
          <Users className="h-5 w-5" />
          Çoklu Bilet Tara (Grup Girişi)
        </button>

        {result && (
          <div
            className={`rounded-2xl border p-6 ${
              result.valid
                ? "border-green-200 bg-green-50"
                : "border-red-200 bg-red-50"
            }`}
          >
            {result.valid ? (
              <>
                <div className="flex items-center gap-2 text-green-800 font-semibold mb-4">
                  <CheckCircle className="h-6 w-6" />
                  Geçerli bilet – girişe izin verildi
                </div>
                <dl className="space-y-3 text-green-800">
                  <div className="flex items-start gap-3">
                    <span className="font-medium min-w-[80px]">Etkinlik</span>
                    <span>{result.eventTitle}</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Calendar className="h-5 w-5 mt-0.5 text-green-600" />
                    <span>
                      {new Date(result.eventDate).toLocaleDateString("tr-TR")} • {result.eventTime}
                    </span>
                  </div>
                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 mt-0.5 text-green-600" />
                    <span>{result.venue}</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <User className="h-5 w-5 mt-0.5 text-green-600" />
                    <div>
                      <div>{result.buyerName}</div>
                      <div className="text-sm text-green-600">{result.buyerEmail}</div>
                      <div className="text-sm text-green-600">{result.quantity} bilet</div>
                    </div>
                  </div>
                </dl>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 text-red-800 font-semibold mb-4">
                  <XCircle className="h-6 w-6" />
                  {"reason" in result && result.reason === "not_found"
                    ? "Bilet bulunamadı. Kodu kontrol edin."
                    : "reason" in result && result.reason === "used"
                      ? "Bu bilet daha önce kullanılmıştır."
                      : "reason" in result && result.reason === "invalid"
                        ? result.message || "Bilet geçersiz."
                        : "Bir hata oluştu. Lütfen tekrar deneyin."}
                </div>

                {"reason" in result && result.reason === "used" && result.eventTitle && (
                  <dl className="space-y-3 text-red-800">
                    <div className="flex items-start gap-3">
                      <span className="font-medium min-w-[80px]">Etkinlik</span>
                      <span>{result.eventTitle}</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <Calendar className="h-5 w-5 mt-0.5 text-red-600" />
                      <span>
                        {result.eventDate
                          ? `${new Date(result.eventDate).toLocaleDateString("tr-TR")} • ${result.eventTime || ""}`
                          : "Tarih bilgisi yok"}
                      </span>
                    </div>
                    <div className="flex items-start gap-3">
                      <MapPin className="h-5 w-5 mt-0.5 text-red-600" />
                      <span>{result.venue || "Konum bilgisi yok"}</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <User className="h-5 w-5 mt-0.5 text-red-600" />
                      <div>
                        <div>{result.buyerName || "Bilinmiyor"}</div>
                        <div className="text-sm text-red-700">{result.buyerEmail || "Bilinmiyor"}</div>
                        <div className="text-sm text-red-700">{result.quantity || 1} bilet</div>
                      </div>
                    </div>
                  </dl>
                )}
              </>
            )}
          </div>
        )}

        {showQRScanner && (
          <QRScanner
            onScan={(code) => {
              setTicketCode(code);
              handleCheck();
              setShowQRScanner(false);
            }}
            onClose={() => setShowQRScanner(false)}
          />
        )}

        {showMultiScanner && (
          <MultiTicketScanner
            onBatchComplete={(tickets) => {
              console.log("Grup tarama tamamlandı:", tickets);
              setShowMultiScanner(false);
            }}
            onClose={() => setShowMultiScanner(false)}
          />
        )}
      </div>
    </div>
  );
}
