"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";
import AuthRedirectingScreen from "@/components/AuthRedirectingScreen";

interface AdminOnlyGuardProps {
  children: React.ReactNode;
}

/**
 * Sadece YÖNETİCİ (admin) rolüne sahip kullanıcıların erişebileceği sayfaları korur.
 * Kontrolör ve Organizatör bu sayfalara erişemez.
 */
export default function AdminOnlyGuard({ children }: AdminOnlyGuardProps) {
  const { user, loading, isAdmin } = useSimpleAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading || user) return;
    void router.replace("/giris");
    const id = window.setTimeout(() => {
      if (!window.location.pathname.startsWith("/giris")) {
        window.location.assign(`${window.location.origin}/giris`);
      }
    }, 2000);
    return () => window.clearTimeout(id);
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-500">Yükleniyor...</div>
      </div>
    );
  }

  if (!user) {
    return <AuthRedirectingScreen />;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 max-w-md text-center">
          <h1 className="text-xl font-semibold text-slate-900 mb-2">Bu sayfaya erişim yetkiniz yok</h1>
          <p className="text-slate-600 mb-6">
            Bu sayfa sadece yönetici yetkisine sahip hesaplar tarafından erişilebilir.
          </p>
          <Link
            href="/yonetim"
            className="inline-block bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
          >
            Yönetim paneline dön
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
