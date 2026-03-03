"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, LogIn, ArrowLeft } from "lucide-react";
import Header from "@/components/Header";
import { supabase } from "@/lib/supabase-client";

type AuthTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  user?: { email?: string };
  error_description?: string;
  msg?: string;
};

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const activeLoginAttemptRef = useRef(0);

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
        throw new Error(
          payload.error_description || payload.msg || "Giris istegi basarisiz oldu."
        );
      }

      if (!payload.access_token || !payload.refresh_token) {
        throw new Error("Giris yaniti gecersiz. access_token/refresh_token eksik.");
      }

      const { data, error } = await supabase.auth.setSession({
        access_token: payload.access_token,
        refresh_token: payload.refresh_token,
      });
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

      // Başarılı giriş - yönetim paneline yönlendir
      // Supabase session'ın tarayıcıya oturması için çok kısa bir bekleme
      await new Promise(resolve => setTimeout(resolve, 300));

      if (activeLoginAttemptRef.current !== attemptId) return;
      router.replace("/yonetim");
      router.refresh();
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
              <h1 className="text-2xl font-bold text-slate-900 mb-2">Yönetici Girişi</h1>
              <p className="text-slate-600">
                Yönetim paneline erişmek için giriş yapın
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

            <div className="mt-6 p-4 bg-slate-50 rounded-lg">
              <p className="text-sm text-slate-600 text-center">
                <strong>Test Bilgileri:</strong><br />
                E-posta: admin@bilet-ekosistemi.com<br />
                Şifre: admin123
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
