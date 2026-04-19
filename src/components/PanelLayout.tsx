"use client";

import { useState, useEffect } from "react";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";
import { Ticket, User, LogOut, Menu, X, ChevronLeft } from "lucide-react";

interface PanelLayoutProps {
  children: React.ReactNode;
}

/** Biletinial tarzı profil alanı: sabit yan menü genişliği (260px) + içerik alanı geniş (Biletinial MySubscriptions gibi). */
const SIDEBAR_WIDTH = 260;
const CONTENT_MAX_WIDTH = "max-w-5xl"; // 1024px – Biletinial gibi geniş içerik alanı

function hrefWithLocale(locale: string, path: string): string {
  if (path === "/") return `/${locale}`;
  return `/${locale}${path.startsWith("/") ? path : `/${path}`}`;
}

export default function PanelLayout({ children }: PanelLayoutProps) {
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations("panel");
  const tCommon = useTranslations("common");
  const { user, signOut } = useSimpleAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  const isPanel = pathname?.endsWith("/panel");
  const isBilgilerim = pathname?.endsWith("/bilgilerim");

  const menuItems = [
    { href: "/panel", label: t("myTickets"), icon: Ticket, active: isPanel },
    { href: "/bilgilerim", label: t("myInfo"), icon: User, active: isBilgilerim },
  ];

  async function handleLogout() {
    await signOut();
    window.location.href = "/";
  }

  const sidebarContent = (
    <div className="h-full bg-white flex flex-col overflow-hidden" style={{ width: SIDEBAR_WIDTH }}>
      <div className="flex-shrink-0 px-5 pt-6 pb-4 border-b border-slate-200">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold text-slate-900">{t("title")}</h1>
            <p className="mt-1.5 text-sm text-slate-500 truncate">{user?.email}</p>
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="md:hidden p-1.5 -mr-1 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded flex-shrink-0"
            aria-label="Menüyü kapat"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto min-h-0 py-4">
        <div className="px-3 space-y-0.5">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <NextLink
                key={item.href}
                href={hrefWithLocale(locale, item.href)}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  item.active
                    ? "bg-primary-50 text-primary-700"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                {item.label}
              </NextLink>
            );
          })}
        </div>
      </nav>

      <div className="flex-shrink-0 p-4 border-t border-slate-200 space-y-1">
        <NextLink
          href={hrefWithLocale(locale, "/")}
          onClick={() => setSidebarOpen(false)}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900"
        >
          <ChevronLeft className="h-4 w-4 flex-shrink-0" />
          {tCommon("backToHome")}
        </NextLink>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 w-full text-left text-sm text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          <LogOut className="h-4 w-4 flex-shrink-0" />
          <span className="font-medium">{t("logout")}</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-slate-50">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-50 md:z-auto
          h-screen bg-white border-r border-slate-200
          flex flex-col overflow-hidden
          transform transition-transform duration-200 ease-out
          md:transform-none
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
        style={{ width: SIDEBAR_WIDTH }}
      >
        {sidebarContent}
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-10 flex items-center gap-4 border-b border-slate-200 bg-white px-4 py-3 md:pl-5 md:pr-6">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="md:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
            aria-label="Menüyü aç"
          >
            <Menu className="h-5 w-5" />
          </button>
          <NextLink
            href={hrefWithLocale(locale, "/")}
            className="text-slate-600 hover:text-primary-600 text-sm inline-flex items-center gap-1"
          >
            <ChevronLeft className="h-4 w-4" />
            {tCommon("backToHome")}
          </NextLink>
        </header>
        <main className="flex-1 overflow-auto p-4 md:pl-5 md:pr-6 md:pt-6 md:pb-8">
          <div className={`${CONTENT_MAX_WIDTH} w-full`}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
