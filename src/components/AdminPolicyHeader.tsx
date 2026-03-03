"use client";

import Link from "next/link";

const siteLinks = [
  { href: "/", label: "Etkinlikler" },
  { href: "/takvim", label: "Takvim" },
  { href: "/sanatci", label: "Sanatçılar" },
  { href: "/yonetim", label: "Yönetim Paneli" },
];

export default function AdminPolicyHeader() {
  return (
    <header className="sticky top-0 z-10 flex items-center justify-end gap-4 border-b border-slate-200 bg-white px-4 py-2 text-sm">
      {siteLinks.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          className="text-slate-600 hover:text-primary-600"
        >
          {label}
        </Link>
      ))}
    </header>
  );
}
