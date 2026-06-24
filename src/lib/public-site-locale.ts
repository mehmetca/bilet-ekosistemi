import { routing } from "@/i18n/routing";
import type { AppLocale } from "@/i18n/config";

/** Ziyaretçinin public sitede seçtiği dil (next-intl `NEXT_LOCALE` çerezi). */
export function readPublicSiteLocaleFromCookie(): AppLocale {
  if (typeof document === "undefined") {
    return routing.defaultLocale;
  }

  const match = document.cookie.match(/(?:^|;\s*)NEXT_LOCALE=([^;]*)/);
  const raw = match?.[1] ? decodeURIComponent(match[1]).trim() : "";
  if (raw && (routing.locales as readonly string[]).includes(raw)) {
    return raw as AppLocale;
  }

  return routing.defaultLocale;
}
