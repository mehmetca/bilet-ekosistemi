import type { Metadata } from "next";
import { resolvePublicImageUrl } from "@/lib/external-image";
import { buildHomeMetadata } from "@/lib/seo/home-metadata";
import { getHomePageData } from "@/lib/home-page-data";
import { CRITICAL_HOME_CSS } from "@/lib/critical-home-css";
import ClientHomePage from "./ClientHomePage";
import HomeHeroLcp from "@/components/home/HomeHeroLcp";

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
  let data: Awaited<ReturnType<typeof getHomePageData>> = {
    heroBackgrounds: [],
    cities: [],
    sliderAds: [],
    events: [],
  };

  try {
    data = await getHomePageData(locale);
  } catch (e) {
    console.error("HomePage getHomePageData error:", e);
  }

  const lcpHero = resolvePublicImageUrl(data.heroBackgrounds[0]?.image_url);
  const lcpAlt = data.heroBackgrounds[0]?.title || "KurdEvents";

  return (
    <>
      <style id="critical-home" dangerouslySetInnerHTML={{ __html: CRITICAL_HOME_CSS }} />
      {lcpHero ? <link rel="preload" as="image" href={lcpHero} fetchPriority="high" /> : null}
      <ClientHomePage
        initialEvents={data.events}
        initialHeroBackgrounds={data.heroBackgrounds}
        initialCities={data.cities}
        initialSliderAds={data.sliderAds}
        heroLcpImage={
          <HomeHeroLcp imageUrl={data.heroBackgrounds[0]?.image_url} alt={lcpAlt} />
        }
        hasHeroLcpImage={!!lcpHero}
      />
    </>
  );
}
