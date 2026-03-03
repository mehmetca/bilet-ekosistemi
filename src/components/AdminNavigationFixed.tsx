"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Calendar, 
  Ticket, 
  Users, 
  Settings, 
  Shield, 
  CreditCard,
  BarChart3,
  LogOut,
  User,
  Megaphone
} from "lucide-react";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";
import { useRouter } from "next/navigation";

export default function AdminNavigationFixed() {
  const pathname = usePathname();
  const { user, isAdmin, isController, userRole, signOut } = useSimpleAuth();
  const router = useRouter();

  const isActive = (path: string) => pathname === path;

  const adminMenuItems = [
    {
      href: "/yonetim",
      label: "Dashboard",
      icon: Calendar,
      description: "Yönetim paneli"
    },
    {
      href: "/yonetim/etkinlikler",
      label: "Etkinlikler",
      icon: Calendar,
      description: "Etkinlik yönetimi"
    },
    {
      href: "/yonetim/reklamlar",
      label: "Reklamlar",
      icon: Megaphone,
      description: "Reklam yönetimi"
    },
    {
      href: "/yonetim/sanatcilar",
      label: "Sanatçılar",
      icon: User,
      description: "Biyografi ve galeri yönetimi"
    },
    {
      href: "/yonetim/bilet-turleri",
      label: "Bilet Türleri",
      icon: Ticket,
      description: "Bilet türleri ve stok"
    },
    {
      href: "/yonetim/bilet-listesi",
      label: "Siparişler",
      icon: CreditCard,
      description: "Tüm siparişler"
    },
    {
      href: "/yonetim/muhasebe",
      label: "Muhasebe",
      icon: BarChart3,
      description: "Finansal raporlar"
    },
    {
      href: "/yonetim/kullanicilar",
      label: "Kullanıcılar",
      icon: Users,
      description: "Rol ve yetki yönetimi"
    },
    {
      href: "/yonetim/bilet-kontrol",
      label: "Bilet Kontrol",
      icon: Shield,
      description: "Bilet doğrulama"
    },
    {
      href: "/yonetim/ayarlar",
      label: "Ayarlar",
      icon: Settings,
      description: "Sistem ayarları"
    }
  ];

  const controllerMenuItems = [
    {
      href: "/yonetim/bilet-kontrol",
      label: "Bilet Kontrol",
      icon: Shield,
      description: "Bilet doğrulama"
    }
  ];

  const menuItems = isAdmin ? adminMenuItems : controllerMenuItems;

  return (
    <div className="w-56 bg-white border-r border-slate-200 min-h-screen relative">
      {/* Header */}
      <div className="p-4 border-b border-slate-200">
        <h1 className="text-base font-bold text-slate-900 truncate max-w-[120px]">Yönetim</h1>
        <div className="mt-2 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500"></div>
          <span className="text-xs text-slate-600 truncate max-w-[100px]">
            {user?.email}
          </span>
        </div>
        <div className="mt-1">
          <span className="inline-flex items-center px-1 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
            {userRole === "admin" ? "Yön" : "K"}
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="p-3 space-y-1 relative z-10">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                isActive(item.href)
                  ? "bg-primary-50 text-primary-700 border border-primary-200"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Icon className="h-3 w-3" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium">{item.label}</div>
                <div className="text-xs text-slate-500 hidden lg:block">{item.description}</div>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* User Menu */}
      <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-slate-200 bg-white z-20">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
                if (typeof signOut === 'function') {
                  signOut();
                }
                router.push('/giris');
              }}
            className="flex items-center gap-2 px-3 py-2 text-slate-600 hover:text-slate-900 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span className="text-sm font-medium">Çıkış Yap</span>
          </button>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-slate-900 truncate max-w-[140px]">
            {user?.email}
          </p>
          <p className="text-xs text-slate-500 truncate max-w-[140px]">
            {userRole === "admin" ? "Yönetici" : "Kontrolör"}
          </p>
        </div>
      </div>
    </div>
  );
}
