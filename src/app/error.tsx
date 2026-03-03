"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-8 h-8 text-red-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        </div>
        
        <h2 className="text-xl font-semibold text-slate-900 mb-2">
          Bir Hata Oluştu
        </h2>
        
        <p className="text-slate-600 mb-6">
          Uygulamada beklenmedik bir hata oluştu. Lütfen tekrar deneyin.
        </p>

        {error.message && (
          <details className="mb-4 text-left">
            <summary className="text-sm text-slate-500 cursor-pointer hover:text-slate-700">
              Hata detayları
            </summary>
            <pre className="mt-2 text-xs text-slate-400 bg-slate-50 p-2 rounded overflow-auto max-h-32">
              {error.message}
              {error.digest && `\n\nDigest: ${error.digest}`}
            </pre>
          </details>
        )}

        <div className="space-y-3">
          <button
            onClick={reset}
            className="w-full bg-primary-600 text-white py-2 px-4 rounded-lg font-semibold hover:bg-primary-700 transition-colors"
          >
            Tekrar Dene
          </button>
          
          <button
            onClick={() => router.push("/")}
            className="w-full border border-slate-300 text-slate-700 py-2 px-4 rounded-lg font-semibold hover:bg-slate-50 transition-colors"
          >
            Ana Sayfaya Dön
          </button>
        </div>

        <div className="mt-6 pt-6 border-t border-slate-200">
          <p className="text-xs text-slate-500">
            Hata devam ederse lütfen sayfayı yenileyin veya tarayıcı önbelleğini temizleyin.
          </p>
        </div>
      </div>
    </div>
  );
}
