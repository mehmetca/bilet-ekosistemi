import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import type { Locale } from "@/lib/i18n-content";
import { buildLocalePathMetadata } from "@/lib/seo/locale-path-metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale?: string }>;
}): Promise<Metadata> {
  const { locale: locParam } = await params;
  const locale = locParam && routing.locales.includes(locParam as Locale)
    ? (locParam as Locale)
    : routing.defaultLocale;
  const t = await getTranslations({ locale, namespace: "organizerApplication" });
  return buildLocalePathMetadata(locale, "/organizator-basvuru", {
    title: t("title"),
    description: t("subtitle"),
  });
}

export default function OrganizerApplicationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
