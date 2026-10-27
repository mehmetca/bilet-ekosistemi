"use client";

/**
 * Şifre sıfırlama (unuttum): E-posta ile link gönderilir, link tıklanınca bu sayfada yeni şifre belirlenir.
 * Supabase Dashboard → Authentication → URL Configuration → Redirect URLs listesine
 * https://your-domain.com/tr/sifre-yenile (veya /sifre-yenile; middleware locale ekler) ve localhost ekleyin.
 */
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import NextLink from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeft, Mail, Lock, Eye, EyeOff, CheckCircle } from "lucide-react";
import { supabase } from "@/lib/supabase-client";
import Header from "@/components/Header";
import { formatSupabaseAuthErrorMessage } from "@/lib/supabase-auth-errors";

type Step = "email" | "sending" | "sent" | "set_password" | "updating" | "done";
const APP_LOCALES = new Set(["tr", "de", "en", "ku", "ckb"]);

function formatAuthUserMessage(err: unknown, rateLimitedMessage: string): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/rate limit|too many requests/i.test(msg)) {
    return rateLimitedMessage;
  }
  return formatSupabaseAuthErrorMessage(msg);
}

function resolveLocaleFromPath(pathname: string): string {
  const firstSegment = pathname.split("/").filter(Boolean)[0] || "";
  return APP_LOCALES.has(firstSegment) ? firstSegment : "tr";
}

