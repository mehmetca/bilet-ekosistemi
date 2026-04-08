"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase-ssr";

export default function AuthCallbackPage() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const code = searchParams.get("code");
    const next = searchParams.get("next") ?? "/";

    if (!code) {
      setStatus("error");
      setErrorMsg("Yetkilendirme kodu bulunamadı.");
      return;
    }

    let cancelled = false;

    async function exchangeAndRedirect() {
      try {
        // Cookie-based Supabase client oluştur
        const supabase = createSupabaseBrowserClient();
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (cancelled) return;

        if (error) {
          setStatus("error");
          setErrorMsg(error.message || "Oturum açılamadı.");
          return;
        }

        setStatus("success");

        const userId = data?.user?.id ?? "";
        if (!userId) {
          window.location.href = next.startsWith("/") ? next : `/${next}`;
          return;
        }

        // Rol kontrolü: admin/controller/organizer → yönetim
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .limit(1)
          .maybeSingle();

        const role = roleData?.role as string | undefined;
        const hasManagementRole = role === "admin" || role === "controller" || role === "organizer";

        const redirectTo = next.startsWith("/") ? next : `/${next}`;
        const finalUrl = hasManagementRole && redirectTo === "/" ? "/yonetim" : redirectTo;

        window.location.href = finalUrl;
      } catch (err) {
        if (cancelled) return;
        setStatus("error");
        setErrorMsg(err instanceof Error ? err.message : "Beklenmeyen hata.");
      }
    }

    exchangeAndRedirect();
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
          <p className="mt-4 text-slate-600">Giriş yapılıyor...</p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md w-full bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center">
          <p className="text-red-600 mb-4">{errorMsg}</p>
          <a
            href="/giris"
            className="inline-block px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Giriş sayfasına dön
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
        <p className="mt-4 text-slate-600">Yönlendiriliyorsunuz...</p>
      </div>
    </div>
  );
}
