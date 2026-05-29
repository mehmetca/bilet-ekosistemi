/** Hero altı içerik yüklenirken yer tutucu (layout shift azaltır). */
export default function HomePageMainFallback() {
  return (
    <div className="site-container py-12" aria-hidden>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="p-6 pb-4">
          <div className="h-7 w-44 rounded bg-slate-200" />
        </div>
        <div className="border-t border-slate-200">
          <div className="h-[58vw] min-h-[220px] max-h-[360px] animate-pulse bg-slate-200 sm:h-[48vw] sm:max-h-[420px] lg:h-[36vw] lg:max-h-[520px] xl:h-[30vw] xl:max-h-[560px]" />
        </div>
      </div>
      <div className="mt-12">
        <div className="mb-6 h-8 w-48 rounded bg-slate-200" />
        <div className="flex gap-3 overflow-hidden">
          <div className="h-[calc(49.5vw_+_3rem)] max-h-[15.375rem] w-[min(88vw,22rem)] shrink-0 rounded-xl bg-slate-200 sm:h-[177px] sm:w-[230px] md:h-[189px] md:w-[250px] xl:h-[206px] xl:w-[280px]" />
          <div className="hidden h-[177px] w-[230px] shrink-0 rounded-xl bg-slate-200 sm:block md:h-[189px] md:w-[250px] xl:h-[206px] xl:w-[280px]" />
        </div>
      </div>
    </div>
  );
}
