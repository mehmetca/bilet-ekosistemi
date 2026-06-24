"use client";

import { useSyncExternalStore } from "react";
import { readPublicSiteLocaleFromCookie } from "@/lib/public-site-locale";
import { routing } from "@/i18n/routing";
import type { AppLocale } from "@/i18n/config";

function subscribe(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("focus", onStoreChange);
  return () => window.removeEventListener("focus", onStoreChange);
}

function getSnapshot(): AppLocale {
  return readPublicSiteLocaleFromCookie();
}

function getServerSnapshot(): AppLocale {
  return routing.defaultLocale;
}

/** Public site locale; yönetim paneli her zaman TR olsa bile çerezdeki dil korunur. */
export function usePublicSiteLocale(): AppLocale {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
