"use client";

import { Suspense, useState, useEffect } from "react";
import AdminGuard from "@/components/AdminGuard";
import AdminNavigationFixed from "@/components/AdminNavigationFixed";
import AdminPolicyHeader from "@/components/AdminPolicyHeader";
import Footer from "@/components/Footer";
import OrganizerLayout from "@/components/OrganizerLayout";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";

export default function YonetimLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { isOrganizer, loading } = useSimpleAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (sidebarOpen && window.matchMedia("(max-width: 767px)").matches) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [sidebarOpen]);

  return (
    <AdminGuard>
      {!loading && isOrganizer ? (
        <OrganizerLayout>
          <Suspense fallback={<div className="flex items-center justify-center py-16 text-slate-500">Yükleniyor...</div>}>
            {children}
          </Suspense>
        </OrganizerLayout>
      ) : (
        <div className="flex min-h-screen bg-slate-50">
          <AdminNavigationFixed isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
          <div className="flex-1 flex flex-col overflow-hidden min-w-0">
            <AdminPolicyHeader onMenuClick={() => setSidebarOpen(true)} />
            <div className="flex-1 overflow-auto">
              <Suspense fallback={<div className="flex items-center justify-center min-h-screen text-slate-500">Yükleniyor...</div>}>
                {children}
              </Suspense>
            </div>
            <Footer />
          </div>
        </div>
      )}
    </AdminGuard>
  );
}
