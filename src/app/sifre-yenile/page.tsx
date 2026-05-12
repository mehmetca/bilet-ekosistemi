"use client";

/**
 * Şifre sıfırlama (unuttum): E-posta ile link gönderilir, link tıklanınca bu sayfada yeni şifre belirlenir.
 * Supabase Dashboard → Authentication → URL Configuration → Redirect URLs listesine
 * https://your-domain.com/tr/sifre-yenile (veya /sifre-yenile; middleware locale ekler) ve localhost ekleyin.
 */
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import NextLink from "next/link";
import { ArrowLeft, Mail, Lock, Eye, EyeOff, CheckCircle } from "lucide-react";
import { supabase } from "@/lib/supabase-client";
import Header from "@/components/Header";

type Step = "email" | "sending" | "sent" | "set_password" | "updating" | "done";
const APP_LOCALES = new Set(["tr", "de", "en", "ku", "ckb"]);

function formatAuthUserMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/rate limit|too many requests/i.test(msg)) {
    return "Çok sık şifre sıfırlama isteği gönderildi. Lütfen birkaç dakika bekleyip tekrar deneyin.";
  }
  return msg;
}

function resolveLocaleFromPath(pathname: string): string {
  const firstSegment = pathname.split("/").filter(Boolean)[0] || "";
  return APP_LOCALES.has(firstSegment) ? firstSegment : "tr";
}

export default function SifreYenilePage() {
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
        const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (!mounted) return;
        if (!exchangeError && data?.session) {
          setStep("set_password");
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
      setError("E-posta adresi girin.");
      return;
    }
    setStep("sending");
    try {
      const redirectTo =
        typeof window !== "undefined"
          ? (() => {
              const locale = resolveLocaleFromPath(window.location.pathname);
              const callbackUrl = new URL("/auth/callback", window.location.origin);
              callbackUrl.searchParams.set("next", `/${locale}/sifre-yenile`);
              callbackUrl.searchParams.set("locale", locale);
              return callbackUrl.toString();
            })()
          : "";
      const { error: err } = await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo,
      });
      if (err) throw err;
      setStep("sent");
    } catch (err) {
      setStep("email");
      setError(formatAuthUserMessage(err) || "E-posta gönderilemedi. Lütfen tekrar deneyin.");
    }
  }

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!password || !passwordConfirm) {
      setError("Yeni şifre ve tekrarı girin.");
      return;
    }
    if (password.length < 6) {
      setError("Şifre en az 6 karakter olmalıdır.");
      return;
    }
    if (password !== passwordConfirm) {
      setError("Şifreler eşleşmiyor.");
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
      setError(formatAuthUserMessage(err) || "Şifre güncellenemedi.");
    }
  }

  if (!recoveryChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="max-w-md mx-auto px-4 py-12">
        <NextLink
          href="/giris"
          className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          Giriş sayfasına dön
        </NextLink>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
          <h1 className="text-xl font-bold text-slate-900 mb-2">Şifre sıfırlama</h1>

          {(step === "email" || step === "sending") && (
            <>
              {linkExpired && (
                <div className="mb-6 rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
                  <p className="font-medium mb-1">Bağlantı geçersiz veya süresi dolmuş</p>
                  <p>
                    E-postadaki link tek seferlik kullanım içindir ve belirli bir süre sonra geçersiz olur.
                    Lütfen aşağıdan tekrar şifre sıfırlama talebi gönderin.
                  </p>
                </div>
              )}
              <p className="text-slate-600 text-sm mb-6">
                Kayıtlı e-posta adresinizi girin. Size şifre sıfırlama bağlantısı göndereceğiz.
              </p>
              <form onSubmit={handleRequestReset} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
                    E-posta
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="ornek@email.com"
                      className="w-full rounded-lg border border-slate-300 pl-10 pr-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                </div>
                {error && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={step === "sending"}
                  className="w-full bg-primary-600 text-white py-3 rounded-lg font-semibold hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {step === "sending" ? "Gönderiliyor..." : "Sıfırlama bağlantısı gönder"}
                </button>
              </form>
            </>
          )}

          {step === "sent" && (
            <div className="py-4">
              <CheckCircle className="h-14 w-14 text-green-500 mx-auto mb-4" />
              <p className="text-slate-700 font-medium mb-2 text-center">E-posta gönderildi</p>
              <p className="text-slate-600 text-sm mb-4">
                <strong>{email}</strong> adresine şifre sıfırlama bağlantısı gönderdik. E-postayı
                kontrol edin ve bağlantıya tıklayın. Gelen kutusunda göremiyorsanız spam klasörüne
                bakın.
              </p>

              <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 text-sm text-slate-700 mb-6">
                <p className="font-medium text-slate-800 mb-2">KurdEvents</p>
                <p className="mb-2">
                  Bu e-posta, KurdEvents hesabınız için şifre sıfırlama talebiniz üzerine gönderilmiştir.
                  E-postadaki bağlantıya tıklayarak yeni şifrenizi belirleyebilirsiniz.
                </p>
                <p className="text-slate-600">
                  <strong>Bu talebi siz yapmadıysanız</strong> e-postaya cevap vermeniz gerekmez;
                  bağlantıyı kullanmadığınız sürece şifreniz değişmeyecektir. Hesabınızdan şüphelenirseniz
                  giriş yapıp şifrenizi bilgilerim sayfasından değiştirebilirsiniz.
                </p>
              </div>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => { setStep("email"); setEmail(""); setError(""); }}
                  className="text-primary-600 hover:text-primary-700 font-medium text-sm"
                >
                  Farklı e-posta ile tekrar dene
                </button>
              </div>
            </div>
          )}

          {(step === "set_password" || step === "updating") && (
            <>
              <p className="text-slate-600 text-sm mb-6">
                Yeni şifrenizi belirleyin (en az 6 karakter).
              </p>
              <form onSubmit={handleSetPassword} className="space-y-4">
                <div>
                  <label htmlFor="new-password" className="block text-sm font-medium text-slate-700 mb-2">
                    Yeni şifre
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <input
                      id="new-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      minLength={6}
                      placeholder="••••••••"
                      className="w-full rounded-lg border border-slate-300 pl-10 pr-12 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label htmlFor="new-password-confirm" className="block text-sm font-medium text-slate-700 mb-2">
                    Yeni şifre (tekrar)
                  </label>
                  <input
                    id="new-password-confirm"
                    type="password"
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                {error && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={step === "updating"}
                  className="w-full bg-primary-600 text-white py-3 rounded-lg font-semibold hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {step === "updating" ? "Güncelleniyor..." : "Şifreyi güncelle"}
                </button>
              </form>
            </>
          )}

          {step === "done" && (
            <div className="text-center py-4">
              <CheckCircle className="h-14 w-14 text-green-500 mx-auto mb-4" />
              <p className="text-slate-700 font-medium mb-2">Şifreniz güncellendi</p>
              <p className="text-slate-600 text-sm">Giriş sayfasına yönlendiriliyorsunuz...</p>
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
