/** Kök segment için yükleme UI’si — dev’de overlay / chunk yarışlarında daha stabil geçiş. */
export default function RootLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-600">
      <div className="flex flex-col items-center gap-3">
        <div
          className="h-9 w-9 animate-spin rounded-full border-4 border-primary-500 border-t-transparent"
          aria-hidden
        />
        <p className="text-sm">Yükleniyor…</p>
      </div>
    </div>
  );
}
