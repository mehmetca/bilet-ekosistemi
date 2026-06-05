import type { Metadata } from "next";
import { Suspense } from "react";
import { resolvePublicImageUrl } from "@/lib/external-image";
import { buildHomeMetadata } from "@/lib/seo/home-metadata";
import { getHomeShellData } from "@/lib/home-page-data";
import { CRITICAL_HOME_CSS } from "@/lib/critical-home-css";
import { HomeSearchProvider } from "@/contexts/HomeSearchContext";
import Header from "@/components/Header";
import HomePageHero from "@/components/home/HomePageHero";
import HomePageMainFallback from "@/components/home/HomePageMainFallback";
import HomePageMain from "./HomePageMain";

type HomePageProps = {
  params: Promise<{ locale: string }>;
};

export const revalidate = 1800;

export async function generateMetadata({ params }: HomePageProps): Promise<Metadata> {
  const { locale } = await params;
  return buildHomeMetadata(locale);
}

export default async function HomePage({ params }: HomePageProps) {
  const { locale } = await params;
  let shell: Awaited<ReturnType<typeof getHomeShellData>> = {
    heroBackgrounds: [],
    cities: [],
    sliderAds: [],
  };

  try {
    shell = await getHomeShellData(locale);
  } catch (e) {
    console.error("HomePage getHomeShellData error:", e);
  }

  const lcpSrc = resolvePublicImageUrl(shell.heroBackgrounds[0]?.image_url);
  let lcpOrigin: string | null = null;
  try {
    lcpOrigin = lcpSrc ? new URL(lcpSrc).origin : null;
  } catch {
    lcpOrigin = null;
  }

  return (
    <HomeSearchProvider>
      <style id="critical-home" dangerouslySetInnerHTML={{ __html: CRITICAL_HOME_CSS }} />
      {lcpOrigin ? <link rel="preconnect" href={lcpOrigin} crossOrigin="anonymous" /> : null}
      <div className="min-h-screen bg-slate-50">
        <Header />
        <HomePageHero locale={locale} shell={shell} />
        <Suspense fallback={<HomePageMainFallback />}>
          <HomePageMain locale={locale} shell={shell} />
        </Suspense>
      </div>
    </HomeSearchProvider>
  );
}
