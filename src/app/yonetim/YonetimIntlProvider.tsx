"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ClientIntlBridge } from "@/components/ClientIntlBridge";
import { routing } from "@/i18n/routing";

function localeFromPathname(pathname: string | null): string {
  const match = pathname?.match(/^\/(tr|de|en|ku|ckb)(?:\/|$)/)?.[1];
  if (match && routing.locales.includes(match as (typeof routing.locales)[number])) {
    return match;
  }
  return routing.defaultLocale;
}

/**
 * `/yonetim` layout'u sunucuda `headers()` kullanmadan i18n sağlar — force-dynamic gerekmez.
 */
export default function YonetimIntlProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const locale = localeFromPathname(pathname);
  const [messages, setMessages] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { loadMessagesWithEnFallback } = await import("@/i18n/load-messages");
        const loaded = await loadMessagesWithEnFallback(locale);
        if (!cancelled) setMessages(loaded as Record<string, unknown>);
      } catch {
        if (!cancelled) {
          try {
            const en = (await import("../../../messages/en.json")).default;
            if (!cancelled) setMessages(en as Record<string, unknown>);
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
  }, [locale]);

  if (!messages) {
    return <div className="min-h-screen bg-slate-50" aria-busy="true" />;
  }

  return (
    <ClientIntlBridge locale={locale} messages={messages}>
      {children}
    </ClientIntlBridge>
  );
}
