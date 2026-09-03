"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";

type CoverImageProps = {
  src?: string | null;
  alt: string;
  /** Farklı ekran boyutlarında görselin kullanılacağı genişlik (next/image) */
  sizes: string;
  priority?: boolean;
  /**
   * Görsel yoksa veya yüklenirken hata olursa gösterilecek içerik.
   * Eski <img onError> yedek mantığının yerini alır.
   */
  fallback?: ReactNode;
  /** Küçük kartlarda hover zoom için. */
  zoomOnHover?: boolean;
  /** Görselin kırpılma/kapsama sınıfı (varsayılan: object-cover object-top) */
  imageClassName?: string;
};

/**
 * Kart/önizleme görselleri için next/image sarmalayıcısı.
 * - Görselleri ekran boyutuna göre optimize eder (Supabase egress'ini azaltır).
 * - `fill` kullanır; parent element `relative` + sabit en/boy oranı (aspect-*) olmalı.
 * - Yüklenemeyen görselde bozuk ikon yerine `fallback` gösterir.
 */
export default function CoverImage({
  src,
  alt,
  sizes,
  priority = false,
  fallback,
  zoomOnHover = false,
  imageClassName = "object-cover object-top",
}: CoverImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return <>{fallback ?? null}</>;
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      className={
        zoomOnHover
          ? `${imageClassName} transition-transform duration-500 group-hover:scale-105`
          : imageClassName
      }
      onError={() => setFailed(true)}
    />
  );
}
