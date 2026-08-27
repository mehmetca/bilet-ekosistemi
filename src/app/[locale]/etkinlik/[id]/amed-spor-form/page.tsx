import { notFound } from "next/navigation";
import AmedSporFormClient from "./AmedSporFormClient";
import { getEventBySlug, getEventTickets } from "@/lib/events-server";
import { routing } from "@/i18n/routing";
import { getLocalizedEvent, type Locale } from "@/lib/i18n-content";

interface PageProps {
  params: Promise<{ locale?: string; id: string }>;
}

export const revalidate = 300;

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
