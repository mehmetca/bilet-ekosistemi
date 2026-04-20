"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import NextLink from "next/link";
import { Ticket, User, LogIn, Menu, X, Globe, ChevronDown, ShoppingCart, Clock } from "lucide-react";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";
import { useCart } from "@/context/CartContext";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { stripLocalePrefixes } from "@/lib/i18n-pathname";

const navLinks = [
  { href: "/", labelKey: "nav.events" },
  { href: "/takvim", labelKey: "nav.calendar" },
  { href: "/sehirler", labelKey: "nav.cities" },
  { href: "/mekanlar", labelKey: "nav.venues" },
  { href: "/sanatci", labelKey: "nav.artists" },
];

const SUPPORTED_LOCALES = ["tr", "de", "en", "ku", "ckb"] as const;
const LOCALE_LABELS: Record<string, string> = {
  tr: "Türkçe",
  de: "Deutsch",
  en: "English",
  ku: "Kurmanci",
  ckb: "Soranî",
};
const LOCALE_FLAG_URLS: Record<string, string> = {
  tr: "https://flagcdn.com/w20/tr.png",
  de: "https://flagcdn.com/w20/de.png",
  en: "https://flagcdn.com/w20/gb.png",
  ku: "https://upload.wikimedia.org/wikipedia/commons/3/35/Flag_of_Kurdistan.svg",
  ckb: "https://upload.wikimedia.org/wikipedia/commons/3/35/Flag_of_Kurdistan.svg",
};

function withLocalePrefix(pathname: string, targetLocale: string): string {
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  if (normalizedPath === "/") return `/${targetLocale}`;
  return `/${targetLocale}${normalizedPath}`;
}

