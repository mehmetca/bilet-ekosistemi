"use client";

import NextLink from "next/link";
import { Link } from "@/i18n/navigation";

const siteLinks = [
  { href: "/", label: "Etkinlikler", useLocale: true },
  { href: "/takvim", label: "Takvim", useLocale: true },
  { href: "/sanatci", label: "Sanatçılar", useLocale: true },
  { href: "/yonetim", label: "Yönetim Paneli", useLocale: false },
];

export default function AdminPolicyHeader() {
  return (
    <header className="sticky top-0 z-10 flex items-center justify-end gap-4 border-b border-slate-200 bg-white px-4 py-2 text-sm">
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
    </header>
  );
}
