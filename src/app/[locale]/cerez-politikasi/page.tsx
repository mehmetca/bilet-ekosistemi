import { redirect } from "next/navigation";

export default async function CerezPolitikasiRedirectPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const resolved = await params;
  const locale = resolved?.locale || "tr";
  redirect(`/${locale}/bilgilendirme/cerez-politikasi`);
}
