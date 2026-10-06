"use client";

import { Link } from "@/i18n/navigation";
import { ArrowLeft, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-ink-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg border border-ink-200 shadow-card p-8 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-gold-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-8 h-8 text-gold-700"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        
        <h2 className="text-xl font-semibold text-ink-900 mb-2">
          Sayfa Bulunamadı
        </h2>
        
        <p className="text-ink-600 mb-6">
          Aradığınız sayfa mevcut değil veya taşınmış olabilir.
        </p>

        <div className="space-y-3">
          <Link
            href="/"
            className="w-full bg-gold-500 text-ink-950 py-2 px-4 rounded-lg font-semibold hover:bg-gold-400 transition-colors inline-flex items-center justify-center gap-2"
          >
            <Home className="h-4 w-4" />
            Ana Sayfaya Dön
          </Link>
          
          <button
            onClick={() => window.history.back()}
            className="w-full border border-ink-300 text-ink-700 py-2 px-4 rounded-lg font-semibold hover:bg-ink-50 transition-colors inline-flex items-center justify-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Geri Git
          </button>
        </div>

        <div className="mt-6 pt-6 border-t border-ink-200">
          <p className="text-xs text-ink-500">
            URL'yi kontrol edip tekrar deneyebilirsiniz.
          </p>
        </div>
      </div>
    </div>
  );
}
