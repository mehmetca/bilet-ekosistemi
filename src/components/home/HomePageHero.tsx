import { getTranslations } from "next-intl/server";
import HeroBackgroundSlider from "@/components/HeroBackgroundSlider";
import HomeHeroControls from "@/components/home/HomeHeroControls";
import HomeHeroLcp from "@/components/home/HomeHeroLcp";
import type { HomeShellData } from "@/lib/home-page-data";

type HomePageHeroProps = {
  locale: string;
  shell: HomeShellData;
};

/** Hero — tamamen sunucuda boyanır; LCP img + h1 client JS beklemez. */
export default async function HomePageHero({ locale, shell }: HomePageHeroProps) {
  const t = await getTranslations({ locale, namespace: "home" });
  const first = shell.heroBackgrounds[0];
  const hasLcp = Boolean(first?.image_url);
  const lcpAlt = first?.title || "KurdEvents";

  return (
    <section className="hero-lcp-fold relative min-h-[min(100dvh,820px)] bg-slate-950 text-white py-20 md:min-h-screen">
      <HomeHeroLcp imageUrl={first?.image_url} alt={lcpAlt} />
      <HeroBackgroundSlider
        initialBackgrounds={shell.heroBackgrounds}
        lcpImageRendered={hasLcp}
      />
      <div className="relative z-10 site-container text-center">
        <h1 className="mb-6 px-1 text-white break-words hyphens-auto">
          <span className="block text-3xl font-bold sm:text-4xl md:text-6xl">{t("heroTitle")}</span>
          <span className="mt-3 block text-lg font-semibold leading-snug text-white/95 sm:text-xl md:text-2xl">
            {t("seoH1")}
          </span>
        </h1>
        <p className="text-base sm:text-lg md:text-xl text-white mb-8 sm:mb-12 max-w-3xl mx-auto px-1 whitespace-pre-line">
          {t("heroSubtitle")}
        </p>
        <HomeHeroControls />
      </div>
    </section>
  );
}
