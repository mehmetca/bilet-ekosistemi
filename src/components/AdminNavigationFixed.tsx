"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  X,
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
  Search as SearchIcon,
  LayoutGrid,
  PieChart,
} from "lucide-react";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";

interface AdminNavigationFixedProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function AdminNavigationFixed({ isOpen = false, onClose }: AdminNavigationFixedProps) {
  const pathname = usePathname();
  const t = useTranslations("adminPanel");

  useEffect(() => {
    if (onClose) onClose();
  }, [pathname]);
  const { user, isAdmin, isController, isOrganizer, userRole, signOut } = useSimpleAuth();

  const isActive = (path: string) => pathname === path;

  const adminMenuItems = useMemo(
    () => [
      { href: "/yonetim", label: t("nav.dashboard"), icon: Calendar, description: t("nav.dashboardDescAdmin") },
      { href: "/yonetim/etkinlikler", label: t("nav.events"), icon: Calendar, description: t("nav.eventsDesc") },
      { href: "/yonetim/mekanlar", label: t("nav.venues"), icon: MapPin, description: t("nav.venuesDesc") },
      { href: "/yonetim/salon-yapim-wizard", label: t("nav.salonWizard"), icon: LayoutGrid, description: t("nav.salonWizardDesc") },
      { href: "/yonetim/sehirler", label: t("nav.cities"), icon: MapPin, description: t("nav.citiesDesc") },
      { href: "/yonetim/slider-yonetimi", label: t("nav.slider"), icon: Megaphone, description: t("nav.sliderDesc") },
      { href: "/yonetim/sanatcilar", label: t("nav.artists"), icon: User, description: t("nav.artistsDesc") },
      { href: "/yonetim/bilet-turleri", label: t("nav.ticketTypes"), icon: Ticket, description: t("nav.ticketTypesDesc") },
      { href: "/yonetim/bilet-listesi", label: t("nav.orders"), icon: CreditCard, description: t("nav.ordersDesc") },
      { href: "/yonetim/bilet-ozeti", label: t("nav.ticketSummary"), icon: PieChart, description: t("nav.ticketSummaryDesc") },
      { href: "/yonetim/muhasebe", label: t("nav.accounting"), icon: BarChart3, description: t("nav.accountingDesc") },
      { href: "/yonetim/kullanicilar", label: t("nav.users"), icon: Users, description: t("nav.usersDesc") },
      { href: "/yonetim/musteri-ara", label: t("nav.customerSearch"), icon: SearchIcon, description: t("nav.customerSearchDesc") },
      { href: "/yonetim/bilet-kontrol", label: t("nav.ticketCheck"), icon: Shield, description: t("nav.ticketCheckDesc") },
      { href: "/yonetim/etkinlik-uyarilari", label: t("nav.eventAlerts"), icon: Bell, description: t("nav.eventAlertsDesc") },
      { href: "/yonetim/huni-analitigi", label: t("nav.funnel"), icon: BarChart3, description: t("nav.funnelDesc") },
      { href: "/yonetim/ab-test", label: t("nav.abTest"), icon: FlaskConical, description: t("nav.abTestDesc") },
      { href: "/yonetim/audit-log", label: t("nav.audit"), icon: Shield, description: t("nav.auditDesc") },
      { href: "/yonetim/ayarlar", label: t("nav.settings"), icon: Settings, description: t("nav.settingsDesc") },
    ],
    [t]
  );

  const controllerMenuItems = useMemo(
    () => [
      { href: "/yonetim", label: t("nav.dashboard"), icon: Calendar, description: t("nav.dashboardDescController") },
      { href: "/yonetim/bilet-kontrol", label: t("nav.ticketCheck"), icon: Shield, description: t("nav.ticketCheckDesc") },
    ],
    [t]
  );

  const organizerMenuItems = useMemo(
    () => [
      { href: "/yonetim", label: t("nav.dashboard"), icon: Calendar, description: t("nav.dashboardDescOrganizer") },
      { href: "/yonetim/etkinlikler", label: t("nav.organizerEvents"), icon: Calendar, description: t("nav.eventsDesc") },
      { href: "/yonetim/biletlerim", label: t("nav.myTickets"), icon: Ticket, description: t("nav.myTicketsDesc") },
      { href: "/yonetim/bilgilerim", label: t("nav.orgInfo"), icon: User, description: t("nav.orgInfoDesc") },
    ],
    [t]
  );

  const menuItems = isAdmin
    ? adminMenuItems
    : isController && !isOrganizer
      ? controllerMenuItems
      : organizerMenuItems;

  const sidebarContent = (
    <div className="w-56 h-full bg-white flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-slate-200">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-bold text-slate-900 truncate">{t("sidebarTitle")}</h1>
            <div className="mt-2 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0"></div>
              <span className="text-xs text-slate-600 truncate">
                {user?.email}
              </span>
            </div>
            <div className="mt-1">
              <span className="inline-flex items-center px-1 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                {userRole === "admin"
                  ? t("roles.admin")
                  : userRole === "controller"
                    ? t("roles.controller")
                    : t("roles.organizer")}
              </span>
            </div>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="md:hidden p-1.5 -mr-1 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded flex-shrink-0"
              aria-label={t("shell.closeMenu")}
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
          onClick={async () => {
            if (typeof signOut === "function") await signOut();
            window.location.href = "/giris";
          }}
          className="flex items-center gap-2 px-3 py-2 w-full text-left text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors"
        >
          <LogOut className="h-4 w-4" />
          <span className="text-sm font-medium">{t("signOut")}</span>
        </button>
        <p className="text-xs font-medium text-slate-900 truncate px-3">
          {user?.email}
        </p>
        <p className="text-xs text-slate-500 truncate px-3 mt-0.5">
          {userRole === "admin"
            ? t("roles.admin")
            : userRole === "controller"
              ? t("roles.controller")
              : t("roles.organizer")}
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
