"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";
import AuthRedirectingScreen from "@/components/AuthRedirectingScreen";

interface AdminGuardProps {
  children: React.ReactNode;
}

export default function AdminGuard({ children }: AdminGuardProps) {
  const { user, loading, isAdmin, isController, isOrganizer } = useSimpleAuth();
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

  // Giriş yapılmış ama admin/controller/organizer değilse açıklayıcı sayfa göster (sessiz yönlendirme yok)
  if (!isAdmin && !isController && !isOrganizer) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 max-w-md text-center">
          <h1 className="text-xl font-semibold text-slate-900 mb-2">Yönetim paneline erişim yetkiniz yok</h1>
          <p className="text-slate-600 mb-6">
            Bu hesap yönetici, kontrolör veya organizatör yetkisine sahip değil. Erişim için yönetici ile iletişime geçin.
          </p>
          <Link
            href="/"
            className="inline-block bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
          >
            Ana sayfaya dön
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
