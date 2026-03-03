"use client";

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
  User
} from "lucide-react";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";

export default function AdminNavigation() {
  const pathname = usePathname();
  const { user, isAdmin, userRole, signOut } = useSimpleAuth();

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
    <div className="w-64 bg-white border-r border-slate-200 min-h-screen">
      {/* Header */}
      <div className="p-6 border-b border-slate-200">
        <h1 className="text-xl font-bold text-slate-900">Yönetim Paneli</h1>
        <div className="mt-2 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500"></div>
          <span className="text-sm text-slate-600">
            {user?.email}
          </span>
        </div>
        <div className="mt-1">
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
            {userRole === "admin" ? "Yönetici" : "Kontrolör"}
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="p-4 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive(item.href)
                  ? "bg-primary-50 text-primary-700 border border-primary-200"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Icon className="h-4 w-4" />
              <div className="flex-1">
                <div>{item.label}</div>
                <div className="text-xs text-slate-500">{item.description}</div>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* User Menu */}
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-200 bg-white">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center">
            <User className="h-4 w-4 text-slate-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-900 truncate">
              {user?.email}
            </p>
            <p className="text-xs text-slate-500">
              {userRole === "admin" ? "Yönetici" : "Kontrolör"}
            </p>
          </div>
        </div>
        <button
          onClick={signOut}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-lg transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Çıkış Yap
        </button>
      </div>
    </div>
  );
}