export default function Header() {
  const { user, isAdmin, isController, isOrganizer } = useSimpleAuth();
  const { totalItems, reservationExpiresAt } = useCart();
  const tCheckout = useTranslations("checkout");
  const [cartTick, setCartTick] = useState(0);
  useEffect(() => {
    if (!reservationExpiresAt || totalItems <= 0) return;
    const id = window.setInterval(() => setCartTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [reservationExpiresAt, totalItems]);
  const cartReserveSecLeft = useMemo(() => {
    if (!reservationExpiresAt || totalItems <= 0) return 0;
    return Math.max(0, Math.ceil((reservationExpiresAt - Date.now()) / 1000));
  }, [reservationExpiresAt, totalItems, cartTick]);
  const cartReserveStr =
    cartReserveSecLeft > 0
      ? `${Math.floor(cartReserveSecLeft / 60)}:${String(cartReserveSecLeft % 60).padStart(2, "0")}`
      : "";
  const hasManagementRole = isAdmin || isController || isOrganizer;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const langDropdownDesktopRef = useRef<HTMLDivElement>(null);
  const langDropdownMobileRef = useRef<HTMLDivElement>(null);
  // Alias for compatibility (fixes "langDropdownRef is not defined" on /sanatci)
  const langDropdownRef = langDropdownDesktopRef;
  const pathname = usePathname();
  /** Dil değiştiricide çift /de/de/ oluşmasın: pathname tek locale katmanına insin */
  const pathForLocaleSwitch = stripLocalePrefixes(pathname);
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();

  // Sayfa değiştiğinde mobil menüyü her zaman kapat (link tıklansa da tıklanmasa da)
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Dil dropdown dışına tıklanınca kapat
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      const insideDesktop = langDropdownDesktopRef.current?.contains(target);
      const insideMobile = langDropdownMobileRef.current?.contains(target);
      if (!insideDesktop && !insideMobile) setLangDropdownOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur pt-[env(safe-area-inset-top,0px)]">
      <div className="container mx-auto flex h-14 sm:h-16 items-center px-3 sm:px-4">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg sm:text-xl text-primary-600 shrink-0">
          <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-primary-600 text-white shrink-0">
            <Ticket className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <span className="hidden sm:inline">EventSeat</span>
          <span className="sm:hidden">EventSeat</span>
        </Link>

        {/* Masaüstü menü - ortada: nav + sepet + dil */}
        <nav className="hidden md:flex flex-1 justify-center items-center gap-6">
          {navLinks.map(({ href, labelKey }) => (
            <Link
              key={href}
              href={href}
              className="text-slate-600 hover:text-primary-600 font-medium transition-colors"
            >
              {t(labelKey)}
            </Link>
          ))}
          <div className="flex items-center gap-2">
            {cartReserveSecLeft > 0 && (
              <span
                className="hidden lg:inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-900"
                title={tCheckout("reservationTimer", { time: cartReserveStr })}
              >
                <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {cartReserveStr}
              </span>
            )}
            <NextLink
              href={`/${locale}/sepet`}
              className="relative flex items-center gap-1 text-slate-600 hover:text-primary-600 font-medium transition-colors"
            >
              <ShoppingCart className="h-5 w-5" />
              {totalItems > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary-600 text-[10px] font-bold text-white">
                  {totalItems > 9 ? "9+" : totalItems}
                </span>
              )}
            </NextLink>
          </div>
          <div className="relative" ref={langDropdownRef}>
            <button
              type="button"
              onClick={() => setLangDropdownOpen((o) => !o)}
              className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-primary-600 transition-colors"
              aria-label="Dil seç"
              aria-expanded={langDropdownOpen}
            >
              <Globe className="h-4 w-4" />
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${langDropdownOpen ? "rotate-180" : ""}`} />
            </button>
            {langDropdownOpen && (
              <div className="absolute right-0 top-full mt-1 py-1 min-w-[140px] bg-white rounded-lg border border-slate-200 shadow-lg z-50">
                {SUPPORTED_LOCALES.map((loc) => (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => {
                      router.replace(withLocalePrefix(pathForLocaleSwitch, loc));
                      setLangDropdownOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 transition-colors ${
                      locale === loc
                        ? "bg-primary-50 text-primary-700 font-medium"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <img
                      src={LOCALE_FLAG_URLS[loc]}
                      alt={`${LOCALE_LABELS[loc]} flag`}
                      className="h-4 w-5 rounded-[2px] object-cover"
                      loading="lazy"
                    />
                    <span className="text-slate-500">–</span>
                    <span>{LOCALE_LABELS[loc]}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </nav>
        {/* Sağ: Yönetim / Giriş / Bilgilerim */}
        <div className="hidden md:flex items-center shrink-0">
          {user ? (
            hasManagementRole ? (
              <NextLink
                href="/yonetim"
                className="flex items-center gap-2 text-slate-600 hover:text-primary-600 font-medium transition-colors"
              >
                <User className="h-4 w-4" />
                {t("nav.management")}
              </NextLink>
            ) : (
              <Link
                href="/panel"
                className="flex items-center gap-2 text-slate-600 hover:text-primary-600 font-medium transition-colors"
              >
                <User className="h-4 w-4" />
                {t("nav.myInfo")}
              </Link>
            )
          ) : (
            <NextLink
              href="/giris"
              className="flex items-center gap-2 text-slate-600 hover:text-primary-600 font-medium transition-colors"
            >
              <LogIn className="h-4 w-4" />
              {t("nav.login")} / {t("nav.signup")}
            </NextLink>
          )}
        </div>

        {/* Mobil: hamburger + açılır menü */}
        <div className="flex md:hidden items-center gap-2">
          {user && hasManagementRole && (
            <NextLink href="/yonetim" className="text-sm text-slate-500 hover:text-primary-600">
              {t("nav.admin")}
            </NextLink>
          )}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((o) => !o)}
            className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-primary-600 transition-colors"
            aria-label={mobileMenuOpen ? "Menüyü kapat" : "Menüyü aç"}
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobil açılır menü */}
      {mobileMenuOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
            aria-hidden
            onClick={(e) => {
              if (e.target === e.currentTarget) setMobileMenuOpen(false);
            }}
          />
          <nav
            className="absolute left-0 right-0 top-full z-50 flex flex-col gap-1 border-b border-slate-200 bg-white py-3 px-4 shadow-lg md:hidden"
            role="navigation"
          >
            {navLinks.map(({ href, labelKey }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileMenuOpen(false)}
                className="block rounded-lg px-4 py-3 text-slate-700 hover:bg-slate-100 hover:text-primary-600 font-medium"
              >
                {t(labelKey)}
              </Link>
            ))}
            <NextLink
              href={`/${locale}/sepet`}
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2 rounded-lg px-4 py-3 text-slate-700 hover:bg-slate-100 hover:text-primary-600 font-medium"
            >
              <ShoppingCart className="h-5 w-5" />
              Sepet {totalItems > 0 && `(${totalItems})`}
            </NextLink>
            <div className="relative px-4 py-2" ref={langDropdownMobileRef}>
              <button
                type="button"
                onClick={() => setLangDropdownOpen((o) => !o)}
                className="flex items-center gap-2 w-full rounded-lg px-4 py-3 text-slate-700 hover:bg-slate-100 hover:text-primary-600 font-medium"
              >
                <Globe className="h-4 w-4" />
                <span>{LOCALE_LABELS[locale] || locale.toUpperCase()}</span>
                <ChevronDown className={`h-3.5 w-3.5 ml-auto transition-transform ${langDropdownOpen ? "rotate-180" : ""}`} />
              </button>
              {langDropdownOpen && (
                <div className="mt-1 py-1 bg-white rounded-lg border border-slate-200 shadow-lg">
                  {SUPPORTED_LOCALES.map((loc) => (
                    <button
                      key={loc}
                      type="button"
                      onClick={() => {
                        router.replace(withLocalePrefix(pathForLocaleSwitch, loc));
                        setLangDropdownOpen(false);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 ${
                        locale === loc ? "bg-primary-50 text-primary-700 font-medium" : "hover:bg-slate-50"
                      }`}
                    >
                      <img
                        src={LOCALE_FLAG_URLS[loc]}
                        alt={`${LOCALE_LABELS[loc]} flag`}
                        className="h-4 w-5 rounded-[2px] object-cover"
                        loading="lazy"
                      />
                      <span className="text-slate-500">–</span>
                      <span>{LOCALE_LABELS[loc]}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {user ? (
              hasManagementRole ? (
                <NextLink
                  href="/yonetim"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2 rounded-lg px-4 py-3 text-slate-700 hover:bg-slate-100 hover:text-primary-600 font-medium"
                >
                  <User className="h-4 w-4" />
                  {t("nav.management")}
                </NextLink>
              ) : (
                <Link
                  href="/panel"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2 rounded-lg px-4 py-3 text-slate-700 hover:bg-slate-100 hover:text-primary-600 font-medium"
                >
                  <User className="h-4 w-4" />
                  {t("nav.myInfo")}
                </Link>
              )
            ) : (
              <NextLink
                href="/giris"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 rounded-lg px-4 py-3 text-slate-700 hover:bg-slate-100 hover:text-primary-600 font-medium"
              >
                <LogIn className="h-4 w-4" />
                {t("nav.login")} / {t("nav.signup")}
              </NextLink>
            )}
          </nav>
        </>
      )}
    </header>
  );
}
