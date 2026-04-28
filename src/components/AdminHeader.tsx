"use client";

import Link from "next/link";
import { Ticket, ArrowLeft } from "lucide-react";

export default function AdminHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="site-container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-medium text-slate-600 hover:text-primary-600">
          <ArrowLeft className="h-4 w-4" />
          Ana Sayfaya Dön
        </Link>
        <div className="flex items-center gap-2 font-bold text-xl text-primary-600">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-600 text-white">
            <Ticket className="h-5 w-5" />
          </div>
          Yönetim Paneli
        </div>
        <div className="w-32"></div>
      </div>
    </header>
  );
}
