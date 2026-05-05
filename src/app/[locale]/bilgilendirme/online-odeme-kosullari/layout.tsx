import type { Metadata } from "next";
import { buildBilgilendirmePageMetadata } from "@/lib/seo/bilgilendirme-metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return buildBilgilendirmePageMetadata(locale, "/bilgilendirme/online-odeme-kosullari", "onlinePayment");
}

export default function OnlineOdemeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
