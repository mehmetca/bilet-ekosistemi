"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Ticket, User, LogIn, Menu, X } from "lucide-react";

import { useSimpleAuth } from "@/contexts/SimpleAuthContext";

const navLinks = [
  { href: "/", label: "Etkinlikler" },
  { href: "/takvim", label: "Takvim" },
  { href: "/mekanlar", label: "Mekanlar" },
  { href: "/sanatci", label: "Sanatçılar" },
];

export default function Header() {
  const { user, isAdmin } = useSimpleAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  // Sayfa değiştiğinde mobil menüyü her zaman kapat (link tıklansa da tıklanmasa da)
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="container mx-auto flex h-14 sm:h-16 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg sm:text-xl text-primary-600">
          <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-primary-600 text-white shrink-0">
            <Ticket className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <span className="hidden sm:inline">Bilet Ekosistemi</span>
          <span className="sm:hidden">Bilet</span>
        </Link>

        {/* Masaüstü menü */}
        <nav className="hidden md:flex items-center gap-6">
          {navLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="text-slate-600 hover:text-primary-600 font-medium transition-colors"
            >
              {label}
            </Link>
          ))}
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

        {/* Mobil: hamburger + açılır menü */}
        <div className="flex md:hidden items-center gap-2">
          {user && isAdmin && (
            <Link href="/yonetim" className="text-sm text-slate-500 hover:text-primary-600">
              Yönetim
            </Link>
          )}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((o) => !o)}
            className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-primary-600 transition-colors"
            aria-label={mobileMenuOpen ? "Menüyü kapat" : "Menüyü aç"}
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobil açılır menü */}
      {mobileMenuOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
            aria-hidden
            onClick={() => setMobileMenuOpen(false)}
          />
          <nav
            className="absolute left-0 right-0 top-full z-50 flex flex-col gap-1 border-b border-slate-200 bg-white py-3 px-4 shadow-lg md:hidden"
            role="navigation"
          >
            {navLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileMenuOpen(false)}
                className="block rounded-lg px-4 py-3 text-slate-700 hover:bg-slate-100 hover:text-primary-600 font-medium"
              >
                {label}
              </Link>
            ))}
            {user ? (
              <Link
                href="/yonetim"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 rounded-lg px-4 py-3 text-slate-700 hover:bg-slate-100 hover:text-primary-600 font-medium"
              >
                <User className="h-4 w-4" />
                {isAdmin ? "Yönetim Paneli" : "Profilim"}
              </Link>
            ) : (
              <Link
                href="/giris"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 rounded-lg px-4 py-3 text-slate-700 hover:bg-slate-100 hover:text-primary-600 font-medium"
              >
                <LogIn className="h-4 w-4" />
                Giriş Yap
              </Link>
            )}
          </nav>
        </>
      )}
    </header>
  );
}
