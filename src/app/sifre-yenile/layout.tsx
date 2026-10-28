import { ClientIntlBridge } from "@/components/ClientIntlBridge";
import { routing } from "@/i18n/routing";
import { loadMessagesWithEnFallback } from "@/i18n/load-messages";

/** Locale öneksiz `/sifre-yenile` rotası root layout'ta next-intl provider görmez; `/giris` ile aynı kalıp. */
export default async function SifreYenileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = routing.defaultLocale;
  const messages = await loadMessagesWithEnFallback(locale);
  return <ClientIntlBridge locale={locale} messages={messages}>{children}</ClientIntlBridge>;
}
