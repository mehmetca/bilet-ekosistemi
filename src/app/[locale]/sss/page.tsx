import { redirect } from "next/navigation";

export default async function SSSRedirectPage({
  params,
}: {
  params: Promise<{ locale: string }> | { locale: string };
}) {
  const resolved = "then" in params ? await params : params;
  const locale = resolved?.locale || "tr";
  redirect(`/${locale}/bilgilendirme/sss`);
}
