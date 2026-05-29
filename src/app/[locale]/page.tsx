import type { Metadata } from "next";
import { Suspense } from "react";
import {
  getResponsivePublicImageSrcSet,
  getResponsivePublicImageUrl,
  resolvePublicImageUrl,
} from "@/lib/external-image";
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

export const revalidate = 60;

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

  const firstHeroImage = shell.heroBackgrounds[0]?.image_url;
  const lcpSrc = getResponsivePublicImageUrl(firstHeroImage, 1280, 75) ?? resolvePublicImageUrl(firstHeroImage);
  const lcpSrcSet = getResponsivePublicImageSrcSet(firstHeroImage, [640, 960, 1280, 1920], 75);
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
      {lcpSrc ? (
        <link
          rel="preload"
          as="image"
          href={lcpSrc}
          imageSrcSet={lcpSrcSet}
          imageSizes="100vw"
          fetchPriority="high"
        />
      ) : null}
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
