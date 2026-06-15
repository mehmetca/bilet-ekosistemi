"use client";

import { useState } from "react";
import Image from "next/image";
import type { PublicAdvertisement } from "@/lib/advertisements-server";

type AdvertisementBannerProps = {
  /** Sunucu/ISR'den gelen reklam; verilirse istemci isteği atılmaz. */
  initialAd?: PublicAdvertisement | null;
};

export default function AdvertisementBanner({ initialAd = null }: AdvertisementBannerProps) {
  const [hidden, setHidden] = useState(false);
  const advertisement = initialAd;

  if (hidden || !advertisement?.image_url) {
    return null;
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <div
        className="relative cursor-pointer"
        onClick={() => {
          if (advertisement.link_url) {
            window.open(advertisement.link_url, "_blank", "noopener,noreferrer");
          }
        }}
      >
        <div className="relative w-full h-[128px] bg-slate-100 rounded-lg overflow-hidden">
          <Image
            src={advertisement.image_url}
            alt={advertisement.title || "Reklam"}
            fill
            className="object-cover hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 768px) 100vw, 384px"
            onError={() => setHidden(true)}
          />
        </div>
      </div>
    </div>
  );
}
