import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { ClientIntlBridge } from "@/components/ClientIntlBridge";
import Footer from "@/components/Footer";

/**
 * Dil değişimi (client navigasyon) kök layout’taki provider’ı güncellemediği için
 * locale segmentine bağlı mesajlar burada verilir; iç provider üsttekini geçersiz kılar.
 */
export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }> | { locale: string };
}) {
  const resolved = "then" in params ? await params : params;
  const locale = resolved?.locale || routing.defaultLocale;
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }
  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <ClientIntlBridge locale={locale} messages={messages as Record<string, unknown>}>
      {children}
      <Footer />
    </ClientIntlBridge>
  );
}
