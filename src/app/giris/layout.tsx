import { ClientIntlBridge } from "@/components/ClientIntlBridge";
import { routing } from "@/i18n/routing";
import { loadMessagesWithEnFallback } from "@/i18n/load-messages";

/** `/giris` kök layout dışında; next-intl provider burada (köke headers() koymadan). */
export default async function GirisLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = routing.defaultLocale;
  const messages = await loadMessagesWithEnFallback(locale);
  return (
    <ClientIntlBridge locale={locale} messages={messages}>
      {children}
    </ClientIntlBridge>
  );
}
