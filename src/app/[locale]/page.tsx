import type { Metadata } from "next";
import { Suspense } from "react";
import { resolvePublicImageUrl } from "@/lib/external-image";
import { buildHomeMetadata } from "@/lib/seo/home-metadata";
import { getHomeShellData } from "@/lib/home-page-data";
import HomePageWithEvents, { HomePageShell } from "./HomePageWithEvents";

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

  const lcpHero = resolvePublicImageUrl(shell.heroBackgrounds[0]?.image_url);

  return (
    <>
      {lcpHero ? <link rel="preload" as="image" href={lcpHero} fetchPriority="high" /> : null}
      <Suspense
        fallback={<HomePageShell locale={locale} shell={shell} initialEvents={[]} />}
      >
        <HomePageWithEvents locale={locale} shell={shell} />
      </Suspense>
    </>
  );
}
