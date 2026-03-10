"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";

interface OrganizerOrAdminGuardProps {
  children: React.ReactNode;
}

/** Admin veya Organizatör erişebilir (örn. satılan bilet listesi, check-in). */
export default function OrganizerOrAdminGuard({ children }: OrganizerOrAdminGuardProps) {
  const { user, loading, isAdmin, isOrganizer } = useSimpleAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/giris");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-500">Yükleniyor...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (!isAdmin && !isOrganizer) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 max-w-md text-center">
          <h1 className="text-xl font-semibold text-slate-900 mb-2">Bu sayfaya erişim yetkiniz yok</h1>
          <p className="text-slate-600 mb-6">
            Bu sayfa sadece yönetici veya organizatör hesapları tarafından kullanılabilir.
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
