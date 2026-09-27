"use client";

import { useTranslations } from "next-intl";

export type AdminShellLabels = {
  events: string;
  calendar: string;
  artists: string;
  panel: string;
  openMenu: string;
};

/** Yönetim paneli her zaman Türkçe; üst bar site linkleri de TR kalır (public dile çevrilmez). */
export function useAdminShellLabels(): AdminShellLabels {
  const t = useTranslations("adminPanel.shell");
  return {
    events: t("events"),
    calendar: t("calendar"),
    artists: t("artists"),
    panel: t("panel"),
    openMenu: t("openMenu"),
  };
}
