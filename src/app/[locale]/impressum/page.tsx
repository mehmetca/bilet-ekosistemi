import { redirect } from "next/navigation";

export default async function ImpressumRedirectPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const resolved = await params;
  const locale = resolved?.locale || "tr";
  redirect(`/${locale}/bilgilendirme/impressum`);
}
