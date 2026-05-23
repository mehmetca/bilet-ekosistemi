import ClientHomePage from "./ClientHomePage";
import HomeHeroLcp from "@/components/home/HomeHeroLcp";
import { resolvePublicImageUrl } from "@/lib/external-image";
import { getHomeEvents, getHomeShellData, sortHomeCities } from "@/lib/home-page-data";
import type { Event } from "@/types/database";

type Props = {
  locale: string;
  shell: Awaited<ReturnType<typeof getHomeShellData>>;
};

/** Suspense içinde: etkinlikler yüklenince tam liste ile ClientHomePage. */
export default async function HomePageWithEvents({ locale, shell }: Props) {
  const events = await getHomeEvents(locale);
  const cities = sortHomeCities(shell.cities, events);
  const lcpHero = resolvePublicImageUrl(shell.heroBackgrounds[0]?.image_url);
  const lcpAlt = shell.heroBackgrounds[0]?.title || "KurdEvents";

  return (
    <ClientHomePage
      initialEvents={events}
      initialHeroBackgrounds={shell.heroBackgrounds}
      initialCities={cities}
      initialSliderAds={shell.sliderAds}
      heroLcpImage={
        <HomeHeroLcp imageUrl={shell.heroBackgrounds[0]?.image_url} alt={lcpAlt} />
      }
      hasHeroLcpImage={!!lcpHero}
    />
  );
}

export type HomePageShellProps = {
  locale: string;
  shell: Awaited<ReturnType<typeof getHomeShellData>>;
  initialEvents?: Event[];
};

/** Hemen stream: hero + boş/önceden gelen etkinlik listesi. */
export function HomePageShell({
  locale,
  shell,
  initialEvents = [],
}: HomePageShellProps) {
  const lcpHero = resolvePublicImageUrl(shell.heroBackgrounds[0]?.image_url);
  const lcpAlt = shell.heroBackgrounds[0]?.title || "KurdEvents";
  const cities =
    initialEvents.length > 0 ? sortHomeCities(shell.cities, initialEvents) : shell.cities;

  return (
    <ClientHomePage
      initialEvents={initialEvents}
      initialHeroBackgrounds={shell.heroBackgrounds}
      initialCities={cities}
      initialSliderAds={shell.sliderAds}
      heroLcpImage={
        <HomeHeroLcp imageUrl={shell.heroBackgrounds[0]?.image_url} alt={lcpAlt} />
      }
      hasHeroLcpImage={!!lcpHero}
    />
  );
}
