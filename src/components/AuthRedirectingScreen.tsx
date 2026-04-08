"use client";

/** Oturum yokken router.replace("/giris") beklenirken boş beyaz sayfa göstermemek için. */
export default function AuthRedirectingScreen() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4 px-4">
      <div
        className="h-9 w-9 animate-spin rounded-full border-4 border-primary-500 border-t-transparent"
        aria-hidden
      />
      <p className="text-slate-600 text-center text-sm max-w-sm">
        Giriş sayfasına yönlendiriliyorsunuz…
      </p>
    </div>
  );
}
