"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";

interface AdminGuardProps {
  children: React.ReactNode;
}

export default function AdminGuard({ children }: AdminGuardProps) {
  const { user, loading, isAdmin, isController } = useSimpleAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace("/giris");
      } else if (!isAdmin && !isController) {
        router.replace("/");
      }
    }
  }, [user, loading, isAdmin, isController, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-500">Yükleniyor...</div>
      </div>
    );
  }

  if (!user || (!isAdmin && !isController)) {
    return null;
  }

  // Admin veya Controller ise children'ı göster
  return <>{children}</>;
}
