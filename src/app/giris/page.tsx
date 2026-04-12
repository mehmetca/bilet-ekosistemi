"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import NextLink from "next/link";
import { Link } from "@/i18n/navigation";
import { Eye, EyeOff, LogIn, ArrowLeft, UserPlus } from "lucide-react";

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
import { useLocale, useTranslations } from "next-intl";
import Header from "@/components/Header";
/** PKCE + çerez: @supabase/ssr createBrowserClient (SimpleAuth’taki `supabase` ile aynı singleton). */
import { createSupabaseBrowserClient } from "@/lib/supabase-browser-client";

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

  // Üye ol (bilet alıcı) state – Biletinial tarzı
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

      const sb = createSupabaseBrowserClient();
      const setSessionPromise = sb.auth.setSession({
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

  function validateRegisterPassword(pwd: string): string | null {
    if (pwd.length < 8 || pwd.length > 24) return "Şifre 8–24 karakter uzunluğunda olmalıdır.";
    if (!/[a-z]/.test(pwd)) return "Şifre en az bir küçük harf (a-z) içermelidir.";
    if (!/[A-Z]/.test(pwd)) return "Şifre en az bir büyük harf (A-Z) içermelidir.";
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
      setRegError("Ad zorunludur.");
      return;
    }
    if (!lastName) {
      setRegError("Soyad zorunludur.");
      return;
    }
    const pwdErr = validateRegisterPassword(regPassword);
    if (pwdErr) {
      setRegError(pwdErr);
      return;
    }
    if (regPassword !== regPasswordConfirm) {
      setRegError("Şifreler eşleşmiyor.");
      return;
    }
    if (!agreeTerms) {
      setRegError("Üyelik sözleşmesini kabul etmeniz gerekiyor.");
      return;
    }
    if (!agreePrivacy) {
      setRegError("Gizlilik ve veri koruma aydınlatma metnini kabul etmeniz gerekiyor.");
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
      const oauthCallback = new URL("/auth/callback", window.location.origin);
      oauthCallback.searchParams.set("next", next);
      const redirectToUrl = oauthCallback.toString();

      const sb = createSupabaseBrowserClient();
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
      if (!data?.session?.user) throw new Error("Oturum acilamadi.");

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
      const hasManagementRole = role === "admin" || role === "controller" || role === "organizer";

      if (activeLoginAttemptRef.current !== attemptId) return;
      setLoading(false);
      const afterLogin =
        redirectTo && redirectTo.startsWith("/") ? redirectTo : `/${locale}/panel`;
      window.location.href = hasManagementRole ? "/yonetim" : afterLogin;
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
                      Ad *
                    </label>
                    <input
                      id="reg-firstname"
                      type="text"
                      value={regFirstName}
                      onChange={(e) => setRegFirstName(e.target.value)}
                      required
                      placeholder="Adınız"
                      className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="reg-lastname" className="block text-sm font-medium text-slate-700 mb-2">
                      Soyad *
                    </label>
                    <input
                      id="reg-lastname"
                      type="text"
                      value={regLastName}
                      onChange={(e) => setRegLastName(e.target.value)}
                      required
                      placeholder="Soyadınız"
                      className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="reg-anrede" className="block text-sm font-medium text-slate-700 mb-2">
                    Cinsiyet (isteğe bağlı)
                  </label>
                  <select
                    id="reg-anrede"
                    value={regAnrede}
                    onChange={(e) => setRegAnrede(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="">Belirtmek istemiyorum</option>
                    <option value="Herr">Erkek</option>
                    <option value="Frau">Kadın</option>
                    <option value="divers">Divers</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="reg-phone" className="block text-sm font-medium text-slate-700 mb-2">
                    Telefon (isteğe bağlı)
                  </label>
                  <input
                    id="reg-phone"
                    type="tel"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    placeholder="Örn. +49 123 456789"
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="reg-country" className="block text-sm font-medium text-slate-700 mb-2">
                      Ülke (isteğe bağlı)
                    </label>
                    <input
                      id="reg-country"
                      type="text"
                      value={regCountry}
                      onChange={(e) => setRegCountry(e.target.value)}
                      placeholder="Örn. Almanya, Türkiye"
                      className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="reg-city" className="block text-sm font-medium text-slate-700 mb-2">
                      Şehir (isteğe bağlı)
                    </label>
                    <input
                      id="reg-city"
                      type="text"
                      value={regCity}
                      onChange={(e) => setRegCity(e.target.value)}
                      placeholder="Şehir"
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
                    Şu koşulları sağlayan bir şifre oluşturun:
                  </p>
                  <ul className="mt-1 text-xs text-slate-500 list-disc list-inside space-y-0.5">
                    <li>Parolanızda kişisel bilgilerinizi (adınız, doğum tarihiniz, adresiniz) kullanmayın.</li>
                    <li>Küçük harf (a-z) ve büyük harf (A-Z) içermelidir.</li>
                    <li>8–24 karakter uzunluğunda olmalıdır.</li>
                  </ul>
                </div>

                <div>
                  <label htmlFor="reg-password-confirm" className="block text-sm font-medium text-slate-700 mb-2">
                    Şifre Tekrar *
                  </label>
                  <input
                    id="reg-password-confirm"
                    type={regShowPassword ? "text" : "password"}
                    value={regPasswordConfirm}
                    onChange={(e) => setRegPasswordConfirm(e.target.value)}
                    required
                    minLength={8}
                    maxLength={24}
                    placeholder="Şifrenizi tekrar girin"
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
                      <Link href="/bilgilendirme/kullanim-kosullari" className="text-primary-600 hover:underline">Üyelik sözleşmesini</Link> okudum ve kabul ediyorum. *
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
                      Üyelik işlemlerine yönelik <Link href="/bilgilendirme/cerez-politikasi" className="text-primary-600 hover:underline">aydınlatma metnini</Link> (veri koruma / DSGVO) okudum ve anladım. *
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
                      Ticari elektronik ileti gönderimine ilişkin aydınlatma metnini okudum; tarafıma reklam amaçlı e-posta gönderilmesini kabul ediyorum. (İsteğe bağlı)
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
                  Üyeliğiniz var mı?{" "}
                  <button
                    type="button"
                    onClick={() => document.getElementById("giris-form")?.scrollIntoView({ behavior: "smooth" })}
                    className="text-primary-600 hover:text-primary-700 font-medium"
                  >
                    Giriş Yap
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
        </div>
      </div>
    </div>
  );
}
