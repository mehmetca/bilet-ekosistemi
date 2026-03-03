"use client";

import Link from "next/link";
import { Ticket, User, LogIn } from "lucide-react";

import { useSimpleAuth } from "@/contexts/SimpleAuthContext";

export default function Header() {
  const { user, isAdmin } = useSimpleAuth();

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-bold text-xl text-primary-600">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-600 text-white">
            <Ticket className="h-5 w-5" />
          </div>
          Bilet Ekosistemi
        </Link>
        
        <nav className="hidden md:flex items-center gap-6">
          <Link 
            href="/" 
            className="text-slate-600 hover:text-primary-600 font-medium transition-colors"
          >
            Etkinlikler
          </Link>
          <Link 
            href="/takvim" 
            className="text-slate-600 hover:text-primary-600 font-medium transition-colors"
          >
            Takvim
          </Link>
          <Link 
            href="/sanatci" 
            className="text-slate-600 hover:text-primary-600 font-medium transition-colors"
          >
            Sanatçılar
          </Link>
          <Link
            href="/turne"
            className="text-slate-600 hover:text-primary-600 font-medium transition-colors"
          >
            Turneler
          </Link>
          {user ? (
            <Link 
              href="/yonetim" 
              className="flex items-center gap-2 text-slate-600 hover:text-primary-600 font-medium transition-colors"
            >
              <User className="h-4 w-4" />
              {isAdmin ? "Yönetim Paneli" : "Profilim"}
            </Link>
          ) : (
            <Link 
              href="/giris" 
              className="flex items-center gap-2 text-slate-600 hover:text-primary-600 font-medium transition-colors"
            >
              <LogIn className="h-4 w-4" />
              Giriş Yap
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-2">
          {user && isAdmin && (
            <Link 
              href="/yonetim" 
              className="text-sm text-slate-500 hover:text-primary-600 transition-colors"
            >
              Yönetim
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
