"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { 
  Calendar, 
  Ticket, 
  Users, 
  Settings, 
  Shield, 
  CreditCard,
  BarChart3,
  FlaskConical,
  LogOut,
  User,
  Megaphone,
  MapPin,
  Bell,
  Search
} from "lucide-react";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";

interface AdminNavigationFixedProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function AdminNavigationFixed({ isOpen = false, onClose }: AdminNavigationFixedProps) {
  const pathname = usePathname();

  useEffect(() => {
    if (onClose) onClose();
  }, [pathname]);
  const { user, isAdmin, isController, isOrganizer, userRole, signOut } = useSimpleAuth();

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
      href: "/yonetim/mekanlar",
      label: "Mekanlar",
      icon: MapPin,
      description: "Salon ve mekan bilgileri"
    },
    {
      href: "/yonetim/sehirler",
      label: "Şehirler",
      icon: MapPin,
      description: "Das ist los in deiner Stadt!"
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
      href: "/yonetim/musteri-ara",
      label: "Müşteri Ara",
      icon: Search,
      description: "Kundennummer ile müşteri bilgisi"
    },
    {
      href: "/yonetim/bilet-kontrol",
      label: "Bilet Kontrol",
      icon: Shield,
      description: "Bilet doğrulama"
    },
    {
      href: "/yonetim/etkinlik-uyarilari",
      label: "Etkinlik Uyarıları",
      icon: Bell,
      description: "Bilet hatırlatması kayıtları"
    },
    {
      href: "/yonetim/huni-analitigi",
      label: "Huni Analitiği",
      icon: BarChart3,
      description: "Görüntüleme → Satın alma"
    },
    {
      href: "/yonetim/ab-test",
      label: "A/B Test",
      icon: FlaskConical,
      description: "Hero ve CTA varyantları"
    },
    {
      href: "/yonetim/audit-log",
      label: "Denetim Kaydı",
      icon: Shield,
      description: "Audit log"
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
      href: "/yonetim",
      label: "Dashboard",
      icon: Calendar,
      description: "Kontrolör paneli"
    },
    {
      href: "/yonetim/bilet-kontrol",
      label: "Bilet Kontrol",
      icon: Shield,
      description: "Bilet doğrulama"
    }
  ];

  const organizerMenuItems = [
    {
      href: "/yonetim",
      label: "Dashboard",
      icon: Calendar,
      description: "Organizatör paneli"
    },
    {
      href: "/yonetim/etkinlikler",
      label: "Etkinlikler",
      icon: Calendar,
      description: "Etkinlik yönetimi"
    },
    {
      href: "/yonetim/bilgilerim",
      label: "Organizasyon Bilgileri",
      icon: User,
      description: "Başvuru formu ve bilgileriniz"
    }
  ];

  const menuItems = isAdmin ? adminMenuItems : isController ? controllerMenuItems : organizerMenuItems;

  const sidebarContent = (
    <div className="w-56 h-full bg-white flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-slate-200">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-bold text-slate-900 truncate">Yönetim</h1>
            <div className="mt-2 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0"></div>
              <span className="text-xs text-slate-600 truncate">
                {user?.email}
              </span>
            </div>
            <div className="mt-1">
              <span className="inline-flex items-center px-1 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                {userRole === "admin" ? "Yönetici" : userRole === "controller" ? "Kontrolör" : "Organizatör"}
              </span>
            </div>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="md:hidden p-1.5 -mr-1 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded flex-shrink-0"
              aria-label="Menüyü kapat"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* Navigation - scrollable */}
      <nav className="flex-1 overflow-y-auto min-h-0 p-3 space-y-1">
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

      {/* User Menu - sabit altta */}
      <div className="flex-shrink-0 p-3 border-t border-slate-200 bg-white">
        <button
          onClick={() => {
            if (typeof signOut === "function") {
              signOut();
            }
            window.location.href = "/";
          }}
          className="flex items-center gap-2 px-3 py-2 w-full text-left text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors"
        >
          <LogOut className="h-4 w-4" />
          <span className="text-sm font-medium">Çıkış Yap</span>
        </button>
        <p className="text-xs font-medium text-slate-900 truncate px-3">
          {user?.email}
        </p>
        <p className="text-xs text-slate-500 truncate px-3 mt-0.5">
          {userRole === "admin" ? "Yönetici" : userRole === "controller" ? "Kontrolör" : "Organizatör"}
        </p>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobil: overlay backdrop */}
      {onClose && (
        <div
          className={`fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity ${
            isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      {/* Sidebar: mobilde overlay, masaüstünde sabit */}
      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-50 md:z-auto
          w-56 h-screen bg-white border-r border-slate-200
          flex flex-col overflow-hidden
          transform transition-transform duration-200 ease-out
          md:transform-none
          ${onClose ? (isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0") : "translate-x-0"}
        `}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