export default function SifreYenilePage() {
  const t = useTranslations("passwordReset");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [recoveryChecked, setRecoveryChecked] = useState(false);
  const [linkExpired, setLinkExpired] = useState(false);

  useEffect(() => {
    let mounted = true;

    const urlError = searchParams.get("error") || searchParams.get("error_code");
    const desc = searchParams.get("error_description");
    if (urlError && (urlError === "access_denied" || urlError === "otp_expired" || desc?.toLowerCase().includes("expired") || desc?.toLowerCase().includes("invalid"))) {
      setLinkExpired(true);
      if (typeof window !== "undefined") {
        window.history.replaceState({}, "", window.location.pathname);
      }
    }

    async function checkRecoverySession() {
      const code = searchParams.get("code");
      if (code) {
        let exchangeFailed = false;
        try {
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (!mounted) return;
          if (!exchangeError && data?.session) {
            setStep("set_password");
            setRecoveryChecked(true);
            return;
          }
          exchangeFailed = Boolean(exchangeError);
        } catch {
          exchangeFailed = true;
        }

        // PKCE kodunu Supabase istemcisi URL'den otomatik tüketmiş olabilir;
        // bu durumda oturum zaten kuruludur, kodu ikinci kez değiş tokuş etme.
        // Otomatik değiş tokuş bizden birkaç yüz ms sonra bitebildiği için kısa süre bekle.
        if (exchangeFailed) {
          for (let attempt = 0; attempt < 4; attempt += 1) {
            const { data: sessionData } = await supabase.auth.getSession();
            if (!mounted) return;
            if (sessionData.session?.user) {
              setStep("set_password");
              break;
            }
            await new Promise((resolve) => setTimeout(resolve, 300));
          }
        }
        setRecoveryChecked(true);
        return;
      }

      const tokenHash = searchParams.get("token_hash");
      const tokenType = searchParams.get("type");
      if (tokenHash && tokenType === "recovery") {
        const { data, error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: "recovery",
        });
        if (!mounted) return;
        if (!verifyError && data?.session) {
          setStep("set_password");
          setRecoveryChecked(true);
          return;
        }
      }

      if (typeof window !== "undefined" && window.location.hash) {
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const hashType = hashParams.get("type");
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        if (hashType === "recovery" && accessToken && refreshToken) {
          const { data, error: setSessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (!mounted) return;
          if (!setSessionError && data?.session) {
            setStep("set_password");
            window.history.replaceState({}, "", `${window.location.pathname}${window.location.search}`);
            setRecoveryChecked(true);
            return;
          }
        }
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (mounted && session?.user) {
        setStep("set_password");
      }
      setRecoveryChecked(true);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === "PASSWORD_RECOVERY" && session) {
        setStep("set_password");
      }
    });

    checkRecoverySession();
    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, [searchParams]);

  async function handleRequestReset(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const trimmed = email.trim();
    if (!trimmed) {
      setError(t("errorEmailRequired"));
      return;
    }
    setStep("sending");
    try {
      const res = await fetch("/api/sifre-sifirlama/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, locale: resolveLocaleFromPath(window.location.pathname) }),
      });
      if (res.status === 429) {
        throw new Error(t("errorRateLimited"));
      }
      const json = (await res.json().catch(() => null)) as { success?: boolean } | null;
      if (!res.ok || !json?.success) {
        throw new Error(t("errorSendFailed"));
      }
      setStep("sent");
    } catch (err) {
      setStep("email");
      setError(formatAuthUserMessage(err, t("errorRateLimited")) || t("errorSendFailed"));
    }
  }

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!password || !passwordConfirm) {
      setError(t("errorPasswordRequired"));
      return;
    }
    if (password.length < 6) {
      setError(t("errorTooShort"));
      return;
    }
    if (password !== passwordConfirm) {
      setError(t("errorMismatch"));
      return;
    }
    setStep("updating");
    try {
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) throw err;
      setStep("done");
      setTimeout(() => router.push("/giris?message=sifre-guncellendi"), 2000);
    } catch (err) {
      setStep("set_password");
      setError(formatAuthUserMessage(err, t("errorRateLimited")) || t("errorUpdateFailed"));
    }
  }

  if (!recoveryChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ink-50">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-gold-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper">
      <Header />
      <main className="max-w-md mx-auto px-4 py-12">
        <NextLink
          href="/giris"
          className="inline-flex items-center gap-2 text-ink-600 hover:text-ink-900 mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("backToLogin")}
        </NextLink>

        <div className="bg-white rounded-lg border border-ink-200 shadow-card p-8">
          <h1 className="text-xl font-bold text-ink-900 mb-2">{t("title")}</h1>

          {(step === "email" || step === "sending") && (
            <>
              {linkExpired && (
                <div className="mb-6 rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
                  <p className="font-medium mb-1">{t("expiredTitle")}</p>
                  <p>{t("expiredBody")}</p>
                </div>
              )}
              <p className="text-ink-600 text-sm mb-6">{t("intro")}</p>
              <form onSubmit={handleRequestReset} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-ink-700 mb-2">
                    {t("emailLabel")}
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-ink-400" />
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t("emailPlaceholder")}
                      className="w-full rounded-lg border border-ink-300 pl-10 pr-4 py-3 text-ink-900 focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-gold-500"
                    />
                  </div>
                </div>
                {error && (
                  <p className="whitespace-pre-line text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={step === "sending"}
                  className="w-full bg-gold-500 text-white py-3 rounded-lg font-semibold hover:bg-gold-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {step === "sending" ? t("submitting") : t("submitCta")}
                </button>
              </form>
            </>
          )}

          {step === "sent" && (
            <div className="py-4">
              <CheckCircle className="h-14 w-14 text-green-500 mx-auto mb-4" />
              <p className="text-ink-700 font-medium mb-2 text-center">{t("sentTitle")}</p>
              <p className="text-ink-600 text-sm mb-4">
                {t.rich("sentBody", { email, b: (chunks) => <strong>{chunks}</strong> })}
              </p>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => { setStep("email"); setEmail(""); setError(""); }}
                  className="text-gold-700 hover:text-gold-700 font-medium text-sm"
                >
                  {t("retryDifferent")}
                </button>
              </div>
            </div>
          )}

          {(step === "set_password" || step === "updating") && (
            <>
              <p className="text-ink-600 text-sm mb-6">{t("newPasswordIntro")}</p>
              <form onSubmit={handleSetPassword} className="space-y-4">
                <div>
                  <label htmlFor="new-password" className="block text-sm font-medium text-ink-700 mb-2">
                    {t("newPasswordLabel")}
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-ink-400" />
                    <input
                      id="new-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      minLength={6}
                      placeholder="••••••••"
                      className="w-full rounded-lg border border-ink-300 pl-10 pr-12 py-3 text-ink-900 focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-gold-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label htmlFor="new-password-confirm" className="block text-sm font-medium text-ink-700 mb-2">
                    {t("newPasswordConfirmLabel")}
                  </label>
                  <input
                    id="new-password-confirm"
                    type="password"
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-lg border border-ink-300 px-4 py-3 text-ink-900 focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-gold-500"
                  />
                </div>
                {error && (
                  <p className="whitespace-pre-line text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={step === "updating"}
                  className="w-full bg-gold-500 text-white py-3 rounded-lg font-semibold hover:bg-gold-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {step === "updating" ? t("updating") : t("updateCta")}
                </button>
              </form>
            </>
          )}

          {step === "done" && (
            <div className="text-center py-4">
              <CheckCircle className="h-14 w-14 text-green-500 mx-auto mb-4" />
              <p className="text-ink-700 font-medium mb-2">{t("doneTitle")}</p>
              <p className="text-ink-600 text-sm">{t("doneBody")}</p>
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
