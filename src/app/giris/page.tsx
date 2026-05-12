"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import NextLink from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Eye, EyeOff, LogIn, ArrowLeft, UserPlus } from "lucide-react";
import { Link } from "@/i18n/navigation";
import Header from "@/components/Header";
/** PKCE + çerez: @supabase/ssr createBrowserClient (SimpleAuth’taki `supabase` ile aynı singleton). */
import { createSupabaseBrowserClient } from "@/lib/supabase-browser-client";

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

const PASSWORD_EXISTS_PATTERN = /already registered|already exists/i;
const PASSWORD_VALIDATION_PATTERN = /password|weak|at least \d+ characters/i;


export default function LoginPage() {
  const t = useTranslations("auth");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);
  const activeLoginAttemptRef = useRef(0);

  // Üye ol (bilet alıcı) state – EventSeat akışı
  const [regEmail, setRegEmail] = useState("");
  const [regFirstName, setRegFirstName] = useState("");
  const [regLastName, setRegLastName] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regPasswordConfirm, setRegPasswordConfirm] = useState("");
  const [regShowPassword, setRegShowPassword] = useState(false);
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState("");
  const [regSuccess, setRegSuccess] = useState("");
  const [regGoogleLoading, setRegGoogleLoading] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [agreeMarketing, setAgreeMarketing] = useState(false);
  // Opsiyonel: panel (Bilgilerim) ile uyumlu alanlar
  const [regCountry, setRegCountry] = useState("");
  const [regCity, setRegCity] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regAnrede, setRegAnrede] = useState("");
  const [ctrlFullName, setCtrlFullName] = useState("");
  const [ctrlPhone, setCtrlPhone] = useState("");
  const [ctrlEmail, setCtrlEmail] = useState("");
  const [ctrlPassword, setCtrlPassword] = useState("");
  const [ctrlLoading, setCtrlLoading] = useState(false);
  const [ctrlError, setCtrlError] = useState("");
  const [ctrlSuccess, setCtrlSuccess] = useState("");

  useEffect(() => {
    return () => {
      activeLoginAttemptRef.current = 0;
    };
  }, []);

  useEffect(() => {
    if (searchParams.get("error") !== "oauth") return;
    setError(t("errorOAuthCallback"));
    if (typeof window !== "undefined") {
      const u = new URL(window.location.href);
      u.searchParams.delete("error");
      const qs = u.searchParams.toString();
      window.history.replaceState({}, "", qs ? `${u.pathname}?${qs}` : u.pathname);
    }
  }, [searchParams, t]);

  async function signInWithTimeout(credentials: { email: string; password: string }, timeoutMs = 15000) {
    const sb = createSupabaseBrowserClient();
    const signInPromise = sb.auth.signInWithPassword(credentials);
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(t("errorLoginTimeout"))), timeoutMs)
    );
    const { data, error } = await Promise.race([signInPromise, timeoutPromise]);
    if (error) {
      const rawMsg = error.message || String(error);
      if (/rate limit|too many requests/i.test(rawMsg)) {
        throw new Error(t("errorRateLimited"));
      }
      if (/invalid login credentials|invalid credentials/i.test(rawMsg)) {
        throw new Error(t("errorInvalidCredentials"));
      }
      throw new Error(rawMsg);
    }
    if (!data?.session) throw new Error(t("errorLoginNoSession"));
    // Çerezlerin middleware ile uyumlu yazılması için kısa bekleme (yarış azaltır)
    await sb.auth.getSession();
    return data;
  }

  function validateRegisterPassword(pwd: string): string | null {
    if (pwd.length < 8 || pwd.length > 24) return t("errorPasswordLength");
    if (!/[a-z]/.test(pwd)) return t("errorPasswordLowercase");
    if (!/[A-Z]/.test(pwd)) return t("errorPasswordUppercase");
    return null;
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (regLoading) return;
    setRegError("");
    setRegSuccess("");

    const firstName = regFirstName.trim();
    const lastName = regLastName.trim();
    if (!firstName) {
      setRegError(t("errorFirstNameRequired"));
      return;
    }
    if (!lastName) {
      setRegError(t("errorLastNameRequired"));
      return;
    }
    const pwdErr = validateRegisterPassword(regPassword);
    if (pwdErr) {
      setRegError(pwdErr);
      return;
    }
    if (regPassword !== regPasswordConfirm) {
      setRegError(t("errorPasswordMismatch"));
      return;
    }
    if (!agreeTerms) {
      setRegError(t("errorTermsRequired"));
      return;
    }
    if (!agreePrivacy) {
      setRegError(t("errorPrivacyRequired"));
      return;
    }

    setRegLoading(true);
    try {
      const sb = createSupabaseBrowserClient();
      const { data: signUpData, error: signUpError } = await sb.auth.signUp({
        email: regEmail.trim(),
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

      if (signUpData?.session && signUpData.user) {
        try {
          const { data: { session } } = await sb.auth.getSession();
          if (session?.access_token) {
            await fetch("/api/profile", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({
                email: regEmail.trim(),
                first_name: firstName,
                last_name: lastName,
                country: regCountry.trim() || undefined,
                city: regCity.trim() || undefined,
                telefon: regPhone.trim() || undefined,
                anrede: regAnrede.trim() || undefined,
              }),
            });
          }
        } catch (_) {
          // Profil kaydı başarısız olsa da üyelik tamamlandı
        }
      }

      setRegSuccess(t("successRegistered"));
      setRegEmail("");
      setRegFirstName("");
      setRegLastName("");
      setRegPassword("");
      setRegPasswordConfirm("");
      setRegCountry("");
      setRegCity("");
      setRegPhone("");
      setRegAnrede("");
      setAgreeTerms(false);
      setAgreePrivacy(false);
      setAgreeMarketing(false);
    } catch (err) {
      setRegError(err instanceof Error ? err.message : t("errorGeneric"));
    } finally {
      setRegLoading(false);
    }
  }

  async function handleGoogleSignIn(fromRegistration: boolean) {
    if (googleLoading || regGoogleLoading) return;
    if (fromRegistration) setRegGoogleLoading(true);
    else setGoogleLoading(true);
    setError("");
    setRegError("");

    let leavePage = false;
    try {
      // ?redirect=/tr/sepet gibi gelirse (ödeme öncesi) sepete dön; yoksa üyelik/giriş sonrası panele
      const next =
        redirectTo && redirectTo.startsWith("/") ? redirectTo : `/${locale}/panel`;
      if (typeof window === "undefined" || !window.location.origin) {
        setError(t("errorGeneric"));
        return;
      }
      // PKCE verifier tarayıcı origin'ine bağlıdır; callback de aynı origin'de olmalı.
      const oauthCallback = new URL("/auth/callback", window.location.origin);
      oauthCallback.searchParams.set("next", next);
      oauthCallback.searchParams.set("locale", locale);
      const redirectToUrl = oauthCallback.toString();

      const sb = createSupabaseBrowserClient();
      // PKCE çerez/storage hazır olsun; ilk tıklamada bazen exchange başarısız oluyordu.
      await sb.auth.getSession();

      // Tarayıcıda Google oturumu açıksa OAuth bazen hesap ekranını atlıyor; hesap seçimini göstermek için:
      // https://developers.google.com/identity/protocols/oauth2/openid-connect#authenticationuriparameters
      const { data, error: oauthError } = await sb.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectToUrl,
          queryParams: {
            prompt: "select_account",
            access_type: "offline",
          },
        },
      });

      if (oauthError) {
        setError(oauthError.message || t("errorLoginFailed"));
        setRegError(oauthError.message || t("errorRegisterFailed"));
        return;
      }
      if (data?.url) {
        leavePage = true;
        window.location.assign(data.url);
        return;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("errorGeneric");
      setError(msg);
      setRegError(msg);
    } finally {
      if (!leavePage) {
        setGoogleLoading(false);
        setRegGoogleLoading(false);
      }
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
      if (!data?.session?.user) throw new Error(t("errorSessionOpenFailed"));

      // Rol kontrolü: admin/controller/organizer → yönetim, diğerleri → ana sayfa
      await new Promise(resolve => setTimeout(resolve, 400));
      const sb = createSupabaseBrowserClient();
      const { data: roleData } = await sb
        .from("user_roles")
        .select("role")
        .eq("user_id", data.session.user.id)
        .limit(1)
        .maybeSingle();

      const role = roleData?.role as string | undefined;
      if (!role) {
        const { data: pendingController } = await sb
          .from("controller_requests")
          .select("status")
          .eq("user_id", data.session.user.id)
          .maybeSingle();
        if (pendingController && pendingController.status !== "approved") {
          await sb.auth.signOut({ scope: "local" });
          throw new Error("Kontrolör başvurunuz henüz onaylanmadı.");
        }
      }
      const hasManagementRole = role === "admin" || role === "controller" || role === "organizer";

      if (activeLoginAttemptRef.current !== attemptId) return;
      setLoading(false);
      const afterLogin =
        redirectTo && redirectTo.startsWith("/") ? redirectTo : `/${locale}/panel`;
      const managementTarget =
        redirectTo && redirectTo.startsWith("/") ? redirectTo : "/yonetim";
      window.location.href = hasManagementRole ? managementTarget : afterLogin;
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

  async function handleControllerApply(e: React.FormEvent) {
    e.preventDefault();
    if (ctrlLoading) return;
    setCtrlError("");
    setCtrlSuccess("");
    if (!ctrlFullName.trim() || !ctrlPhone.trim()) {
      setCtrlError("Ad Soyad ve telefon zorunludur.");
      return;
    }
    if (!ctrlEmail.trim() || !ctrlPassword.trim()) {
      setCtrlError("E-posta ve şifre zorunludur.");
      return;
    }

    setCtrlLoading(true);
    try {
      const sb = createSupabaseBrowserClient();
      const { data: signUpData, error: signUpError } = await sb.auth.signUp({
        email: ctrlEmail.trim(),
        password: ctrlPassword,
        options: { emailRedirectTo: undefined },
      });
      if (signUpError) {
        if (PASSWORD_EXISTS_PATTERN.test(signUpError.message || "")) {
          setCtrlError("Bu e-posta zaten kayıtlı. Giriş yapıp admin onayı bekleyin.");
          return;
        }
        setCtrlError(signUpError.message || "Kontrolör başvurusu başlatılamadı.");
        return;
      }

      const {
        data: { session },
      } = await sb.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken || !signUpData.user?.id) {
        setCtrlError("Başvuru için oturum açılamadı. Lütfen tekrar deneyin.");
        return;
      }

      const res = await fetch("/api/controller-request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          full_name: ctrlFullName.trim(),
          phone: ctrlPhone.trim(),
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setCtrlError(payload.error || "Başvuru kaydedilemedi.");
        return;
      }

      await sb.auth.signOut({ scope: "local" });
      setCtrlSuccess("Başvurunuz alındı. Admin onayından sonra giriş yapabilirsiniz.");
      setCtrlFullName("");
      setCtrlPhone("");
      setCtrlEmail("");
      setCtrlPassword("");
    } catch (err) {
      setCtrlError(err instanceof Error ? err.message : "Beklenmeyen hata");
    } finally {
      setCtrlLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />

      <div className="site-container py-16">
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
          <div id="giris-form" className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
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
                  autoComplete="email"
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
                    autoComplete="current-password"
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
                <div className="mt-2 flex justify-end">
                  <NextLink
                    href="/sifre-yenile"
                    className="text-sm font-medium text-primary-600 hover:text-primary-700 hover:underline"
                  >
                    {t("forgotPassword")}
                  </NextLink>
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
                    {t("email")} *
                  </label>
                  <input
                    id="reg-email"
                    type="email"
                    autoComplete="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    required
                    placeholder={t("regEmailPlaceholder")}
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="reg-firstname" className="block text-sm font-medium text-slate-700 mb-2">
                      {t("regFirstNameLabel")} *
                    </label>
                    <input
                      id="reg-firstname"
                      type="text"
                      autoComplete="given-name"
                      value={regFirstName}
                      onChange={(e) => setRegFirstName(e.target.value)}
                      required
                      placeholder={t("regFirstNamePlaceholder")}
                      className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="reg-lastname" className="block text-sm font-medium text-slate-700 mb-2">
                      {t("regLastNameLabel")} *
                    </label>
                    <input
                      id="reg-lastname"
                      type="text"
                      autoComplete="family-name"
                      value={regLastName}
                      onChange={(e) => setRegLastName(e.target.value)}
                      required
                      placeholder={t("regLastNamePlaceholder")}
                      className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="reg-anrede" className="block text-sm font-medium text-slate-700 mb-2">
                    {t("regGenderLabel")}
                  </label>
                  <select
                    id="reg-anrede"
                    autoComplete="honorific-prefix"
                    value={regAnrede}
                    onChange={(e) => setRegAnrede(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="">{t("regGenderUnspecified")}</option>
                    <option value="Herr">{t("regGenderMale")}</option>
                    <option value="Frau">{t("regGenderFemale")}</option>
                    <option value="divers">{t("regGenderDiverse")}</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="reg-phone" className="block text-sm font-medium text-slate-700 mb-2">
                    {t("regPhoneLabel")}
                  </label>
                  <input
                    id="reg-phone"
                    type="tel"
                    autoComplete="tel"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    placeholder={t("regPhonePlaceholder")}
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="reg-country" className="block text-sm font-medium text-slate-700 mb-2">
                      {t("regCountryLabel")}
                    </label>
                    <input
                      id="reg-country"
                      type="text"
                      autoComplete="country-name"
                      value={regCountry}
                      onChange={(e) => setRegCountry(e.target.value)}
                      placeholder={t("regCountryPlaceholder")}
                      className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="reg-city" className="block text-sm font-medium text-slate-700 mb-2">
                      {t("regCityLabel")}
                    </label>
                    <input
                      id="reg-city"
                      type="text"
                      autoComplete="address-level2"
                      value={regCity}
                      onChange={(e) => setRegCity(e.target.value)}
                      placeholder={t("regCityPlaceholder")}
                      className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="reg-password" className="block text-sm font-medium text-slate-700 mb-2">
                    {t("password")} *
                  </label>
                  <div className="relative">
                    <input
                      id="reg-password"
                      type={regShowPassword ? "text" : "password"}
                      autoComplete="new-password"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      required
                      minLength={8}
                      maxLength={24}
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
                  <p className="mt-2 text-xs text-slate-600">
                    {t("regPasswordRulesTitle")}
                  </p>
                  <ul className="mt-1 text-xs text-slate-500 list-disc list-inside space-y-0.5">
                    <li>{t("regPasswordRuleNoPersonalInfo")}</li>
                    <li>{t("regPasswordRuleUpperLower")}</li>
                    <li>{t("regPasswordRuleLength")}</li>
                  </ul>
                </div>

                <div>
                  <label htmlFor="reg-password-confirm" className="block text-sm font-medium text-slate-700 mb-2">
                    {t("regPasswordConfirmLabel")} *
                  </label>
                  <input
                    id="reg-password-confirm"
                    type={regShowPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={regPasswordConfirm}
                    onChange={(e) => setRegPasswordConfirm(e.target.value)}
                    required
                    minLength={8}
                    maxLength={24}
                    placeholder={t("regPasswordConfirmPlaceholder")}
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>

                <div className="space-y-3 pt-2">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={agreeTerms}
                      onChange={(e) => setAgreeTerms(e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-slate-700">
                      <Link href="/bilgilendirme/kullanim-kosullari" className="text-primary-600 hover:underline">{t("regTermsLinkText")}</Link> {t("regTermsSuffix")}
                    </span>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={agreePrivacy}
                      onChange={(e) => setAgreePrivacy(e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-slate-700">
                      {t("regPrivacyPrefix")} <Link href="/bilgilendirme/cerez-politikasi" className="text-primary-600 hover:underline">{t("regPrivacyLinkText")}</Link> {t("regPrivacySuffix")}
                    </span>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={agreeMarketing}
                      onChange={(e) => setAgreeMarketing(e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-slate-700">
                      {t("regMarketingConsent")}
                    </span>
                  </label>
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

                <p className="text-sm text-slate-600 text-center">
                  {t("hasAccount")}{" "}
                  <button
                    type="button"
                    onClick={() => document.getElementById("giris-form")?.scrollIntoView({ behavior: "smooth" })}
                    className="text-primary-600 hover:text-primary-700 font-medium"
                  >
                    {t("loginCta")}
                  </button>
                </p>

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

          <div className="mt-12 pt-12 border-t border-slate-200">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
              <div className="text-center mb-6">
                <h2 className="text-xl font-bold text-slate-900 mb-2">Kontrolör Başvurusu</h2>
                <p className="text-slate-600 text-sm">
                  Bilet kontrol ekibi için başvuru formu. Admin onayı olmadan giriş yapılamaz.
                </p>
              </div>
              <form onSubmit={handleControllerApply} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Ad Soyad *</label>
                  <input
                    type="text"
                    value={ctrlFullName}
                    onChange={(e) => setCtrlFullName(e.target.value)}
                    required
                    className="w-full rounded-lg border border-slate-300 px-4 py-3"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Telefon *</label>
                  <input
                    type="tel"
                    value={ctrlPhone}
                    onChange={(e) => setCtrlPhone(e.target.value)}
                    required
                    className="w-full rounded-lg border border-slate-300 px-4 py-3"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">E-posta *</label>
                  <input
                    type="email"
                    value={ctrlEmail}
                    onChange={(e) => setCtrlEmail(e.target.value)}
                    required
                    className="w-full rounded-lg border border-slate-300 px-4 py-3"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Şifre *</label>
                  <input
                    type="password"
                    value={ctrlPassword}
                    onChange={(e) => setCtrlPassword(e.target.value)}
                    required
                    minLength={8}
                    className="w-full rounded-lg border border-slate-300 px-4 py-3"
                  />
                </div>
                {ctrlError && <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-600">{ctrlError}</div>}
                {ctrlSuccess && <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700">{ctrlSuccess}</div>}
                <button
                  type="submit"
                  disabled={ctrlLoading}
                  className="w-full bg-slate-900 text-white py-3 rounded-lg font-semibold hover:bg-slate-800 disabled:opacity-50"
                >
                  {ctrlLoading ? "Gönderiliyor..." : "Kontrolör Başvurusu Gönder"}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
