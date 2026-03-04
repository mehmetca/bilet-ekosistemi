"use client";

import { Suspense, useState, useEffect } from "react";
import AdminNavigationFixed from "@/components/AdminNavigationFixed";
import AdminPolicyHeader from "@/components/AdminPolicyHeader";

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
    <div className="flex min-h-screen bg-slate-50">
      <AdminNavigationFixed
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <AdminPolicyHeader onMenuClick={() => setSidebarOpen(true)} />
        <div className="flex-1 overflow-auto">
          <Suspense fallback={
            <div className="flex items-center justify-center min-h-screen">
              <div className="text-slate-500">Yükleniyor...</div>
            </div>
          }>
            {children}
          </Suspense>
        </div>
      </div>
    </div>
  );
}
