"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle, XCircle, Calendar, MapPin, User, LogOut, ShieldCheck, Lock, Save, Camera, BookOpen, WifiOff } from "lucide-react";
import {
  markTicketEntry,
  verifyTicketAtDoor,
  type CheckResult,
  type DoorPrevious,
} from "@/app/kontrol/actions";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";
import ControllerApplyForm from "@/components/ControllerApplyForm";
import { supabase } from "@/lib/supabase-client";
import QRScanner from "@/components/QRScanner";
import DoorCounters from "@/components/DoorCounters";
import OfflineDoorPanel from "@/components/OfflineDoorPanel";
import { decideOffline, loadManifest, queueScan } from "@/lib/offline-checkin";
import { feedbackService } from "@/lib/feedbackService";
import { formatSupabaseAuthErrorMessage } from "@/lib/supabase-auth-errors";
import {
  fetchUserProfile,
  updateUserPassword,
  upsertUserProfile,
} from "@/lib/user-profile-client";

type ProfileForm = {
  first_name: string;
  last_name: string;
  email: string;
  telefon: string;
  handynummer: string;
};

function previousEntryText(previous?: DoorPrevious): string | null {
  if (!previous?.at) return null;
  const at = new Date(previous.at).toLocaleString("tr-TR");
  const by = previous.actorName ? ` · ${previous.actorName}` : "";
  return `İlk giriş: ${at}${by}`;
}

/** Mobilde yatay kaydırmalı sekme şeridi, md ve üzerinde dikey menü. */
function navTabClass(active: boolean): string {
  return `min-h-[44px] flex-none whitespace-nowrap rounded-lg px-3 py-2.5 text-left text-sm md:w-full ${
    active ? "bg-primary-600 text-white" : "text-slate-700 hover:bg-slate-100"
  }`;
}

