/** Hero altı içerik yüklenirken yer tutucu (layout shift azaltır). */
export default function HomePageMainFallback() {
  return (
    <div className="site-container py-12" aria-hidden>
      <div className="h-64 animate-pulse rounded-xl bg-slate-200" />
      <div className="mt-12 grid gap-4 sm:grid-cols-2">
        <div className="h-48 animate-pulse rounded-xl bg-slate-200" />
        <div className="h-48 animate-pulse rounded-xl bg-slate-200" />
      </div>
    </div>
  );
}
