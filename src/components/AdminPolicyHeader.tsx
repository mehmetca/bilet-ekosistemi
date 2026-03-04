"use client";

import NextLink from "next/link";
import { Link } from "@/i18n/navigation";
import { Menu } from "lucide-react";

const siteLinks = [
  { href: "/", label: "Etkinlikler", useLocale: true },
  { href: "/takvim", label: "Takvim", useLocale: true },
  { href: "/sanatci", label: "Sanatçılar", useLocale: true },
  { href: "/yonetim", label: "Yönetim Paneli", useLocale: false },
];

export default function AdminPolicyHeader({ onMenuClick }: { onMenuClick?: () => void }) {
  return (
    <header className={`sticky top-0 z-10 flex items-center gap-4 border-b border-slate-200 bg-white px-4 py-2 text-sm ${onMenuClick ? "justify-between" : "justify-end"} md:justify-end`}>
      {onMenuClick && (
        <button
          type="button"
          onClick={onMenuClick}
          className="md:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
          aria-label="Menüyü aç"
        >
          <Menu className="h-5 w-5" />
        </button>
      )}
      <div className="flex items-center gap-4">
      {siteLinks.map(({ href, label, useLocale }) => {
        const linkClass = "text-slate-600 hover:text-primary-600";
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
