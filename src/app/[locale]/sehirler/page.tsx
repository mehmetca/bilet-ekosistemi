import { getCitiesWithEventCounts } from "@/lib/cities-server";
import Header from "@/components/Header";
import CitiesGrid from "./CitiesGrid";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import type { Locale } from "@/lib/i18n-content";
import { buildLocalePathMetadata } from "@/lib/seo/locale-path-metadata";

export const revalidate = 1800;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale?: string }>;
}): Promise<Metadata> {
  const { locale: locParam } = await params;
  const locale = locParam && routing.locales.includes(locParam as Locale)
    ? (locParam as Locale)
    : routing.defaultLocale;
  const t = await getTranslations({ locale, namespace: "cities" });
  return buildLocalePathMetadata(locale, "/sehirler", {
    title: `${t("title")} | KurdEvents`,
    description: t("subtitle"),
  });
}

export default async function SehirlerPage() {
  const cities = await getCitiesWithEventCounts();
  const t = await getTranslations("cities");

  return (
    <div className="min-h-screen bg-[#f5f6f8]">
      <Header />
      <div className="site-container py-12">
        <div className="mb-10 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900">{t("title")}</h1>
          <p className="mt-4 text-lg text-slate-600">{t("subtitle")}</p>
        </div>
        <CitiesGrid cities={cities} />
      </div>
    </div>
  );
}
