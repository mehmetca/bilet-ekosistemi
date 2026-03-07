"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import NextLink from "next/link";
import { Link } from "@/i18n/navigation";
import { Eye, EyeOff, LogIn, ArrowLeft, Calendar, UserPlus } from "lucide-react";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="20" height="20">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}
import { useTranslations } from "next-intl";
import Header from "@/components/Header";
import { supabase } from "@/lib/supabase-client";

const PASSWORD_EXISTS_PATTERN = /already registered|already exists/i;
const PASSWORD_VALIDATION_PATTERN = /password|weak|at least \d+ characters/i;


type AuthTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  user?: { email?: string };
  error_description?: string;
  msg?: string;
};

export default function LoginPage() {
  const t = useTranslations("auth");
  const tCommon = useTranslations("common");
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);
  const activeLoginAttemptRef = useRef(0);

  // Üye ol (bilet alıcı) state
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regShowPassword, setRegShowPassword] = useState(false);
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState("");
  const [regSuccess, setRegSuccess] = useState("");
  const [regGoogleLoading, setRegGoogleLoading] = useState(false);

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
          throw new Error(t("errorInvalidCredentials"));
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
          setRegError(t("errorEmailExists"));
        } else if (PASSWORD_VALIDATION_PATTERN.test(signUpError.message || "")) {
          setRegError(t("passwordRequirements"));
        } else {
          setRegError(signUpError.message || t("errorRegisterFailed"));
        }
        return;
      }

      setRegSuccess(t("successRegistered"));
      setRegEmail("");
      setRegPassword("");
    } catch (err) {
      setRegError(err instanceof Error ? err.message : t("errorGeneric"));
    } finally {
      setRegLoading(false);
    }
  }

  async function handleGoogleSignIn(isSignUp = false) {
    if (googleLoading || regGoogleLoading) return;
    if (isSignUp) setRegGoogleLoading(true);
    else setGoogleLoading(true);
    setError("");
    setRegError("");

    try {
      const next = redirectTo || "/";
      const redirectToUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/auth/callback?next=${encodeURIComponent(next)}`;

      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: redirectToUrl },
      });

      if (oauthError) {
        setError(oauthError.message || t("errorLoginFailed"));
        setRegError(oauthError.message || t("errorRegisterFailed"));
        return;
      }
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("errorGeneric");
      setError(msg);
      setRegError(msg);
    } finally {
      setGoogleLoading(false);
      setRegGoogleLoading(false);
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
      window.location.href = hasManagementRole ? "/yonetim" : (redirectTo || "/");
      return;
    } catch (err: unknown) {
      if (activeLoginAttemptRef.current !== attemptId) return;
      const message = err && typeof err === 'object' && 'message' in err ? (err as { message?: string }).message : t("errorLoginFailed");
      setError(message || t("errorLoginFailed"));
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
            {tCommon("backToHome")}
          </Link>

          {/* Giriş formu */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-slate-900 mb-2">{t("loginTitle")}</h1>
              <p className="text-slate-600">
                {t("loginSubtitle")}
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
                  {t("email")}
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder={t("emailPlaceholder")}
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-2">
                  {t("password")}
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder={t("passwordPlaceholder")}
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
                  t("loggingIn")
                ) : (
                  <>
                    <LogIn className="h-5 w-5" />
                    {t("login")}
                  </>
                )}
              </button>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="bg-white px-3 text-slate-500">{t("or")}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleGoogleSignIn(false)}
                disabled={googleLoading}
                className="w-full flex items-center justify-center gap-3 py-3 rounded-lg border border-slate-300 bg-white text-slate-700 font-medium hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <GoogleIcon />
                {googleLoading ? t("loggingIn") : t("loginWithGoogle")}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-500">
              {t("noAccount")}{" "}
              <button
                type="button"
                onClick={() => document.getElementById("uyelik-form")?.scrollIntoView({ behavior: "smooth" })}
                className="text-primary-600 hover:text-primary-700 font-medium"
              >
                {t("signUpLink")}
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
                <h2 className="text-xl font-bold text-slate-900 mb-2">{t("signUpTitle")}</h2>
                <p className="text-slate-600 text-sm">
                  {t("signUpSubtitle")}
                </p>
              </div>

              <form onSubmit={handleRegister} className="space-y-5">
                <div>
                  <label htmlFor="reg-email" className="block text-sm font-medium text-slate-700 mb-2">
                    {t("email")}
                  </label>
                  <input
                    id="reg-email"
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    required
                    placeholder={t("regEmailPlaceholder")}
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>

                <div>
                  <label htmlFor="reg-password" className="block text-sm font-medium text-slate-700 mb-2">
                    {t("password")}
                  </label>
                  <div className="relative">
                    <input
                      id="reg-password"
                      type={regShowPassword ? "text" : "password"}
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      required
                      minLength={6}
                      placeholder={t("regPasswordPlaceholder")}
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
                  {regLoading ? t("registering") : (
                    <>
                      <UserPlus className="h-5 w-5" />
                      {t("signUp")}
                    </>
                  )}
                </button>

                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="bg-white px-3 text-slate-500">{t("or")}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleGoogleSignIn(true)}
                  disabled={regGoogleLoading}
                  className="w-full flex items-center justify-center gap-3 py-3 rounded-lg border border-slate-300 bg-white text-slate-700 font-medium hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <GoogleIcon />
                  {regGoogleLoading ? t("registering") : t("signUpWithGoogle")}
                </button>
              </form>
            </div>
          </div>

          {/* Organizatör Başvurusu linki */}
          <div className="mt-12 pt-12 border-t border-slate-200 text-center">
            <p className="text-slate-600 text-sm mb-3">
              Etkinlik ekleyip bilet satmak mı istiyorsunuz?
            </p>
            <NextLink
              href="/organizator-basvuru"
              className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 font-semibold"
            >
              <Calendar className="h-5 w-5" />
              Organizatör Başvuru Formu
            </NextLink>
          </div>
        </div>
      </div>
    </div>
  );
}
