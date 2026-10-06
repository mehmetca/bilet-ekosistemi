/** Kök segment için yükleme UI’si — dev’de overlay / chunk yarışlarında daha stabil geçiş. */
export default function RootLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper text-ink-600">
      <div className="flex flex-col items-center gap-3">
        <div
          className="h-9 w-9 animate-spin rounded-full border-4 border-gold-500 border-t-transparent"
          aria-hidden
        />
        <p className="text-sm">Yükleniyor…</p>
      </div>
    </div>
  );
}
