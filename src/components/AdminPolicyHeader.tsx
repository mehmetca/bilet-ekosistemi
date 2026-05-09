"use client";

import NextLink from "next/link";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Menu } from "lucide-react";

export default function AdminPolicyHeader({ onMenuClick }: { onMenuClick?: () => void }) {
  const t = useTranslations("adminPanel.shell");
  const siteLinks = [
    { href: "/", label: t("events"), useLocale: true },
    { href: "/takvim", label: t("calendar"), useLocale: true },
    { href: "/sanatci", label: t("artists"), useLocale: true },
    { href: "/yonetim", label: t("panel"), useLocale: false },
  ] as const;

  return (
    <header className={`sticky top-0 z-10 flex items-center gap-2 sm:gap-4 border-b border-slate-200 bg-white px-3 sm:px-4 py-2 text-xs sm:text-sm min-w-0 ${onMenuClick ? "justify-between" : "justify-end"} md:justify-end`}>
      {onMenuClick && (
        <button
          type="button"
          onClick={onMenuClick}
          className="md:hidden p-2 -ml-1 shrink-0 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
          aria-label={t("openMenu")}
        >
          <Menu className="h-5 w-5" />
        </button>
      )}
      <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto scrollbar-hide min-w-0 flex-1 md:flex-initial md:overflow-visible md:justify-end pb-0.5 md:pb-0">
      {siteLinks.map(({ href, label, useLocale }) => {
        const linkClass = "text-slate-600 hover:text-primary-600 whitespace-nowrap shrink-0";
        if (useLocale) {
          return (
            <Link key={href} href={href} className={linkClass}>
              {label}
            </Link>
          );
        }
        return (
          <NextLink key={href} href={href} className={linkClass}>
            {label}
          </NextLink>
        );
      })}
      </div>
    </header>
  );
}
