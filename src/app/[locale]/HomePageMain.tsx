import { getHomeEvents, sortHomeCities, type HomeShellData } from "@/lib/home-page-data";
import ClientHomePage from "./ClientHomePage";

type HomePageMainProps = {
  locale: string;
  shell: HomeShellData;
};

/** Üst sayfa `revalidate = 1800` + `unstable_cache`; CDN/ISR önbelleği kullanılır. */
export default async function HomePageMain({ locale, shell }: HomePageMainProps) {
  let events: Awaited<ReturnType<typeof getHomeEvents>> = [];
  try {
    events = await getHomeEvents(locale);
  } catch (e) {
    console.error("HomePageMain getHomeEvents error:", e);
  }

  const cities = sortHomeCities(shell.cities, events);

  return (
    <ClientHomePage
      hideHeader
      initialEvents={events}
      initialCities={cities}
      initialSliderAds={shell.sliderAds}
    />
  );
}
