"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Link as I18nLink } from "@/i18n/navigation";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";
import { useTranslations } from "next-intl";
import { Ticket, User, LogOut, Menu, X } from "lucide-react";

interface PanelLayoutProps {
  children: React.ReactNode;
}

export default function PanelLayout({ children }: PanelLayoutProps) {
  const pathname = usePathname();
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
    <div className="w-56 h-full bg-white flex flex-col overflow-hidden">
      <div className="flex-shrink-0 p-4 border-b border-slate-200">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-bold text-slate-900 truncate">{t("title")}</h1>
            <p className="mt-1 text-xs text-slate-600 truncate">{user?.email}</p>
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

      <nav className="flex-1 overflow-y-auto min-h-0 p-3 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <I18nLink
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                item.active
                  ? "bg-primary-50 text-primary-700 border border-primary-200"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </I18nLink>
          );
        })}
      </nav>

      <div className="flex-shrink-0 p-3 border-t border-slate-200">
        <I18nLink
          href="/"
          className="flex items-center gap-2 px-2 py-1.5 mb-2 rounded-lg text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900"
        >
          {tCommon("backToHome")}
        </I18nLink>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-3 py-2 w-full text-left text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          <LogOut className="h-4 w-4" />
          <span className="text-sm font-medium">{t("logout")}</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Mobil overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sol sidebar */}
      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-50 md:z-auto
          w-56 h-screen bg-white border-r border-slate-200
          flex flex-col overflow-hidden
          transform transition-transform duration-200 ease-out
          md:transform-none
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
      >
        {sidebarContent}
      </aside>

      {/* Ana içerik */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-10 flex items-center gap-4 border-b border-slate-200 bg-white px-4 py-2">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="md:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
            aria-label="Menüyü aç"
          >
            <Menu className="h-5 w-5" />
          </button>
          <I18nLink href="/" className="text-slate-600 hover:text-primary-600 text-sm">
            {tCommon("backToHome")}
          </I18nLink>
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
