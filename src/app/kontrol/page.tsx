"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle, XCircle, Calendar, MapPin, User } from "lucide-react";
import { checkTicket, type CheckResult } from "@/app/kontrol/actions";

export default function KontrolPage() {
  const searchParams = useSearchParams();
  const codeParam = searchParams.get("code");
  const [result, setResult] = useState<CheckResult | null>(null);
  const [loading, setLoading] = useState(!!codeParam);

  useEffect(() => {
    if (!codeParam || !codeParam.trim()) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const res = await checkTicket(codeParam.trim());
      if (!cancelled) {
        setResult(res);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [codeParam]);

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-6">
          <Link
            href="/"
            className="text-primary-600 hover:text-primary-700 font-medium text-sm"
          >
            ← Bilet Ekosistemi
          </Link>
        </div>
        <h1 className="text-xl font-bold text-slate-900 text-center mb-2">
          Bilet Kontrol
        </h1>
        <p className="text-slate-600 text-center text-sm mb-8">
          QR kodu okutulduğunda bu sayfa açılır; bilet geçerliliği aşağıda gösterilir.
        </p>

        {loading && (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
            Kontrol ediliyor...
          </div>
        )}

        {!loading && !codeParam && (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-600">
            <p className="mb-4">Bilet kodu bulunamadı.</p>
            <p className="text-sm">
              Bu sayfaya bilet QR kodu okutulduğunda otomatik gelirsiniz. Manuel kontrol için{" "}
              <Link href="/giris" className="text-primary-600 underline">giriş yapıp</Link> yönetim panelinden Bilet Kontrol kullanın.
            </p>
          </div>
        )}

        {!loading && codeParam && result && (
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
                  <CheckCircle className="h-6 w-6 flex-shrink-0" />
                  Geçerli bilet – girişe izin verildi
                </div>
                <dl className="space-y-3 text-green-800">
                  <div className="flex items-start gap-3">
                    <span className="font-medium min-w-[80px]">Etkinlik</span>
                    <span>{result.eventTitle}</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Calendar className="h-5 w-5 mt-0.5 text-green-600 flex-shrink-0" />
                    <span>
                      {result.eventDate
                        ? new Date(result.eventDate).toLocaleDateString("tr-TR")
                        : ""}{" "}
                      • {result.eventTime}
                    </span>
                  </div>
                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 mt-0.5 text-green-600 flex-shrink-0" />
                    <span>{result.venue}</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <User className="h-5 w-5 mt-0.5 text-green-600 flex-shrink-0" />
                    <div>
                      <div>{result.buyerName}</div>
                      <div className="text-sm text-green-700">{result.buyerEmail}</div>
                      <div className="text-sm text-green-700">{result.quantity} bilet</div>
                    </div>
                  </div>
                </dl>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 text-red-800 font-semibold mb-4">
                  <XCircle className="h-6 w-6 flex-shrink-0" />
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
                      <Calendar className="h-5 w-5 mt-0.5 text-red-600 flex-shrink-0" />
                      <span>
                        {result.eventDate
                          ? `${new Date(result.eventDate).toLocaleDateString("tr-TR")} • ${result.eventTime || ""}`
                          : "Tarih bilgisi yok"}
                      </span>
                    </div>
                    <div className="flex items-start gap-3">
                      <MapPin className="h-5 w-5 mt-0.5 text-red-600 flex-shrink-0" />
                      <span>{result.venue || "Konum bilgisi yok"}</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <User className="h-5 w-5 mt-0.5 text-red-600 flex-shrink-0" />
                      <div>
                        <div>{result.buyerName || "Bilinmiyor"}</div>
                        <div className="text-sm text-red-700">{result.buyerEmail || "Bilinmiyor"}</div>
                      </div>
                    </div>
                  </dl>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
