"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { loadMessagesWithEnFallback } from "@/i18n/load-messages";
import { usePublicSiteLocale } from "@/hooks/usePublicSiteLocale";

export type AdminShellLabels = {
  events: string;
  calendar: string;
  artists: string;
  panel: string;
  openMenu: string;
};

const cache = new Map<string, AdminShellLabels>();

/** Üst bar site linkleri: public site dilinde; sol menü TR kalır. */
export function useAdminShellLabels(): AdminShellLabels {
  const publicLocale = usePublicSiteLocale();
  const fallback = useTranslations("adminPanel.shell");
  const [labels, setLabels] = useState<AdminShellLabels>(() => ({
    events: fallback("events"),
    calendar: fallback("calendar"),
    artists: fallback("artists"),
    panel: fallback("panel"),
    openMenu: fallback("openMenu"),
  }));

  useEffect(() => {
    const cached = cache.get(publicLocale);
    if (cached) {
      setLabels(cached);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const messages = await loadMessagesWithEnFallback(publicLocale);
        const shell = (messages as { adminPanel?: { shell?: Partial<AdminShellLabels> } }).adminPanel?.shell;
        if (!shell || cancelled) return;

        const next: AdminShellLabels = {
          events: shell.events ?? labels.events,
          calendar: shell.calendar ?? labels.calendar,
          artists: shell.artists ?? labels.artists,
          panel: shell.panel ?? labels.panel,
          openMenu: shell.openMenu ?? labels.openMenu,
        };
        cache.set(publicLocale, next);
        setLabels(next);
      } catch {
        // TR fallback from parent provider
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [publicLocale]);

  return labels;
}
