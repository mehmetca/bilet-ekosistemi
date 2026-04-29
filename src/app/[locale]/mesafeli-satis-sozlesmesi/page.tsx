import { redirect } from "next/navigation";

export default async function MesafeliSatisRedirectPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const resolved = await params;
  const locale = resolved?.locale || "tr";
  redirect(`/${locale}/bilgilendirme/mesafeli-satis-sozlesmesi`);
}
