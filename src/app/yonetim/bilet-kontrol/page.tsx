"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { FileCheck, CheckCircle, XCircle, Calendar, MapPin, User, AlertCircle, Camera, LogIn } from "lucide-react";
import Link from "next/link";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";
import type { CheckResult } from "@/app/kontrol/actions";
import QRScanner from "@/components/QRScanner";
import DoorCounters from "@/components/DoorCounters";
import { supabase } from "@/lib/supabase-client";

type StaffEvent = {
  id: string;
  title?: string | null;
  date?: string | null;
  time?: string | null;
  venue?: string | null;
};

export default function BiletKontrolPage() {
  const { user, loading: authLoading, isAdmin, isController, isOrganizer } = useSimpleAuth();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [ticketCode, setTicketCode] = useState("");
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [checkinDone, setCheckinDone] = useState(false);
  const [events, setEvents] = useState<StaffEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const autoCheckedCodeRef = useRef<string | null>(null);

  const canAccessStaff = isAdmin || isController || isOrganizer;

  const checkTicketViaApi = useCallback(async (code: string): Promise<CheckResult> => {
    const { data: { session } } = await supabase.auth.getSession();
    let token = session?.access_token;
    if (!token) {
      // Oturum yok → ana sayfaya yönlendir
      window.location.replace("/");
      return { valid: false, reason: "error", message: "Oturumunuz sona erdi." };
    }

    const doCheck = (accessToken: string) => {
      const formData = new FormData();
      formData.append("ticket_code", code);
      return fetch("/api/check-ticket", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      });
    };

    let res = await doCheck(token);
    // Access token süresi dolmuş olabilir; oturumu yenileyip bir kez daha dene.
    if (res.status === 401) {
      try {
        const { data: refreshed } = await supabase.auth.refreshSession();
        if (refreshed.session?.access_token) {
          token = refreshed.session.access_token;
          res = await doCheck(token);
        }
      } catch {
        /* yenileme başarısız olursa mevcut sonucu döndür */
      }
    }
    const data = (await res.json().catch(() => ({}))) as CheckResult;
    if (!res.ok) {
      console.error("[bilet-kontrol] check-ticket API yanıtı:", res.status, data);
    }
    if (res.status === 401) {
      // Oturum sona erdi → hata ekranı yerine ana sayfaya yönlendir
      window.location.replace("/");
    }
    return data;
  }, []);

  // Kapı özeti seçim kutusu: personelin yetkili olduğu etkinlikler.
  useEffect(() => {
    if (authLoading || !user || !canAccessStaff) return;
    let cancelled = false;
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;
      const res = await fetch("/api/staff-events", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json().catch(() => null)) as { events?: StaffEvent[] } | null;
      if (cancelled || !res.ok) return;
      setEvents(Array.isArray(data?.events) ? data.events : []);
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user, canAccessStaff]);

  // URL'dan kod — yalnızca oturum + yetki doğrulandıktan sonra otomatik kontrol
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (authLoading || !user || !canAccessStaff) return;

    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code")?.trim();
    if (!code || autoCheckedCodeRef.current === code) return;

    autoCheckedCodeRef.current = code;
    setTicketCode(code);
    void (async () => {
      setLoading(true);
      setResult(null);
      const res = await checkTicketViaApi(code);
      setResult(res);
      setLoading(false);
    })();
  }, [authLoading, user, canAccessStaff, checkTicketViaApi]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (authLoading) return;
    if (user) return;

    const currentPathWithSearch = `${window.location.pathname}${window.location.search || ""}`;
    const loginUrl = `/giris?redirect=${encodeURIComponent(currentPathWithSearch)}`;
    window.location.replace(loginUrl);
  }, [authLoading, user]);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setResult(null);
    const code = String(formData.get("ticket_code") || "").trim();
    const res = await checkTicketViaApi(code);
    setResult(res);
    setLoading(false);
  }
  async function handleCheck() {
    if (!ticketCode.trim()) return;
    setCheckinDone(false);
    const formData = new FormData();
    formData.append('ticket_code', ticketCode);
    await handleSubmit(formData);
  }

  async function handleCheckWithCode(code: string) {
    const c = code.trim().toUpperCase();
    if (!c) return;
    setTicketCode(c);
    setCheckinDone(false);
    const formData = new FormData();
    formData.append('ticket_code', c);
    await handleSubmit(formData);
  }

  function resetForNextTicket() {
    setTicketCode("");
    setResult(null);
    setCheckinDone(false);
    setLoading(false);
    setCheckinLoading(false);
  }

  async function handleCheckin() {
    if (!ticketCode.trim() || !result || !("valid" in result) || !result.valid) return;
    setCheckinLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        alert("Oturum bulunamadı. Lütfen tekrar giriş yapın.");
        setCheckinLoading(false);
        return;
      }
      const res = await fetch("/api/checkin-ticket", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ticket_code: ticketCode.trim().toUpperCase() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data?.message || data?.error || "Giriş işaretlenemedi.");
        setCheckinLoading(false);
        return;
      }
      setCheckinDone(true);
    } catch (e) {
      console.error(e);
      alert("Bir hata oluştu.");
    } finally {
      setCheckinLoading(false);
    }
  }

  if (authLoading) {
    return (
      <div className="p-4 sm:p-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-600">
          Oturum kontrol ediliyor...
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-4 sm:p-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-600">
          Giriş sayfasına yönlendiriliyor...
        </div>
      </div>
    );
  }

  // Admin, kontrolör veya organizatör erişebilir (organizatör sadece kendi etkinliklerinin biletleri)
  if (!isAdmin && !isController && !isOrganizer) {
    return (
      <div className="p-4 sm:p-8">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-red-800 mb-2">
            Erişim Reddedildi
          </h2>
          <p className="text-red-600">
            Bu sayfaya sadece yöneticiler, kontrolörler ve organizatörler erişebilir.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Bilet Kontrol</h1>
          <Link
            href="/yonetim/bilet-kontrol/kullanim-klavuzu"
            className="shrink-0 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
          >
            Kullanım Kılavuzu
          </Link>
        </div>
        <p className="text-slate-600 mb-6">
          Bilet kodunu okut veya yaz; geçerliliği kontrol edilsin. Giriş, ancak {" "}
          <span className="font-semibold">"Giriş işaretle"</span> düğmesine bastığında kullanılmış olur.
        </p>

        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <label htmlFor="door_event" className="block text-sm font-medium text-slate-700 mb-2">
            Kapı özeti etkinliği
          </label>
          <select
            id="door_event"
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="min-h-[48px] w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 focus:border-primary-500 focus:ring-primary-500"
          >
            <option value="">Seçilmedi — son okutulan biletin etkinliği</option>
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.title || "Başlıksız etkinlik"}
                {event.date ? ` • ${new Date(event.date).toLocaleDateString("tr-TR")}` : ""}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-slate-500">
            Yetkin olan etkinlikler listelenir; admin tüm etkinlikleri görür.
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            void handleSubmit(formData);
          }}
          className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm mb-6"
        >          <label htmlFor="ticket_code" className="block text-sm font-medium text-slate-700 mb-2">
            Bilet Kodu
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              id="ticket_code"
              name="ticket_code"
              type="text"
              value={ticketCode}
              onChange={(e) => setTicketCode(e.target.value)}
              required
              placeholder="BLT-XXXXXXXX"
              className="min-h-[48px] flex-1 rounded-lg border border-slate-300 px-4 py-3 font-mono text-base text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:ring-primary-500 uppercase sm:text-sm"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading}
              className="min-h-[48px] flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-6 py-3 font-semibold text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              <FileCheck className="h-5 w-5" />
              {loading ? "Kontrol..." : "Kontrol Et"}
            </button>
          </div>
        </form>

        <button
          type="button"
          onClick={() => setShowQRScanner(true)}
          className="mb-3 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 font-medium text-white transition hover:from-blue-700 hover:to-indigo-700 shadow-md"
        >
          <Camera className="h-5 w-5" />
          Kamera ile Tara
        </button>

        <DoorCounters eventId={selectedEventId || result?.eventId} className="mb-6" />

        {result && (
          <div
            className={`rounded-2xl border p-4 sm:p-6 ${
              result.valid
                ? "border-green-200 bg-green-50"
                : "border-red-200 bg-red-50"
            }`}
          >
            {result.valid ? (
              <>
                <div className="flex items-center gap-2 text-green-800 font-semibold mb-4">
                  <CheckCircle className="h-6 w-6 flex-shrink-0" />
                  {checkinDone ? "Giriş işaretlendi" : "Geçerli bilet — onay bekliyor"}
                </div>
                <dl className="space-y-3 text-green-800">
                  <div className="flex items-start gap-3">
                    <span className="font-medium min-w-[80px]">Etkinlik</span>
                    <span>{result.eventTitle}</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Calendar className="h-5 w-5 mt-0.5 text-green-600 flex-shrink-0" />
                    <span>
                      {new Date(result.eventDate).toLocaleDateString("tr-TR")} • {result.eventTime}
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
                {!checkinDone ? (
                  <div className="mt-4 space-y-2">
                    <button
                      type="button"
                      onClick={handleCheckin}
                      disabled={checkinLoading}
                      className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-4 text-base font-bold text-white hover:bg-green-700 disabled:opacity-60"
                    >
                      <LogIn className="h-5 w-5" />
                      {checkinLoading ? "İşleniyor..." : "Giriş işaretle"}
                    </button>
                    <p className="text-xs leading-5 text-green-700">
                      Bu düğmeye basmadan bilet kullanılmamış olur. Deneme amaçlı okutmalarda basmayın.
                    </p>
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    <button
                      type="button"
                      onClick={resetForNextTicket}
                      className="min-h-[44px] rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Yeni bilet tara
                    </button>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 text-red-800 font-semibold mb-4">
                  <XCircle className="h-6 w-6 flex-shrink-0" />
                  {"reason" in result && result.reason === "not_found"
                    ? "Bilet bulunamadı. Kodu kontrol edin."
                    : "reason" in result && result.reason === "used"
                      ? "Bu bilet içeri geçti."
                      : "reason" in result && result.reason === "invalid"
                        ? result.message || "Bilet geçersiz."
                        : (result as { message?: string; error?: string }).message || (result as { error?: string }).error || "Bir hata oluştu. Lütfen tekrar deneyin."}
                </div>

                {result.reason === "used" && result.previous?.at ? (
                  <p className="-mt-2 mb-3 text-sm text-red-700">
                    İlk giriş: {new Date(result.previous.at).toLocaleString("tr-TR")}
                    {result.previous.actorName ? ` · ${result.previous.actorName}` : ""}
                  </p>
                ) : null}

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
                        <div className="text-sm text-red-700">{result.quantity || 1} bilet</div>
                      </div>
                    </div>
                  </dl>
                )}
                <button
                  type="button"
                  onClick={resetForNextTicket}
                  className="mt-4 min-h-[44px] rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Yeni bilet tara
                </button>
              </>
            )}
          </div>
        )}

        {showQRScanner && (
          <QRScanner
            onScan={(code) => {
              setShowQRScanner(false);
              handleCheckWithCode(code);
            }}
            onClose={() => setShowQRScanner(false)}
          />
        )}

      </div>
    </div>
  );
}
