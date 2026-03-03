"use client";

import { Calendar, ArrowLeft, Share2 } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import type { News } from "@/types/database";

interface HaberDetayClientProps {
  haber: News;
}

export default function HaberDetayClient({ haber }: HaberDetayClientProps) {
  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: haber.title,
        text: haber.summary || haber.content.substring(0, 150) + "...",
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert("Link kopyalandı!");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="container mx-auto px-4 py-4">
          <Link 
            href="/"
            className="inline-flex items-center gap-2 text-slate-600 hover:text-primary-600 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Ana Sayfaya Dön
          </Link>
        </div>
      </div>

      {/* Haber Detayı */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Başlık */}
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              {haber.title}
            </h1>
            
            <div className="flex items-center justify-center gap-4 text-sm text-slate-600">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {new Date(haber.published_at || haber.created_at).toLocaleDateString("tr-TR", {
                  year: "numeric",
                  month: "long",
                  day: "numeric"
                })}
              </div>
              
              <button
                onClick={handleShare}
                className="flex items-center gap-2 hover:text-primary-600 transition-colors"
              >
                <Share2 className="h-4 w-4" />
                Paylaş
              </button>
            </div>
          </div>

          {/* Görsel */}
          {haber.image_url && (
            <div className="mb-8">
              <div className="relative aspect-video rounded-xl overflow-hidden">
                <Image
                  src={haber.image_url}
                  alt={haber.title}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 896px"
                />
              </div>
            </div>
          )}

          {/* Özet */}
          {haber.summary && (
            <div className="bg-primary-50 border-l-4 border-primary-600 p-4 mb-8 rounded-r-lg">
              <p className="text-lg text-primary-900 font-medium">
                {haber.summary}
              </p>
            </div>
          )}

          {/* İçerik */}
          <div className="prose prose-lg max-w-none">
            <div 
              dangerouslySetInnerHTML={{ __html: haber.content }}
              className="text-slate-700 leading-relaxed"
            />
          </div>

          {/* Paylaş Butonu */}
          <div className="mt-12 pt-8 border-t border-slate-200">
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={handleShare}
                className="flex items-center gap-2 bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 transition-colors"
              >
                <Share2 className="h-4 w-4" />
                Haberi Paylaş
              </button>
              
              <Link
                href="/"
                className="flex items-center gap-2 bg-slate-200 text-slate-700 px-6 py-3 rounded-lg hover:bg-slate-300 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Ana Sayfa
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
