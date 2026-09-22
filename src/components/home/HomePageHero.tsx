import { getTranslations } from "next-intl/server";
import HeroBackgroundSlider from "@/components/HeroBackgroundSlider";
import HomeHeroControls from "@/components/home/HomeHeroControls";
import HomeHeroLcp from "@/components/home/HomeHeroLcp";
import type { HomeShellData } from "@/lib/home-page-data";
import Image from "next/image";

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
        {/* Küçük Logo ve Açıklama */}
        <div className="flex flex-col items-center justify-center mb-8">
          <div className="mb-4">
            <Image
              src="/images/kurdevent-logo.png"
              alt="KurdEvents Logo"
              width={60}
              height={60}
              className="rounded-lg shadow-lg bg-white/10 backdrop-blur-sm p-2"
            />
          </div>
          <p className="text-sm text-white/80 max-w-md px-4 py-2 bg-black/30 backdrop-blur-sm rounded-lg">
            {locale === 'tr' && 'Tiyatro ve etkinlik biletleri güvenle satın'}
            {locale === 'de' && 'Theater- und Event-Tickets sicher kaufen'}
            {locale === 'en' && 'Buy theater and event tickets securely'}
            {locale === 'ku' && 'بلیتە و ڕاوەنەت بە سەرتی بە کڕەی'}
            {locale === 'ckb' && 'بلیتە و ڕاوەنەت بە سەرتی بە کڕەی'}
          </p>
        </div>

        <h1 className="mb-6 px-1 text-white break-words hyphens-auto">
          <span className="block text-2xl font-bold sm:text-3xl md:text-5xl">{t("heroTitle")}</span>
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
