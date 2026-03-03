"use client";

import Link from "next/link";
import { ArrowLeft, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-8 h-8 text-blue-600"
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
        
        <h2 className="text-xl font-semibold text-slate-900 mb-2">
          Sayfa Bulunamadı
        </h2>
        
        <p className="text-slate-600 mb-6">
          Aradığınız sayfa mevcut değil veya taşınmış olabilir.
        </p>

        <div className="space-y-3">
          <Link
            href="/"
            className="w-full bg-primary-600 text-white py-2 px-4 rounded-lg font-semibold hover:bg-primary-700 transition-colors inline-flex items-center justify-center gap-2"
          >
            <Home className="h-4 w-4" />
            Ana Sayfaya Dön
          </Link>
          
          <button
            onClick={() => window.history.back()}
            className="w-full border border-slate-300 text-slate-700 py-2 px-4 rounded-lg font-semibold hover:bg-slate-50 transition-colors inline-flex items-center justify-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Geri Git
          </button>
        </div>

        <div className="mt-6 pt-6 border-t border-slate-200">
          <p className="text-xs text-slate-500">
            URL'yi kontrol edip tekrar deneyebilirsiniz.
          </p>
        </div>
      </div>
    </div>
  );
}
