"use client";

import { useEffect, useRef, useState } from "react";
import { Link } from "@/i18n/navigation";
import { Eye, EyeOff, LogIn, ArrowLeft, UserPlus, Calendar } from "lucide-react";
import { useTranslations } from "next-intl";
import Header from "@/components/Header";
import { supabase } from "@/lib/supabase-client";

const PASSWORD_VALIDATION_PATTERN = /password should contain at least one character of each/i;

type AuthTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  user?: { email?: string };
  error_description?: string;
  msg?: string;
};

export default function LoginPage() {
  const t = useTranslations("auth");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const activeLoginAttemptRef = useRef(0);

  // Üye ol (bilet alıcı) state
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regShowPassword, setRegShowPassword] = useState(false);
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState("");
  const [regSuccess, setRegSuccess] = useState("");

  // Organizatör başvurusu state
  const [orgEmail, setOrgEmail] = useState("");
  const [orgPassword, setOrgPassword] = useState("");
  const [orgShowPassword, setOrgShowPassword] = useState(false);
  const [orgLoading, setOrgLoading] = useState(false);
  const [orgError, setOrgError] = useState("");
  const [orgSuccess, setOrgSuccess] = useState("");

  useEffect(() => {
    return () => {
      activeLoginAttemptRef.current = 0;
    };
  }, []);

  async function signInWithTimeout(credentials: { email: string; password: string }, timeoutMs = 15000) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Supabase ayarlari eksik. NEXT_PUBLIC_SUPABASE_URL / KEY kontrol edin.");
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify(credentials),
        signal: controller.signal,
      });

      const payload = (await response.json()) as AuthTokenResponse;
      if (!response.ok) {
        const rawMsg = payload.error_description || payload.msg || "Giris istegi basarisiz oldu.";
        // "Invalid login credentials" = yanlış şifre VEYA e-posta henüz onaylanmamış
        if (/invalid login credentials|invalid credentials/i.test(rawMsg)) {
          throw new Error(
            "E-posta veya şifre hatalı. E-posta onayı gerekiyorsa, kayıt sonrası gelen onay linkine tıklayıp tekrar deneyin."
          );
        }
        throw new Error(rawMsg);
      }

      if (!payload.access_token || !payload.refresh_token) {
        throw new Error("Giris yaniti gecersiz. access_token/refresh_token eksik.");
      }

      const setSessionPromise = supabase.auth.setSession({
        access_token: payload.access_token,
        refresh_token: payload.refresh_token,
      });
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Oturum kurulumu zaman aşımına uğradı.")), 12000)
      );
      const { data, error } = await Promise.race([setSessionPromise, timeoutPromise]);
      if (error) throw error;

      return data;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new Error("Giriş isteği zaman aşımına uğradı. Lütfen tekrar deneyin.");
      }
      throw error;
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (regLoading) return;
    setRegLoading(true);
    setRegError("");
    setRegSuccess("");

    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email: regEmail,
        password: regPassword,
        options: { emailRedirectTo: undefined },
      });

      if (signUpError) {
        if (signUpError.message?.includes("already registered") || signUpError.message?.includes("already exists")) {
          setRegError("Bu e-posta adresi zaten kayıtlı. Giriş yapabilirsiniz.");
        } else if (PASSWORD_VALIDATION_PATTERN.test(signUpError.message || "")) {
          setRegError(t("passwordRequirements"));
        } else {
          setRegError(signUpError.message || "Kayıt oluşturulamadı.");
        }
        return;
      }

      setRegSuccess("Hesabınız oluşturuldu! Giriş yaparak bilet satın alabilirsiniz.");
      setRegEmail("");
      setRegPassword("");
    } catch (err) {
      setRegError(err instanceof Error ? err.message : "Beklenmeyen bir hata oluştu.");
    } finally {
      setRegLoading(false);
    }
  }

  async function handleOrganizerApply(e: React.FormEvent) {
    e.preventDefault();
    if (orgLoading) return;
    setOrgLoading(true);
    setOrgError("");
    setOrgSuccess("");

    try {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: orgEmail,
        password: orgPassword,
        options: { emailRedirectTo: undefined },
      });

      if (signUpError) {
        if (signUpError.message?.includes("already registered") || signUpError.message?.includes("already exists")) {
          setOrgError("Bu e-posta adresi zaten kayıtlı. Üstteki giriş formunu kullanarak giriş yapabilirsiniz.");
        } else if (PASSWORD_VALIDATION_PATTERN.test(signUpError.message || "")) {
          setOrgError(t("passwordRequirements"));
        } else {
          setOrgError(signUpError.message || "Kayıt oluşturulamadı.");
        }
        return;
      }

      if (!signUpData.user?.id) {
        setOrgError("Hesap oluşturuldu ancak başvuru kaydedilemedi. Lütfen giriş yapıp tekrar deneyin.");
        return;
      }

      const res = await fetch("/api/organizer-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: signUpData.user.id,
          email: orgEmail,
        }),
      });

      const resData = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setOrgError(resData.error || "Başvuru kaydedilemedi.");
        return;
      }

      setOrgSuccess("Organizatör başvurunuz alındı! Yönetici onayından sonra etkinlik ekleyebileceksiniz. E-posta ile bilgilendirileceksiniz.");
      setOrgEmail("");
      setOrgPassword("");
    } catch (err) {
      setOrgError(err instanceof Error ? err.message : "Beklenmeyen bir hata oluştu.");
    } finally {
      setOrgLoading(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    const attemptId = Date.now();
    activeLoginAttemptRef.current = attemptId;
    setLoading(true);
    setError("");

    try {
      const data = await signInWithTimeout({
        email,
        password,
      });
      if (!data?.session?.user) throw new Error("Oturum acilamadi.");

      // Rol kontrolü: admin/controller/organizer → yönetim, diğerleri → ana sayfa
      await new Promise(resolve => setTimeout(resolve, 400));
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.session.user.id)
        .limit(1)
        .maybeSingle();

      const role = roleData?.role as string | undefined;
      const hasManagementRole = role === "admin" || role === "controller" || role === "organizer";

      if (activeLoginAttemptRef.current !== attemptId) return;
      setLoading(false);
      window.location.href = hasManagementRole ? "/yonetim" : "/";
      return;
    } catch (err: unknown) {
      if (activeLoginAttemptRef.current !== attemptId) return;
      const message = err && typeof err === 'object' && 'message' in err ? (err as { message?: string }).message : 'Giriş yapılamadı. Lütfen tekrar deneyin.';
      setError(message || 'Giriş yapılamadı. Lütfen tekrar deneyin.');
    } finally {
      if (activeLoginAttemptRef.current === attemptId) {
        setLoading(false);
        activeLoginAttemptRef.current = 0;
      }
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />

      <div className="container mx-auto px-4 py-16">
        <div className="mx-auto max-w-md">
          {/* Geri butonu */}
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-slate-600 hover:text-primary-600 transition-colors mb-8"
          >
            <ArrowLeft className="h-4 w-4" />
            Ana Sayfaya Dön
          </Link>

          {/* Giriş formu */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-slate-900 mb-2">Giriş Yap</h1>
              <p className="text-slate-600">
                Bilet alıcılar, organizatörler, yöneticiler ve kontrolörler buradan giriş yapabilir
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
                  E-posta
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="admin@bilet-ekosistemi.com"
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-2">
                  Şifre
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="•••••••••"
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 pr-12 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-600">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary-600 text-white py-3 rounded-lg font-semibold hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  "Giriş Yapılıyor..."
                ) : (
                  <>
                    <LogIn className="h-5 w-5" />
                    Giriş Yap
                  </>
                )}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-500">
              Hesabınız yok mu?{" "}
              <button
                type="button"
                onClick={() => document.getElementById("uyelik-form")?.scrollIntoView({ behavior: "smooth" })}
                className="text-primary-600 hover:text-primary-700 font-medium"
              >
                Üye olun
              </button>
            </p>
          </div>

          {/* Üye ol (Bilet alıcılar için) */}
          <div id="uyelik-form" className="mt-12 pt-12 border-t border-slate-200">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary-100 text-primary-600 mb-3">
                  <UserPlus className="h-6 w-6" />
                </div>
                <h2 className="text-xl font-bold text-slate-900 mb-2">Üye Ol</h2>
                <p className="text-slate-600 text-sm">
                  Bilet satın almak için ücretsiz hesap oluşturun
                </p>
              </div>

              <form onSubmit={handleRegister} className="space-y-5">
                <div>
                  <label htmlFor="reg-email" className="block text-sm font-medium text-slate-700 mb-2">
                    E-posta
                  </label>
                  <input
                    id="reg-email"
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    required
                    placeholder="ornek@email.com"
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>

                <div>
                  <label htmlFor="reg-password" className="block text-sm font-medium text-slate-700 mb-2">
                    Şifre
                  </label>
                  <div className="relative">
                    <input
                      id="reg-password"
                      type={regShowPassword ? "text" : "password"}
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      required
                      minLength={6}
                      placeholder="En az 6 karakter"
                      className="w-full rounded-lg border border-slate-300 px-4 py-3 pr-12 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                    <button
                      type="button"
                      onClick={() => setRegShowPassword(!regShowPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {regShowPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                {regError && (
                  <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-600">
                    {regError}
                  </div>
                )}

                {regSuccess && (
                  <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700">
                    {regSuccess}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={regLoading}
                  className="w-full bg-primary-600 text-white py-3 rounded-lg font-semibold hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {regLoading ? "Kayıt Yapılıyor..." : (
                    <>
                      <UserPlus className="h-5 w-5" />
                      Üye Ol
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Organizatör Başvurusu */}
          <div className="mt-12 pt-12 border-t border-slate-200">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary-100 text-primary-600 mb-3">
                  <Calendar className="h-6 w-6" />
                </div>
                <h2 className="text-xl font-bold text-slate-900 mb-2">Organizatör Başvurusu</h2>
                <p className="text-slate-600 text-sm">
                  Etkinlik ekleyip yönetmek istiyorsanız aşağıdaki formu doldurarak başvurunuzu yapın. Yönetici onayından sonra etkinlik ekleyebileceksiniz.
                </p>
              </div>

              <form onSubmit={handleOrganizerApply} className="space-y-5">
                <div>
                  <label htmlFor="org-email" className="block text-sm font-medium text-slate-700 mb-2">
                    E-posta
                  </label>
                  <input
                    id="org-email"
                    type="email"
                    value={orgEmail}
                    onChange={(e) => setOrgEmail(e.target.value)}
                    required
                    placeholder="ornek@email.com"
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>

                <div>
                  <label htmlFor="org-password" className="block text-sm font-medium text-slate-700 mb-2">
                    Şifre
                  </label>
                  <div className="relative">
                    <input
                      id="org-password"
                      type={orgShowPassword ? "text" : "password"}
                      value={orgPassword}
                      onChange={(e) => setOrgPassword(e.target.value)}
                      required
                      minLength={6}
                      placeholder="En az 6 karakter"
                      className="w-full rounded-lg border border-slate-300 px-4 py-3 pr-12 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                    <button
                      type="button"
                      onClick={() => setOrgShowPassword(!orgShowPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {orgShowPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                {orgError && (
                  <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-600">
                    {orgError}
                  </div>
                )}

                {orgSuccess && (
                  <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700">
                    {orgSuccess}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={orgLoading}
                  className="w-full bg-slate-800 text-white py-3 rounded-lg font-semibold hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {orgLoading ? (
                    "Başvuru Gönderiliyor..."
                  ) : (
                    <>
                      <UserPlus className="h-5 w-5" />
                      Organizatör Olarak Başvur
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
