/** Hero altı içerik yüklenirken yer tutucu (layout shift azaltır). */
export default function HomePageMainFallback() {
  return (
    <div className="site-container py-12" aria-hidden>
      <div className="overflow-hidden rounded-lg border border-ink-200 bg-white shadow-card">
        <div className="p-6 pb-4">
          <div className="h-7 w-44 animate-pulse rounded-md bg-ink-100" />
        </div>
        <div className="border-t border-ink-200">
          <div className="aspect-[16/10] min-h-[240px] animate-pulse bg-ink-100 sm:aspect-auto sm:h-[48vw] sm:min-h-0 sm:max-h-[420px] lg:h-[36vw] lg:max-h-[520px] xl:h-[30vw] xl:max-h-[560px]" />
        </div>
      </div>
      <div className="mt-12">
        <div className="mb-6 h-8 w-48 animate-pulse rounded-md bg-ink-100" />
        <div className="flex gap-3 overflow-hidden">
          <div className="h-[calc(49.5vw_+_3rem)] max-h-[15.375rem] w-[min(88vw,22rem)] shrink-0 animate-pulse rounded-lg bg-ink-100 sm:h-[177px] sm:w-[230px] md:h-[189px] md:w-[250px] xl:h-[206px] xl:w-[280px]" />
          <div className="hidden h-[177px] w-[230px] shrink-0 animate-pulse rounded-lg bg-ink-100 sm:block md:h-[189px] md:w-[250px] xl:h-[206px] xl:w-[280px]" />
        </div>
      </div>
    </div>
  );
}
