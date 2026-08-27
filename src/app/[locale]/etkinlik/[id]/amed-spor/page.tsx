import { redirect } from "next/navigation";
import { routing } from "@/i18n/routing";

interface PageProps {
  params: Promise<{ locale?: string; id: string }>;
}

export default async function AmedSporCheckoutPage({ params }: PageProps) {
  const { id, locale: locParam } = await params;
  const locale = locParam && routing.locales.includes(locParam as (typeof routing.locales)[number]) ? locParam : routing.defaultLocale;

  // Normal etkinlik detay sayfasına yönlendir
  redirect(`/${locale}/etkinlik/${id}`);
}