"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle, XCircle, Calendar, MapPin, User, LogOut, ShieldCheck, Lock, Save } from "lucide-react";
import { checkTicket, type CheckResult } from "@/app/kontrol/actions";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";
import { supabase } from "@/lib/supabase-client";

type ProfileForm = {
  first_name: string;
  last_name: string;
  email: string;
  telefon: string;
  handynummer: string;
};

export default function KontrolPage() {
  const searchParams = useSearchParams();
  const codeParam = searchParams.get("code");
  const { user, loading: authLoading, isController, isAdmin, userRole, signOut } = useSimpleAuth();
  const isStaff = isController || isAdmin;
  const [resolvedRole, setResolvedRole] = useState<"admin" | "controller" | "organizer" | null>(null);

  const [activeTab, setActiveTab] = useState<"scan" | "profile" | "password">("scan");
  const [manualCode, setManualCode] = useState(codeParam || "");
  const [result, setResult] = useState<CheckResult | null>(null);
  const [loading, setLoading] = useState(!!codeParam);
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
    !codeParam &&
    !!user &&
    (isStaff || userRole === "controller" || userRole === "admin" || resolvedRole === "controller" || resolvedRole === "admin");

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

  useEffect(() => {
    if (!canShowDashboard) return;
    let cancelled = false;
    (async () => {
      setProfileLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) return;
        const res = await fetch("/api/profile", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const profile = (await res.json()) as {
          first_name?: string | null;
          last_name?: string | null;
          email?: string | null;
          telefon?: string | null;
          handynummer?: string | null;
        } | null;
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
  }, [canShowDashboard, user?.email]);

  useEffect(() => {
    if (codeParam || !user || isStaff || userRole) return;
    let cancelled = false;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) return;
        const res = await fetch("/api/auth/role", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = (await res.json()) as { role?: "admin" | "controller" | "organizer" | null };
        if (!cancelled) setResolvedRole(data.role ?? null);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [codeParam, user, isStaff, userRole]);

  const resultPanel = useMemo(() => {
    if (!result) return null;
    return (
      <div
        className={`rounded-2xl border p-6 ${
          result.valid ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"
        }`}
      >
        {result.valid ? (
          <>
            <div className="flex items-center gap-2 text-green-800 font-semibold mb-4">
              <CheckCircle className="h-6 w-6 flex-shrink-0" />
              Geçerli bilet - girişe izin verildi
            </div>
            <dl className="space-y-3 text-green-800">
              <div className="flex items-start gap-3">
                <span className="font-medium min-w-[80px]">Etkinlik</span>
                <span>{result.eventTitle}</span>
              </div>
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 mt-0.5 text-green-600 flex-shrink-0" />
                <span>
                  {result.eventDate ? new Date(result.eventDate).toLocaleDateString("tr-TR") : ""} • {result.eventTime}
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
          <div className="flex items-center gap-2 text-red-800 font-semibold">
            <XCircle className="h-6 w-6 flex-shrink-0" />
            {"reason" in result && result.reason === "not_found"
              ? "Bilet bulunamadı. Kodu kontrol edin."
              : "reason" in result && result.reason === "used"
                ? "Bu bilet daha önce kullanılmıştır."
                : "reason" in result && result.reason === "invalid"
                  ? result.message || "Bilet geçersiz."
                  : "Bir hata oluştu. Lütfen tekrar deneyin."}
          </div>
        )}
      </div>
    );
  }, [result]);

  async function runTicketCheck(code: string) {
    const clean = code.trim();
    if (!clean) return;
    setLoading(true);
    const res = await checkTicket(clean);
    setResult(res);
    setLoading(false);
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileSaving(true);
    setProfileErr(null);
    setProfileMsg(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setProfileErr("Oturum doğrulanamadı.");
        return;
      }
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(profileForm),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setProfileErr(data.error || "Bilgiler kaydedilemedi.");
        return;
      }
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
      const token = session?.access_token;
      if (!token) {
        setPwdErr("Oturum doğrulanamadı.");
        return;
      }
      const res = await fetch("/api/profile/password", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password: password.newPassword, passwordConfirm: password.confirm }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setPwdErr(data.error || "Şifre güncellenemedi.");
        return;
      }
      setPassword({ newPassword: "", confirm: "" });
      setPwdMsg("Şifre güncellendi.");
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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-600">
        Yükleniyor...
      </div>
    );
  }

  if (canShowDashboard) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 md:p-6">
        <div className="mx-auto max-w-6xl grid gap-6 md:grid-cols-[240px_1fr]">
          <aside className="rounded-2xl border border-slate-200 bg-white p-4 h-max">
            <h2 className="px-2 text-sm font-semibold text-slate-500 mb-2">Kontrolör Paneli</h2>
            <nav className="space-y-1">
              <button
                onClick={() => setActiveTab("scan")}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                  activeTab === "scan" ? "bg-primary-600 text-white" : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                Bilet Kontrol
              </button>
              <button
                onClick={() => setActiveTab("profile")}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                  activeTab === "profile" ? "bg-primary-600 text-white" : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                Bilgilerim
              </button>
              <button
                onClick={() => setActiveTab("password")}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                  activeTab === "password" ? "bg-primary-600 text-white" : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                Şifre Değiştir
              </button>
            </nav>
            <button
              onClick={() => void handleSignOut()}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
            >
              <LogOut className="h-4 w-4" />
              Çıkış
            </button>
          </aside>

          <main className="rounded-2xl border border-slate-200 bg-white p-6">
            {activeTab === "scan" && (
              <div className="space-y-4">
                <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-primary-600" />
                  Bilet Kontrol
                </h1>
                <p className="text-sm text-slate-600">
                  QR koddan gelen bilet kodunu otomatik kontrol edebilir veya aşağıdan manuel sorgulayabilirsiniz.
                </p>
                <div className="flex gap-2">
                  <input
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    placeholder="Bilet kodu girin"
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-2 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                  />
                  <button
                    onClick={() => void runTicketCheck(manualCode)}
                    className="rounded-lg bg-primary-600 px-4 py-2 font-semibold text-white hover:bg-primary-700"
                  >
                    Kontrol Et
                  </button>
                </div>
                {loading ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-slate-600">
                    Kontrol ediliyor...
                  </div>
                ) : resultPanel}
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
                {pwdErr ? <p className="text-sm text-red-600">{pwdErr}</p> : null}
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
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-6">
          <Link
            href="/"
            className="text-primary-600 hover:text-primary-700 font-medium text-sm"
          >
            ← KurdEvents
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

        {!loading && codeParam && result && resultPanel}
      </div>
    </div>
  );
}
