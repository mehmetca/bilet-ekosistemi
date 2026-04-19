import YonetimClientLayout from "./YonetimClientLayout";
import { ClientIntlBridge } from "@/components/ClientIntlBridge";
import { headers } from "next/headers";
import { routing } from "@/i18n/routing";

export const dynamic = "force-dynamic";

const LOCALES = ["tr", "de", "en", "ku", "ckb"] as const;

/**
 * `/yonetim` kök layout’un `[locale]` dışında olduğu için bazı isteklerde kökteki
 * ClientIntlBridge atlanabiliyor; next-intl `Link` (AdminPolicyHeader) için burada
 * mutlaka NextIntlClientProvider sağlanır.
 */
export default async function YonetimLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let validLocale = routing.defaultLocale as (typeof LOCALES)[number];
  let messages: Record<string, unknown> = {};

  try {
    const headersList = await headers();
    let locale = (headersList.get("x-next-intl-locale") ||
      headersList.get("X-NEXT-INTL-LOCALE") ||
      routing.defaultLocale) as string;
    const pathname = headersList.get("x-pathname") || "";
    const pathLocale = pathname.match(/^\/(tr|de|en|ku|ckb)(?:\/|$)/)?.[1];
    if (pathLocale && LOCALES.includes(pathLocale as (typeof LOCALES)[number])) {
      locale = pathLocale;
    }
    validLocale = LOCALES.includes(locale as (typeof LOCALES)[number])
      ? (locale as (typeof LOCALES)[number])
      : routing.defaultLocale;
    if (!pathLocale) {
      messages = (await import(`../../../messages/${validLocale}.json`)).default;
    }
  } catch (e) {
    console.error("YonetimLayout locale/messages load error:", e);
  }

  if (Object.keys(messages).length === 0) {
    try {
      messages = (await import(`../../../messages/${validLocale}.json`)).default;
    } catch {
      try {
        messages = (await import("../../../messages/tr.json")).default;
      } catch {
        messages = { common: { backToHome: "Ana Sayfaya Dön" }, home: { heroTitle: "EventSeat" } };
      }
    }
  }

  return (
    <ClientIntlBridge locale={validLocale} messages={messages}>
      <YonetimClientLayout>{children}</YonetimClientLayout>
    </ClientIntlBridge>
  );
}
