"use client";

import { useEffect } from "react";

/**
 * Bazı tarayıcı/Next kombinasyonlarında hard refresh sonrası yanlış scroll pozisyonu
 * (ör. sayfa sonu) geri yüklenebiliyor. Sadece "reload" navigasyonunda başa alır.
 */
export default function ScrollResetOnReload() {
  useEffect(() => {
    const navEntries = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
    const navType = navEntries[0]?.type;
    const legacyType = (performance as Performance & { navigation?: { type?: number } }).navigation?.type;
    const isReload = navType === "reload" || legacyType === 1;

    if (!isReload) return;

    const jumpTop = () => window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    jumpTop();
    requestAnimationFrame(jumpTop);
    setTimeout(jumpTop, 60);
  }, []);

  return null;
}

