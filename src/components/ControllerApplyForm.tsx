"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser-client";

const ACCOUNT_EXISTS_PATTERN = /already registered|already exists/i;

/** Kontrolör olmak isteyen personel için başvuru: hesap açar, onay kuyruğuna yazar, oturumu kapatır. */
export default function ControllerApplyForm() {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError("");
    setSuccess("");
    if (!fullName.trim() || !phone.trim()) {
      setError("Ad Soyad ve telefon zorunludur.");
      return;
    }
    if (!email.trim() || !password.trim()) {
      setError("E-posta ve şifre zorunludur.");
      return;
    }

    setLoading(true);
    try {
      const sb = createSupabaseBrowserClient();
      const { data: signUpData, error: signUpError } = await sb.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: undefined },
      });
      if (signUpError) {
        if (ACCOUNT_EXISTS_PATTERN.test(signUpError.message || "")) {
          setError("Bu e-posta zaten kayıtlı. Giriş yapıp admin onayı bekleyin.");
          return;
        }
        setError(signUpError.message || "Kontrolör başvurusu başlatılamadı.");
        return;
      }

      const {
        data: { session },
      } = await sb.auth.getSession();
      if (!session?.access_token || !signUpData.user?.id) {
        setError("Başvuru için oturum açılamadı. Lütfen tekrar deneyin.");
        return;
      }

      const res = await fetch("/api/controller-request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ full_name: fullName.trim(), phone: phone.trim() }),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(payload.error || "Başvuru kaydedilemedi.");
        return;
      }

      await sb.auth.signOut({ scope: "local" });
      setSuccess("Başvurunuz alındı. Admin onayından sonra giriş yapabilirsiniz.");
      setFullName("");
      setPhone("");
      setEmail("");
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Beklenmeyen hata");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 text-left">
      <h2 className="mb-1 text-lg font-bold text-slate-900">Kontrolör Başvurusu</h2>
      <p className="mb-5 text-sm text-slate-600">
        Kendi kontrolörünüzü kendiniz tanımlayamıyorsanız bu formu doldurun; admin onayından sonra
        yetkili hesabınızla giriş yapabilirsiniz.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">Ad Soyad *</label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">Telefon *</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">E-posta *</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">Şifre *</label>
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
          />
        </div>
        {error ? <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</p> : null}
        {success ? (
          <p className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">{success}</p>
        ) : null}
        <button
          type="submit"
          disabled={loading}
          className="min-h-[48px] w-full rounded-lg bg-primary-600 px-4 font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
        >
          {loading ? "Gönderiliyor..." : "Kontrolör Başvurusu Gönder"}
        </button>
      </form>
    </div>
  );
}
