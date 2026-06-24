"use client";

import { useEffect, useState } from "react";
import { ClientIntlBridge } from "@/components/ClientIntlBridge";

/** Yönetim paneli her zaman Türkçe; site dili /de vb. olsa bile menü ve çeviriler tutarlı kalır. */
const YONETIM_LOCALE = "tr";

/**
 * `/yonetim` layout'u sunucuda `headers()` kullanmadan i18n sağlar — force-dynamic gerekmez.
 */
export default function YonetimIntlProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { loadMessagesWithEnFallback } = await import("@/i18n/load-messages");
        const loaded = await loadMessagesWithEnFallback(YONETIM_LOCALE);
        if (!cancelled) setMessages(loaded as Record<string, unknown>);
      } catch {
        if (!cancelled) {
          try {
            const tr = (await import("../../../messages/tr.json")).default;
            if (!cancelled) setMessages(tr as Record<string, unknown>);
          } catch {
            if (!cancelled) {
              setMessages({ common: { backToHome: "Ana Sayfaya Dön" }, home: { heroTitle: "KurdEvents" } });
            }
          }
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!messages) {
    return <div className="min-h-screen bg-slate-50" aria-busy="true" />;
  }

  return (
    <ClientIntlBridge locale={YONETIM_LOCALE} messages={messages}>
      {children}
    </ClientIntlBridge>
  );
}
