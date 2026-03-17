"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Calendar,
  BarChart3,
  UserCheck,
  User,
  Plus,
  Menu,
  X,
  Home,
  LogOut,
  MapPin,
} from "lucide-react";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";
import { supabase } from "@/lib/supabase-client";
import Footer from "@/components/Footer";

const ORGANIZER_MENU = [
  { href: "/yonetim", label: "Dashboard", icon: LayoutDashboard },
  { href: "/yonetim/etkinlikler", label: "Etkinliklerim", icon: Calendar },
  { href: "/yonetim/mekanlar", label: "Mekanlar / Salon tasarımı", icon: MapPin },
  { href: "/yonetim/satis-raporu", label: "Satışlar", icon: BarChart3 },
  { href: "/yonetim/bilet-kontrol", label: "Check-in", icon: UserCheck },
  { href: "/yonetim/bilgilerim", label: "Profil", icon: User },
];

export default function OrganizerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, signOut } = useSimpleAuth();

  async function handleSignOut() {
    await signOut();
    window.location.href = "/giris";
  }
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [displayName, setDisplayName] = useState<string>("");

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

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      try {
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("first_name, last_name")
          .eq("id", user.id)
          .maybeSingle();
        const name = profile
          ? [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim()
          : "";
        setDisplayName(name || user.email?.split("@")[0] || "Organizatör");
      } catch {
        setDisplayName(user.email?.split("@")[0] || "Organizatör");
      }
    })();
  }, [user?.id, user?.email]);

  const isActive = (path: string) => pathname === path || (path !== "/yonetim" && pathname?.startsWith(path));

  const todayStr = new Date().toLocaleDateString("tr-TR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sol Menü - mobilde overlay */}
      <div
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-slate-200 transform transition-transform duration-200 ease-out md:relative md:translate-x-0 flex flex-col ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex-shrink-0 p-4 border-b border-slate-200 flex items-center justify-between">
          <span className="text-base font-bold text-slate-900">Organizatör</span>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="md:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-lg"
            aria-label="Menüyü kapat"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {ORGANIZER_MENU.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive(item.href)
                    ? "bg-primary-50 text-primary-700 border border-primary-200"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                {item.label}
              </Link>
            );
          })}
          <div className="pt-3 mt-3 border-t border-slate-200 space-y-1">
            <Link
              href="/tr"
              onClick={() => setSidebarOpen(false)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
            >
              <Home className="h-4 w-4 flex-shrink-0" />
              Ana Sayfa
            </Link>
            <button
              type="button"
              onClick={() => {
                setSidebarOpen(false);
                handleSignOut();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-700 transition-colors"
            >
              <LogOut className="h-4 w-4 flex-shrink-0" />
              Çıkış Yap
            </button>
          </div>
        </nav>
      </div>

      {/* Ana içerik */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Üst Bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 py-3">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
            aria-label="Menüyü aç"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1 flex flex-wrap items-center gap-4 min-w-0">
            <p className="text-slate-700 font-medium truncate">
              Hoş geldin, <span className="text-slate-900">{displayName || "…"}</span>
            </p>
            <p className="text-sm text-slate-500 truncate">{todayStr}</p>
          </div>
          <Link
            href="/tr"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors flex-shrink-0"
          >
            <Home className="h-4 w-4" />
            Ana Sayfa
          </Link>
          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-700 transition-colors flex-shrink-0"
          >
            <LogOut className="h-4 w-4" />
            Çıkış
          </button>
          <Link
            href="/yonetim/etkinlikler/yeni"
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 transition-colors flex-shrink-0"
          >
            <Plus className="h-4 w-4" />
            Yeni Etkinlik
          </Link>
        </header>

        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
        <Footer />
      </div>

      {/* Mobil overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      )}
    </div>
  );
}
