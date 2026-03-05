export default function LocaleLoading() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="animate-pulse flex flex-col items-center gap-4">
        <div className="h-10 w-10 rounded-xl bg-primary-200" />
        <div className="h-4 w-48 rounded bg-slate-200" />
      </div>
    </div>
  );
}
