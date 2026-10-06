import { getTranslations } from "next-intl/server";
import { CheckCircle, Clock, Database, Shield } from "lucide-react";
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
  const tFooter = await getTranslations({ locale, namespace: "footer" });
  const first = shell.heroBackgrounds[0];
  const hasLcp = Boolean(first?.image_url);
  const lcpAlt = first?.title || "KurdEvents";

  return (
    <>
      <section className="hero-lcp-fold relative flex min-h-[min(100dvh,820px)] flex-col justify-center bg-ink-950 py-24 text-white md:min-h-screen md:py-28">
        <HomeHeroLcp imageUrl={first?.image_url} alt={lcpAlt} />
        <HeroBackgroundSlider
          initialBackgrounds={shell.heroBackgrounds}
          lcpImageRendered={hasLcp}
        />
        <div className="relative z-10 site-container">
          <div className="mx-auto max-w-2xl text-center md:mx-0 md:max-w-3xl md:text-left">
            <span className="eyebrow-light mb-5 block">{tFooter("siteName")}</span>
            <h1 className="break-words hyphens-auto">
              <span className="block font-display text-4xl font-semibold leading-[1.05] tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl">
                {t("heroTitle")}
              </span>
              <span className="rule-gold mx-auto my-6 md:mx-0 md:my-7 md:w-20" aria-hidden />
              <span className="block font-sans text-base font-medium leading-relaxed text-gold-300 sm:text-lg md:text-xl">
                {t("seoH1")}
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl whitespace-pre-line font-sans text-base leading-relaxed text-white/75 md:mx-0 md:mt-8 md:text-lg">
              {t("heroSubtitle")}
            </p>
            <HomeHeroControls />
          </div>
        </div>
      </section>

      {/* Hero'daki 4'lü ikon kutusu gridi yerine: tek satır, sessiz güven bandı. */}
      <section className="surface-ink border-t border-ink-800">
        <div className="site-container py-5">
          <ul className="m-0 flex list-none flex-wrap items-center justify-center gap-x-8 gap-y-3 p-0 md:justify-start">
            <li className="flex items-center gap-2.5">
              <CheckCircle className="h-4 w-4 shrink-0 text-gold-500" aria-hidden />
              <span className="text-[13px] font-medium text-ink-300">
                {t("trustBadges.verified")}
              </span>
            </li>
            <li className="flex items-center gap-2.5">
              <Clock className="h-4 w-4 shrink-0 text-gold-500" aria-hidden />
              <span className="text-[13px] font-medium text-ink-300">
                {t("trustBadges.delivery")}
              </span>
            </li>
            <li className="flex items-center gap-2.5">
              <Shield className="h-4 w-4 shrink-0 text-gold-500" aria-hidden />
              <span className="text-[13px] font-medium text-ink-300">
                {t("trustBadges.payment")}
              </span>
            </li>
            <li className="flex items-center gap-2.5">
              <Database className="h-4 w-4 shrink-0 text-gold-500" aria-hidden />
              <span className="text-[13px] font-medium text-ink-300">
                {t("trustBadges.inventory")}
              </span>
            </li>
          </ul>
        </div>
      </section>
    </>
  );
}
