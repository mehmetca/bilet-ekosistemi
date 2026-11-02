import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import AmedSporFormClient from "./AmedSporFormClient";
import { getEventBySlug, getEventTickets } from "@/lib/events-server";
import { isEventPast } from "@/lib/event-time";
import { routing } from "@/i18n/routing";
import { getLocalizedEvent, type Locale } from "@/lib/i18n-content";

interface PageProps {
  params: Promise<{ locale?: string; id: string }>;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps) {
  const { id, locale: locParam } = await params;
  const locale = locParam && routing.locales.includes(locParam as Locale) ? locParam : routing.defaultLocale;

  const slugResult = await getEventBySlug(id);
  const event = slugResult?.event;

  if (!event) {
    return {
      title: "Etkinlik Bulunamadı",
      robots: { index: false, follow: true },
    };
  }

  const localized = getLocalizedEvent(event as unknown as Record<string, unknown>, locale as Locale);

  return {
    title: `${localized.title} - Form`,
    description: localized.description?.substring(0, 160),
  };
}

export default async function AmedSporFormPage({ params }: PageProps) {
  const { id, locale: locParam } = await params;
  const locale = locParam && routing.locales.includes(locParam as Locale) ? locParam : routing.defaultLocale;

  const slugResult = await getEventBySlug(id);

  if (!slugResult?.event) {
    notFound();
  }

  const { event } = slugResult;

  if (isEventPast(event.date, event.time)) {
    const t = await getTranslations({ locale, namespace: "eventDetail" });
    return (
      <div className="site-container py-16">
        <p className="rounded-lg border border-red-200 bg-red-50 p-6 text-center text-sm font-medium text-red-700">
          {t("eventEnded")}
        </p>
      </div>
    );
  }

  const localized = getLocalizedEvent(event as unknown as Record<string, unknown>, locale as Locale);
  
  const tickets = await getEventTickets(event.id);

  return (
    <AmedSporFormClient
      event={event}
      locale={locale}
      localized={localized}
      tickets={tickets}
    />
  );
}
