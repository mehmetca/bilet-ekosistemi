import HeroBackgroundSlider from "@/components/HeroBackgroundSlider";

type HeroBg = {
  id: string;
  title: string;
  image_url: string;
  is_active: boolean;
  sort_order: number;
  transition_duration: number;
};

type HomeHeroBackgroundsProps = {
  backgrounds: HeroBg[];
};

/** Sunucuda çizilen hero arka planı — mobil LCP için kritik. */
export default function HomeHeroBackgrounds({ backgrounds }: HomeHeroBackgroundsProps) {
  const lcpImage = backgrounds[0]?.image_url;
  const lcpAlt = backgrounds[0]?.title || "KurdEvents";

  return (
    <>
      {lcpImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={lcpImage}
          alt={lcpAlt}
          fetchPriority="high"
          loading="eager"
          decoding="async"
          className="absolute inset-0 z-0 h-full w-full object-cover"
        />
      ) : null}
      <HeroBackgroundSlider
        initialBackgrounds={backgrounds}
        lcpImageRendered={!!lcpImage}
      />
    </>
  );
}