export default function KontrolPage() {
  const searchParams = useSearchParams();
  const codeParam = searchParams.get("code");
  const { user, loading: authLoading, isController, isAdmin, userRole, signOut } = useSimpleAuth();
  const isStaff = isController || isAdmin;

  const [activeTab, setActiveTab] = useState<"scan" | "profile" | "password">("scan");
  const [manualCode, setManualCode] = useState(codeParam || "");
  const [result, setResult] = useState<CheckResult | null>(null);
  const [loading, setLoading] = useState(false);
  /** Son doğrulamanın konusu; "Giriş işaretle" bu kodu kullanır. */
  const [checkedCode, setCheckedCode] = useState(codeParam?.trim() ?? "");
  const [marking, setMarking] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [scannerMounted, setScannerMounted] = useState(false);
  const [netError, setNetError] = useState<string | null>(null);
  /** Cihaza indirilmiş giriş listesi olan etkinlik; çevrimdışı karar bunu kullanır. */
  const [armedEventId, setArmedEventId] = useState<string | null>(null);
  const [queueTick, setQueueTick] = useState(0);
  const autoCheckedCodeRef = useRef<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [profileErr, setProfileErr] = useState<string | null>(null);
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<string | null>(null);
  const [pwdErr, setPwdErr] = useState<string | null>(null);
  const [password, setPassword] = useState({ newPassword: "", confirm: "" });
  const [profileForm, setProfileForm] = useState<ProfileForm>({
    first_name: "",
    last_name: "",
    email: "",
    telefon: "",
    handynummer: "",
  });

  const canShowDashboard =
    !!user && !authLoading && (isStaff || userRole === "controller" || userRole === "admin");

  // Oturum sona erdiyse (unauthenticated) hata ekranı yerine ana sayfaya yönlendir
  useEffect(() => {
    if (!result || result.valid) return;
    if ("message" in result && /giriş yapmanız gerekiyor/.test(String(result.message || ""))) {
      window.location.replace("/");
    }
  }, [result]);

  useEffect(() => {
    if (!canShowDashboard) return;
    let cancelled = false;
    (async () => {
      setProfileLoading(true);
      try {
        if (!user?.id) return;
        const profile = await fetchUserProfile(user.id);
        if (cancelled) return;
        setProfileForm({
          first_name: profile?.first_name || "",
          last_name: profile?.last_name || "",
          email: profile?.email || user?.email || "",
          telefon: profile?.telefon || "",
          handynummer: profile?.handynummer || "",
        });
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canShowDashboard, user?.id, user?.email]);

  /**
   * Çevrimdışı karar: yalnız cihazdaki giriş listesine bakılır.
   * Liste o kodu bilmiyorsa RED — diğer etkinliğin/iptal edilen siparişin bileti
   * kapıda yeşil olmaz. Sunucu bağlantısı geri geldiğinde kuyruk yazılır.
   */
  const scanOffline = useCallback(
    async (code: string): Promise<CheckResult | null> => {
      if (!armedEventId) return null;
      const [decision, manifest] = await Promise.all([
        decideOffline(armedEventId, code),
        loadManifest(armedEventId),
      ]);
      const base: CheckResult = {
        valid: false,
        offline: true,
        eventId: armedEventId,
        eventTitle: manifest?.event.title ?? undefined,
        eventDate: manifest?.event.date ?? undefined,
        eventTime: manifest?.event.time ?? undefined,
        venue: manifest?.event.location ?? undefined,
        quantity: 1,
      };
      const entry = decision.entry;
      const seat = {
        seatSection: entry?.section ?? null,
        seatRow: entry?.row ?? null,
        seatLabel: entry?.seat ?? null,
      };

      if (decision.state === "unknown") {
        return {
          ...base,
          ...seat,
          reason: "not_found",
          message: "Kod cihazdaki giriş listesinde yok (çevrimdışı karar).",
        };
      }
      if (decision.state === "used") {
        return { ...base, ...seat, reason: "used" };
      }
      return { ...base, ...seat, valid: true, marked: false };
    },
    [armedEventId]
  );

  const handleScan = useCallback(
    async (code: string) => {
      const clean = code.trim();
      if (!clean || loading) return;
      setLoading(true);
      setNetError(null);
      setManualCode(clean);
      setCheckedCode(clean);
      // Bağlantı yoksa sunucuyu denemeden cihaz listesinden karar ver.
      if (armedEventId && typeof navigator !== "undefined" && !navigator.onLine) {
        setResult(await scanOffline(clean));
        setLoading(false);
        return;
      }
      try {
        const res = await verifyTicketAtDoor(clean);
        setResult(res);
        if (!res.valid && res.reason === "used") {
          void feedbackService.playError();
          if (typeof navigator !== "undefined" && "vibrate" in navigator) {
            navigator.vibrate([80, 40, 80]);
          }
        }
      } catch {
        // Kapıda ağ kopması: liste yüklüyse çevrimdışı karar ver, değilse tekrar denenebilir uyarı.
        const off = await scanOffline(clean);
        if (off) {
          setResult(off);
          void feedbackService.playWarning();
        } else {
          setResult(null);
          setNetError("Bağlantı kurulamadı. İnterneti kontrol edip tekrar okutun.");
          void feedbackService.playWarning();
        }
      } finally {
        setLoading(false);
      }
    },
    [loading, armedEventId, scanOffline]
  );

  // Giriş onayı ayrı insan hamlesi: deneme amaçlı okumalar bileti yakmaz.
  const handleMark = useCallback(async () => {
    const code = checkedCode.trim();
    if (!code || marking || loading) return;
    // Çevrimdışı onay: sunucuya yazılmaz, cihaz kuyruğuna alınır.
    if (result?.offline && armedEventId) {
      setMarking(true);
      try {
        await queueScan({
          client_event_id: crypto.randomUUID(),
          event_id: armedEventId,
          code,
          scanned_at: new Date().toISOString(),
          section: result.seatSection ?? null,
          row: result.seatRow ?? null,
          seat: result.seatLabel ?? null,
        });
        setResult({ ...result, marked: true, offlineMarked: true });
        setQueueTick((n) => n + 1);
        void feedbackService.playSuccess();
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          navigator.vibrate([40]);
        }
      } finally {
        setMarking(false);
      }
      return;
    }
    setMarking(true);
    setNetError(null);
    try {
      const res = await markTicketEntry(code);
      setResult(res);
      if (res.valid && res.marked) {
        void feedbackService.playSuccess();
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          navigator.vibrate([40]);
        }
      } else if (!res.valid && res.reason === "used") {
        void feedbackService.playError();
      }
    } catch {
      const off = await scanOffline(code);
      if (off) {
        setResult(off);
        setNetError("Bağlantı yok: bilet cihaz listesinden doğrulandı, onay bekliyor.");
      } else {
        setResult(null);
        setNetError("Bağlantı kurulamadı. İnterneti kontrol edip tekrar deneyin.");
      }
      void feedbackService.playWarning();
    } finally {
      setMarking(false);
    }
  }, [checkedCode, marking, loading, result, armedEventId, scanOffline]);

  // Onay düğmesi tek yerde üretilir: sonuç kartında ve kamera şeridinde aynı öğe.
  const confirmBar = useMemo(() => {
    if (!result?.valid || result.marked) return null;
    return (
      <button
        type="button"
        onClick={() => void handleMark()}
        disabled={marking}
        className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-4 text-base font-bold text-white active:bg-green-700 disabled:opacity-60"
      >
        <CheckCircle className="h-5 w-5" />
        {marking ? "İşleniyor..." : "Giriş işaretle"}
      </button>
    );
  }, [result, marking, handleMark]);

  const resultPanel = useMemo(() => {
    if (!result) return null;
    const usedLine = result.reason === "used" ? previousEntryText(result.previous) : null;
    return (
      <div
        className={`rounded-2xl border p-4 sm:p-6 ${
          result.valid ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"
        }`}
      >
        {result.valid ? (
          <>
            <div className="flex items-center gap-2 text-green-800 font-semibold mb-4">
              <CheckCircle className="h-6 w-6 flex-shrink-0" />
              {result.marked
                ? result.offlineMarked
                  ? "Giriş işaretlendi (çevrimdışı — sunucuya gönderilmeyi bekliyor)"
                  : "Giriş işaretlendi"
                : result.offline
                  ? "Geçerli bilet — cihaz listesi doğruladı, onay bekliyor"
                  : "Geçerli bilet — onay bekliyor"}
            </div>
            <dl className="space-y-3 text-green-800">
              <div className="flex items-start gap-3">
                <span className="font-medium min-w-[80px]">Etkinlik</span>
                <span>{result.eventTitle}</span>
              </div>
              {result.eventDate ? (
                <div className="flex items-start gap-3">
                  <Calendar className="h-5 w-5 mt-0.5 text-green-600 flex-shrink-0" />
                  <span>
                    {new Date(result.eventDate).toLocaleDateString("tr-TR")} • {result.eventTime}
                  </span>
                </div>
              ) : null}
              {result.venue ? (
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 mt-0.5 text-green-600 flex-shrink-0" />
                  <span>{result.venue}</span>
                </div>
              ) : null}
              {result.seatSection || result.seatRow ? (
                <div className="flex items-start gap-3">
                  <span className="font-medium min-w-[80px]">Yer</span>
                  <span>
                    {[result.seatSection, result.seatRow && `Sıra ${result.seatRow}`, result.seatLabel && `Koltuk ${result.seatLabel}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </div>
              ) : null}
              {result.buyerName ? (
                <div className="flex items-start gap-3">
                  <User className="h-5 w-5 mt-0.5 text-green-600 flex-shrink-0" />
                  <div>
                    <div>{result.buyerName}</div>
                    <div className="text-sm text-green-700">{result.buyerEmail}</div>
                    <div className="text-sm text-green-700">{result.quantity} bilet</div>
                  </div>
                </div>
              ) : null}
            </dl>
            <div className="mt-5 space-y-2">
              {confirmBar}
              {result.marked ? null : (
                <p className="text-xs leading-5 text-green-700">
                  Bu düğmeye basmadan bilet kullanılmamış olur. Deneme amaçlı okutmalarda basmayın.
                </p>
              )}
            </div>
          </>
        ) : (
          <div className="text-red-800">
            <div className="flex items-center gap-2 font-semibold">
              <XCircle className="h-6 w-6 flex-shrink-0" />
              {result.reason === "not_found"
                ? result.message || "Bilet bulunamadı. Kodu kontrol edin."
                : result.reason === "used"
                  ? result.offline
                    ? "Bu bilet içeri geçti (çevrimdışı liste)."
                    : "Bu bilet içeri geçti."
                  : result.reason === "invalid"
                    ? result.message || "Bilet geçersiz."
                    : result.message || "Bir hata oluştu. Lütfen tekrar deneyin."}
            </div>
            {usedLine ? (
              <p className="mt-2 pl-8 text-sm text-red-700">{usedLine}</p>
            ) : null}
          </div>
        )}
      </div>
    );
  }, [result, confirmBar]);

  // Sürekli taramada hüküm kameranın üstünde görünür; her bilet için modal açılıp kapanmaz.
  const scanOverlayStatus = useMemo(() => {
    if (loading) {
      return (
        <div className="rounded-lg bg-slate-100 p-3 text-sm text-slate-600">Kontrol ediliyor...</div>
      );
    }
    if (netError) {
      return (
        <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm font-medium text-amber-900">
          <WifiOff className="h-5 w-5 flex-shrink-0" />
          {netError}
        </div>
      );
    }
    if (!result) return null;
    if (result.valid) {
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2 rounded-lg border border-green-300 bg-green-50 p-3 text-sm font-semibold text-green-800">
            <CheckCircle className="h-5 w-5 flex-shrink-0" />
            {result.marked
              ? "Giriş işaretlendi"
              : `${result.offline ? "Geçerli bilet (çevrimdışı)" : "Geçerli bilet"} — onay bekliyor: ${result.eventTitle}`}
          </div>
          {confirmBar}
        </div>
      );
    }
    const text =
      result.reason === "used"
        ? result.offline
          ? "Bu bilet içeri geçti (çevrimdışı liste)."
          : "Bu bilet içeri geçti."
        : result.reason === "not_found"
          ? result.message || "Bilet bulunamadı. Kodu kontrol edin."
          : result.message || "Bilet geçersiz.";
    const previousLine = result.reason === "used" ? previousEntryText(result.previous) : null;
    return (
      <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-red-800">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <XCircle className="h-5 w-5 flex-shrink-0" />
          {text}
        </div>
        {previousLine ? (
          <p className="mt-1 pl-7 text-xs text-red-700">{previousLine}</p>
        ) : null}
      </div>
    );
  }, [loading, netError, result, confirmBar]);

  // Bilet QR bağlantısı (/kontrol?code=BLT-…) açıldığında: yalnız doğrula; onay ayrı.
  useEffect(() => {
    const code = codeParam?.trim();
    if (authLoading || !user || !code || (!isStaff && userRole !== "controller" && userRole !== "admin")) return;
    if (autoCheckedCodeRef.current === code) return;
    autoCheckedCodeRef.current = code;
    void handleScan(code);
  }, [authLoading, codeParam, user, isStaff, userRole, handleScan]);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileSaving(true);
    setProfileErr(null);
    setProfileMsg(null);
    try {
      if (!user) {
        setProfileErr("Oturum doğrulanamadı.");
        return;
      }
      await upsertUserProfile(user, profileForm);
      setProfileMsg("Bilgiler güncellendi.");
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleSavePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwdSaving(true);
    setPwdErr(null);
    setPwdMsg(null);
    try {
      if (password.newPassword.length < 6) {
        setPwdErr("Şifre en az 6 karakter olmalı.");
        return;
      }
      if (password.newPassword !== password.confirm) {
        setPwdErr("Şifreler eşleşmiyor.");
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setPwdErr("Oturum doğrulanamadı.");
        return;
      }
      await updateUserPassword(password.newPassword);
      setPassword({ newPassword: "", confirm: "" });
      setPwdMsg("Şifre güncellendi.");
    } catch (err) {
      setPwdErr(formatSupabaseAuthErrorMessage(err) || "Şifre güncellenemedi.");
    } finally {
      setPwdSaving(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    window.location.href = "/giris";
  }

  if (!codeParam && authLoading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center text-slate-600">
        Yükleniyor...
      </div>
    );
  }

  if (canShowDashboard) {
    return (
      <div className="min-h-screen bg-paper p-3 sm:p-4 md:p-6">
        <div className="mx-auto max-w-6xl grid gap-4 md:gap-6 md:grid-cols-[240px_1fr]">
          <aside className="rounded-2xl border border-slate-200 bg-white p-2 sm:p-4 md:h-max">
            <h2 className="mb-2 hidden px-2 text-sm font-semibold text-slate-500 md:block">
              Kontrolör Paneli
            </h2>
            <nav className="flex gap-1 overflow-x-auto md:flex-col md:gap-0 md:space-y-1">
              <button
                onClick={() => setActiveTab("scan")}
                className={`${navTabClass(activeTab === "scan")}`}
              >
                Bilet Kontrol
              </button>
              <Link
                href="/kontrol/kullanim-klavuzu"
                className={`${navTabClass(false)} flex items-center gap-2`}
              >
                <BookOpen className="h-4 w-4" />
                Kılavuz
              </Link>
              <button
                onClick={() => setActiveTab("profile")}
                className={navTabClass(activeTab === "profile")}
              >
                Bilgilerim
              </button>
              <button
                onClick={() => setActiveTab("password")}
                className={navTabClass(activeTab === "password")}
              >
                Şifre Değiştir
              </button>
              <button
                onClick={() => void handleSignOut()}
                className="flex min-h-[44px] flex-none items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700 hover:bg-red-100 md:mt-3 md:w-full"
              >
                <LogOut className="h-4 w-4" />
                Çıkış
              </button>
            </nav>
          </aside>

          <main className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
            {activeTab === "scan" && (
              <div className="space-y-4">
                <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-primary-600" />
                  Bilet Kontrol
                </h1>
                <p className="text-sm text-slate-600">
                  QR koddan gelen bilet kodunu otomatik kontrol edebilir veya aşağıdan manuel sorgulayabilirsiniz.
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    placeholder="Bilet kodu girin"
                    className="min-h-[48px] flex-1 rounded-lg border border-slate-300 px-3 text-base focus:border-primary-500 focus:ring-1 focus:ring-primary-500 sm:text-sm"
                  />
                  <button
                    onClick={() => void handleScan(manualCode)}
                    disabled={loading}
                    className="min-h-[48px] rounded-lg bg-primary-600 px-4 font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
                  >
                    Kontrol Et
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowQRScanner(true);
                    setScannerMounted(true);
                  }}
                  className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 text-base font-semibold text-white hover:bg-primary-700 sm:w-auto"
                >
                  <Camera className="h-5 w-5" />
                  Bilet Tara
                </button>
                {netError && (
                  <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm font-medium text-amber-900">
                    <WifiOff className="h-5 w-5 flex-shrink-0" />
                    {netError}
                  </div>
                )}
                {loading ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-slate-600">
                    Kontrol ediliyor...
                  </div>
                ) : resultPanel}
                <DoorCounters eventId={result?.eventId} />
                <OfflineDoorPanel
                  armedEventId={armedEventId}
                  onArmedChange={setArmedEventId}
                  queueTick={queueTick}
                />
              </div>
            )}

            {activeTab === "profile" && (
              <form onSubmit={handleSaveProfile} className="space-y-4 max-w-xl">
                <h1 className="text-xl font-bold text-slate-900">Bilgilerim</h1>
                {profileLoading ? <p className="text-sm text-slate-500">Yükleniyor...</p> : null}
                <div className="grid sm:grid-cols-2 gap-4">
                  <input
                    value={profileForm.first_name}
                    onChange={(e) => setProfileForm((p) => ({ ...p, first_name: e.target.value }))}
                    placeholder="Ad"
                    className="rounded-lg border border-slate-300 px-3 py-2"
                  />
                  <input
                    value={profileForm.last_name}
                    onChange={(e) => setProfileForm((p) => ({ ...p, last_name: e.target.value }))}
                    placeholder="Soyad"
                    className="rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
                <input
                  type="email"
                  value={profileForm.email}
                  onChange={(e) => setProfileForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="E-posta"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
                <div className="grid sm:grid-cols-2 gap-4">
                  <input
                    value={profileForm.telefon}
                    onChange={(e) => setProfileForm((p) => ({ ...p, telefon: e.target.value }))}
                    placeholder="Telefon"
                    className="rounded-lg border border-slate-300 px-3 py-2"
                  />
                  <input
                    value={profileForm.handynummer}
                    onChange={(e) => setProfileForm((p) => ({ ...p, handynummer: e.target.value }))}
                    placeholder="Cep telefonu"
                    className="rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
                {profileErr ? <p className="text-sm text-red-600">{profileErr}</p> : null}
                {profileMsg ? <p className="text-sm text-green-700">{profileMsg}</p> : null}
                <button
                  type="submit"
                  disabled={profileSaving}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  Kaydet
                </button>
              </form>
            )}

            {activeTab === "password" && (
              <form onSubmit={handleSavePassword} className="space-y-4 max-w-xl">
                <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  Şifre Değiştir
                </h1>
                <input
                  type="password"
                  value={password.newPassword}
                  onChange={(e) => setPassword((p) => ({ ...p, newPassword: e.target.value }))}
                  placeholder="Yeni şifre"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
                <input
                  type="password"
                  value={password.confirm}
                  onChange={(e) => setPassword((p) => ({ ...p, confirm: e.target.value }))}
                  placeholder="Yeni şifre (tekrar)"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
                {pwdErr ? <p className="whitespace-pre-line text-sm text-red-600">{pwdErr}</p> : null}
                {pwdMsg ? <p className="text-sm text-green-700">{pwdMsg}</p> : null}
                <button
                  type="submit"
                  disabled={pwdSaving}
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 font-semibold text-white hover:bg-slate-900 disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  Şifreyi Güncelle
                </button>
              </form>
            )}
          </main>

          {scannerMounted && (
            <div hidden={!showQRScanner} inert={!showQRScanner}>
              <QRScanner
                busy={!showQRScanner}
                onScan={(code) => void handleScan(code)}
                onClose={() => setShowQRScanner(false)}
                statusSlot={scanOverlayStatus}
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper py-8 px-4">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-6">
          <Link
            href="/"
            className="text-primary-600 hover:text-primary-700 font-medium text-sm"
          >
            ← KurdEvents
          </Link>
        </div>
        <h1 className="mb-2 text-center font-display text-3xl font-bold text-slate-900 sm:text-4xl">
          Bilet Kontrol
        </h1>
        <p className="text-slate-600 text-center text-sm mb-8">
          Bilet doğrulama yalnızca yetkili personel tarafından yapılabilir.
        </p>

        {codeParam && !user && !authLoading && (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-600">
            <p className="mb-4">Bilet kodu algılandı.</p>
            <p className="text-sm mb-4">
              Kontrol için personel hesabınızla giriş yapın.
            </p>
            <Link
              href={`/giris?redirect=${encodeURIComponent(`/kontrol?code=${codeParam}`)}`}
              className="inline-block rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
            >
              Giriş Yap
            </Link>
          </div>
        )}

        {codeParam && user && !isStaff && userRole !== "controller" && userRole !== "admin" && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center text-amber-900">
            <p className="text-sm">
              Bu hesabın bilet kontrol yetkisi yok. Yönetici veya kontrolör hesabıyla giriş yapın.
            </p>
          </div>
        )}

        {codeParam && authLoading && (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
            Yönlendiriliyor...
          </div>
        )}

        {!codeParam && (
          <>
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-600">
              <p className="text-base">Bilet kontrolü için yetkili hesabınızla giriş yapın.</p>
              <Link
                href="/giris?redirect=%2Fkontrol"
                className="mt-6 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg bg-gold-500 px-6 text-base font-semibold text-white hover:bg-gold-600"
              >
                <Lock className="h-5 w-5" />
                Yetkili Girişi
              </Link>
            </div>
            <ControllerApplyForm />
          </>
        )}
      </div>
    </div>
  );
}
