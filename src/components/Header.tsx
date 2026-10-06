"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import NextLink from "next/link";
import { Ticket, User, LogIn, Menu, X, Globe, ChevronDown, ShoppingCart, Clock } from "lucide-react";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";
import { useCart } from "@/context/CartContext";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { stripLocalePrefixes } from "@/lib/i18n-pathname";
import { buttonClass } from "@/components/ui/Button";
import { badgeClass } from "@/components/ui/Badge";
import { cn } from "@/components/ui/cn";

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

function navHref(locale: string, href: string): string {
  return withLocalePrefix(href, locale);
}

/** Aktif menü öğesi (altın gösterge) — locale öneki soyulmuş pathname ile karşılaştırır. */
function isActiveNavLink(strippedPathname: string, href: string): boolean {
  const current = (strippedPathname || "/").replace(/\/+$/, "") || "/";
  return current === href;
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
    <header className="sticky top-0 z-50 border-b border-ink-200 bg-paper/95 backdrop-blur pt-[env(safe-area-inset-top,0px)]">
      <div className="site-container flex h-[60px] sm:h-[68px] items-center justify-between">

<NextLink
  href={navHref(locale, "/")}
  className="flex h-11 shrink-0 items-center gap-2 sm:h-[52px] w-[160px] sm:w-[180px] md:w-[168px]"
>
  <img
    src="/images/kurdevent-logo.png"
    alt="Kurdevent Logo"
    width={160}
    height={50}
    className="h-auto w-full"
    style={{ width: "100%", height: "auto" }}
    fetchPriority="high"
    decoding="async"
  />
</NextLink>




               {/* Masaüstü menü - ortada: nav + sepet + dil */}
        <nav className="hidden md:flex flex-1 justify-center items-center gap-6">
          {navLinks.map(({ href, labelKey }) => {
            const active = isActiveNavLink(pathForLocaleSwitch, href);
            return (
              <NextLink
                key={href}
                href={navHref(locale, href)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative py-1 font-medium tracking-tight transition-colors",
                  "after:absolute after:inset-x-0 after:-bottom-0.5 after:h-0.5 after:origin-left after:bg-gold-500 after:transition-transform after:duration-200",
                  active
                    ? "text-ink-900 after:scale-x-100"
                    : "text-ink-700 after:scale-x-0 hover:text-ink-900 hover:after:scale-x-100"
                )}
              >
                {t(labelKey)}
              </NextLink>
            );
          })}
          <div className="flex items-center gap-2">
            {cartReserveSecLeft > 0 && (
              <span
                className={badgeClass("success", "hidden gap-1.5 lg:inline-flex")}
                title={tCheckout("reservationTimer", { time: cartReserveStr })}
              >
                <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {cartReserveStr}
              </span>
            )}
            <NextLink
              href={`/${locale}/sepet`}
              prefetch={false}
              className="relative flex h-11 items-center gap-1 rounded-md px-1 font-medium text-ink-700 transition-colors hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500/70"
            >
              <ShoppingCart className="h-5 w-5" />
              {totalItems > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-gold-500 text-[10px] font-bold text-ink-950">
                  {totalItems > 9 ? "9+" : totalItems}
                </span>
              )}
            </NextLink>
          </div>
          <div className="relative" ref={langDropdownRef}>
            <button
              type="button"
              onClick={() => setLangDropdownOpen((o) => !o)}
              className={buttonClass({ variant: "ghost", size: "sm", className: "h-11" })}
              aria-label="Dil seç"
              aria-expanded={langDropdownOpen}
            >
              <Globe className="h-5 w-5" />
              <ChevronDown className={`h-4 w-4 transition-transform ${langDropdownOpen ? "rotate-180" : ""}`} />
            </button>
            {langDropdownOpen && (
              <div className="absolute right-0 top-full z-50 mt-1.5 min-w-[150px] overflow-hidden rounded-md border border-ink-200 bg-paper py-1 shadow-lift">
                {SUPPORTED_LOCALES.map((loc) => (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => {
                      router.replace(withLocalePrefix(pathForLocaleSwitch, loc));
                      setLangDropdownOpen(false);
                    }}
                    aria-current={locale === loc ? "true" : undefined}
                    className={cn(
                      "flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gold-500/70",
                      locale === loc
                        ? "bg-gold-50 font-semibold text-gold-900"
                        : "text-ink-700 hover:bg-ink-100 hover:text-ink-900"
                    )}
                  >
                    <img
                      src={LOCALE_FLAG_URLS[loc]}
                      alt={`${LOCALE_LABELS[loc]} flag`}
                      className="h-4 w-5 rounded-[2px] object-cover"
                      loading="lazy"
                    />
                    <span className="text-ink-400" aria-hidden>–</span>
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
                className={buttonClass({ variant: "ghost", size: "sm" })}
              >
                <User className="h-4 w-4" />
                {t("nav.management")}
              </NextLink>
            ) : (
              <NextLink
                href={navHref(locale, "/panel")}
                className={buttonClass({ variant: "ghost", size: "sm" })}
              >
                <User className="h-4 w-4" />
                {t("nav.myInfo")}
              </NextLink>
            )
          ) : (
            <NextLink
              href={navHref(locale, "/giris")}
              className={buttonClass({ variant: "gold", size: "sm" })}
            >
              <LogIn className="h-4 w-4" />
              {t("nav.login")} / {t("nav.signup")}
            </NextLink>
          )}
        </div>

        {/* Mobil: hamburger + açılır menü */}
        <div className="flex md:hidden items-center gap-2 ml-auto">
          {user && hasManagementRole && (
            <NextLink
              href="/yonetim"
              className={buttonClass({ variant: "ghost", size: "sm", className: "h-11" })}
            >
              {t("nav.admin")}
            </NextLink>
          )}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((o) => !o)}
            className={buttonClass({ variant: "ghost", size: "sm", className: "h-11" })}
            aria-label={mobileMenuOpen ? "Menüyü kapat" : "Menüyü aç"}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobil açılır menü */}
      {mobileMenuOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-ink-950/50 md:hidden"
            aria-hidden
            onClick={(e) => {
              if (e.target === e.currentTarget) setMobileMenuOpen(false);
            }}
          />
          <nav
            className="absolute left-0 right-0 top-full z-50 flex flex-col gap-1 border-b border-ink-200 bg-paper px-4 py-3 shadow-lift md:hidden"
            role="navigation"
          >
            {navLinks.map(({ href, labelKey }) => {
              const active = isActiveNavLink(pathForLocaleSwitch, href);
              return (
                <NextLink
                  key={href}
                  href={navHref(locale, href)}
                  onClick={() => setMobileMenuOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 items-center gap-2 rounded-md px-4 py-3 font-medium transition-colors",
                    active
                      ? "bg-gold-50 text-gold-900"
                      : "text-ink-700 hover:bg-ink-100 hover:text-ink-900"
                  )}
                >
                  {t(labelKey)}
                </NextLink>
              );
            })}
            <NextLink
              href={`/${locale}/sepet`}
              prefetch={false}
              onClick={() => setMobileMenuOpen(false)}
              className="flex min-h-11 items-center gap-2 rounded-md px-4 py-3 font-medium text-ink-700 transition-colors hover:bg-ink-100 hover:text-ink-900"
            >
              <ShoppingCart className="h-5 w-5" />
              Sepet {totalItems > 0 && `(${totalItems})`}
            </NextLink>

            <span className="hairline my-2" aria-hidden />

            <div className="relative px-4 py-1" ref={langDropdownMobileRef}>
              <button
                type="button"
                onClick={() => setLangDropdownOpen((o) => !o)}
                aria-expanded={langDropdownOpen}
                className="flex min-h-11 w-full items-center gap-2 rounded-md px-4 py-3 font-medium text-ink-700 transition-colors hover:bg-ink-100 hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500/70"
              >
                <Globe className="h-5 w-5" />
                <span>{LOCALE_LABELS[locale] || locale.toUpperCase()}</span>
                <ChevronDown className={`ml-auto h-4 w-4 transition-transform ${langDropdownOpen ? "rotate-180" : ""}`} />
              </button>
              {langDropdownOpen && (
                <div className="mt-1 overflow-hidden rounded-md border border-ink-200 bg-white py-1 shadow-card">
                  {SUPPORTED_LOCALES.map((loc) => (
                    <button
                      key={loc}
                      type="button"
                      onClick={() => {
                        router.replace(withLocalePrefix(pathForLocaleSwitch, loc));
                        setLangDropdownOpen(false);
                        setMobileMenuOpen(false);
                      }}
                      aria-current={locale === loc ? "true" : undefined}
                      className={cn(
                        "flex min-h-11 w-full items-center gap-2 px-4 py-2.5 text-left text-sm transition-colors",
                        locale === loc
                          ? "bg-gold-50 font-semibold text-gold-900"
                          : "text-ink-700 hover:bg-ink-100 hover:text-ink-900"
                      )}
                    >
                      <img
                        src={LOCALE_FLAG_URLS[loc]}
                        alt={`${LOCALE_LABELS[loc]} flag`}
                        className="h-4 w-5 rounded-[2px] object-cover"
                        loading="lazy"
                      />
                      <span className="text-ink-400" aria-hidden>–</span>
                      <span>{LOCALE_LABELS[loc]}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <span className="hairline my-2" aria-hidden />

            {user ? (
              hasManagementRole ? (
                <NextLink
                  href="/yonetim"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex min-h-11 items-center gap-2 rounded-md px-4 py-3 font-medium text-ink-700 transition-colors hover:bg-ink-100 hover:text-ink-900"
                >
                  <User className="h-4 w-4" />
                  {t("nav.management")}
                </NextLink>
              ) : (
                <NextLink
                  href={navHref(locale, "/panel")}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex min-h-11 items-center gap-2 rounded-md px-4 py-3 font-medium text-ink-700 transition-colors hover:bg-ink-100 hover:text-ink-900"
                >
                  <User className="h-4 w-4" />
                  {t("nav.myInfo")}
                </NextLink>
              )
            ) : (
              <NextLink
                href={navHref(locale, "/giris")}
                onClick={() => setMobileMenuOpen(false)}
                className="flex min-h-11 items-center gap-2 rounded-md px-4 py-3 font-medium text-ink-700 transition-colors hover:bg-ink-100 hover:text-ink-900"
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
