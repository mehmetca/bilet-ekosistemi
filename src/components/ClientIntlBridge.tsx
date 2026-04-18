"use client";

import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";

/**
 * Kök layout bir Server Component olduğu için `next-intl` doğrudan import edildiğinde
 * `react-server` koşulunda async `NextIntlClientProviderServer` seçiliyor; bu da RSC
 * ön-render ile çakışıp 500 üretebiliyor. Provider'ı bu küçük client sarmalayıcıda tutmak
 * her zaman `index.react-client` yolunu kullanır.
 */
export function ClientIntlBridge({
  locale,
  messages,
  children,
}: {
  locale: string;
  messages: Record<string, unknown>;
  children: ReactNode;
}) {
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
