"use client";

import { Suspense } from "react";
import AdminNavigationFixed from "@/components/AdminNavigationFixed";
import AdminPolicyHeader from "@/components/AdminPolicyHeader";

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <AdminNavigationFixed />
      <div className="flex-1 flex flex-col overflow-hidden">
        <AdminPolicyHeader />
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
