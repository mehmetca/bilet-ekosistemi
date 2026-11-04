"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  X,
  Calendar,
  Ticket,
  Shield,
  LogOut,
  User,
  FileText,
  ChevronDown,
  Search as SearchIcon,
  type LucideIcon,
} from "lucide-react";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";
import {
  ADMIN_NAV_GROUPS,
  findGroupKeyForPath,
  type AdminNavItem,
} from "@/components/adminNavConfig";

const OPEN_GROUPS_STORAGE_KEY = "adminNavOpenGroups";

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

  const navLabel = (item: AdminNavItem) =>
    item.labelKey ? t(item.labelKey) : item.label || "";
  const navDescription = (item: AdminNavItem) =>
    item.descriptionKey ? t(item.descriptionKey) : item.description || "";

  const activeGroupKey = findGroupKeyForPath(pathname || "");
  const [openGroups, setOpenGroups] = useState<string[]>(() => []);
  const [searchTerm, setSearchTerm] = useState("");

  // Açık gruplar tarayıcıda hatırlanır; aktif sayfanın grubu her zaman açılır.
  useEffect(() => {
    let stored: string[] = [];
    try {
      const raw = window.localStorage.getItem(OPEN_GROUPS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) stored = parsed.filter((v) => typeof v === "string");
      }
    } catch {
      /* ignore */
    }
    if (activeGroupKey && !stored.includes(activeGroupKey)) stored = [...stored, activeGroupKey];
    setOpenGroups(stored);
  }, [activeGroupKey]);

  function toggleGroup(key: string) {
    setOpenGroups((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      try {
        window.localStorage.setItem(OPEN_GROUPS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  const searching = searchTerm.trim().length > 0;
  const visibleGroups = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return ADMIN_NAV_GROUPS;
    return ADMIN_NAV_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        `${navLabel(item)} ${navDescription(item)}`.toLowerCase().includes(term)
      ),
    })).filter((group) => group.items.length > 0);
  }, [searchTerm, t]);

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
      { href: "/yonetim/gise", label: "Gişe satışı", icon: Ticket, description: "Kendi etkinliklerinde kapıda bilet kesme" },
      { href: "/yonetim/faturalar", label: "Faturalar", icon: FileText, description: "Kendi etkinliklerinin Rechnung ve KDV dökümü" },
      { href: "/yonetim/bilgilerim", label: t("nav.orgInfo"), icon: User, description: t("nav.orgInfoDesc") },
    ],
    [t]
  );

  const flatMenuItems = isController && !isOrganizer ? controllerMenuItems : organizerMenuItems;

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
                    : userRole === "gate_sales"
                      ? t("roles.gateSales")
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
        {isAdmin ? (
          <>
            <div className="relative mb-2">
              <SearchIcon className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={t("nav.searchPlaceholder")}
                className="w-full rounded-lg border border-slate-200 py-1.5 pl-7 pr-2 text-xs text-slate-700 placeholder:text-slate-400 focus:border-primary-300 focus:outline-none"
              />
            </div>

            {visibleGroups.map((group) => {
              const GroupIcon: LucideIcon = group.icon;
              const expanded = searching || openGroups.includes(group.key);
              const hasActive = group.key === activeGroupKey;
              return (
                <div key={group.key} className="pb-1">
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.key)}
                    aria-expanded={expanded}
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-semibold transition-colors ${
                      hasActive ? "text-primary-700" : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <GroupIcon className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="flex-1 truncate">{group.label}</span>
                    <span className="rounded-full bg-slate-100 px-1.5 text-[10px] font-medium text-slate-600">
                      {group.items.length}
                    </span>
                    <ChevronDown
                      className={`h-3.5 w-3.5 flex-shrink-0 transition-transform ${
                        expanded ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {expanded && (
                    <div className="mt-0.5 space-y-0.5 border-l border-slate-200 pl-2 ml-2">
                      {group.items.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          title={navDescription(item)}
                          className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
                            isActive(item.href)
                              ? "bg-primary-50 text-primary-700 border border-primary-200"
                              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                          }`}
                        >
                          <item.icon className="h-3 w-3 flex-shrink-0" />
                          <span className="min-w-0 flex-1 truncate">{navLabel(item)}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {visibleGroups.length === 0 && (
              <p className="px-2 py-3 text-xs text-slate-500">Eşleşen sayfa yok.</p>
            )}
          </>
        ) : (
          flatMenuItems.map((item) => {
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
          })
        )}
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
              : userRole === "gate_sales"
                ? t("roles.gateSales")
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
