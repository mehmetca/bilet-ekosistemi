import Header from "@/components/Header";
import EventCalendar from "@/components/EventCalendar";
import { getEventsForCalendar } from "@/lib/events-server";
import type { Metadata } from "next";
import { getTranslations, getLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import type { Locale } from "@/lib/i18n-content";
import { buildLocalePathMetadata } from "@/lib/seo/locale-path-metadata";

export const revalidate = 60;

const CALENDAR_DESCRIPTIONS: Record<Locale, string> = {
  tr: "Almanya'daki Kürt etkinlikleri, konserler ve tiyatro oyunlarını tarihe göre takvimde görün.",
  de: "Kurdische Veranstaltungen, Konzerte und Theater in Deutschland im Kalender nach Datum entdecken.",
  en: "Browse Kurdish events, concerts and theatre across Germany by date in the calendar.",
  ku: "Bûyer, konser û şanoyên kurdî li Almanyayê li gorî dîrokê di salnameyê de bibîne.",
  ckb: "بۆنە و کۆنسێرت و شانۆی کوردی لە ئەڵمانیا بەپێی بەروار لە ڕۆژژمێردا ببینە.",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale?: string }>;
}): Promise<Metadata> {
  const { locale: locParam } = await params;
  const locale = locParam && routing.locales.includes(locParam as Locale)
    ? (locParam as Locale)
    : routing.defaultLocale;
  const t = await getTranslations({ locale, namespace: "calendar" });
  return buildLocalePathMetadata(locale, "/takvim", {
    title: t("title"),
    description: CALENDAR_DESCRIPTIONS[locale],
  });
}

export default async function TakvimPage() {
  try {
    const events = await getEventsForCalendar();
    const t = await getTranslations("calendar");
    const locale = (await getLocale()) as Locale;

    return (
      <div className="min-h-screen bg-ink-50">
        <Header />
        
        <main className="site-container py-8">
          <div className="mb-8 text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900">{t("title")}</h1>
            <p className="mt-4 text-lg text-slate-600">{CALENDAR_DESCRIPTIONS[locale]}</p>
          </div>
          <EventCalendar events={events} />
        </main>

        {/* Footer */}
        <footer className="border-t border-ink-200 bg-white py-8 mt-16">
          <div className="site-container py-0 text-center text-sm text-ink-500">
            {new Date().getFullYear()} KurdEvents
          </div>
        </footer>
      </div>
    );
  } catch (error) {
    console.error("TakvimPage error:", error);
    return (
      <div className="min-h-screen bg-ink-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-ink-900 mb-4">Hata Oluştu</h1>
          <p className="text-ink-600">Takvim sayfası yüklenirken bir hata oluştu.</p>
        </div>
      </div>
    );
  }
}
