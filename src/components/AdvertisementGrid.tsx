"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { ExternalLink } from "lucide-react";
import type { PublicAdvertisement } from "@/lib/advertisements-server";

type AdvertisementGridProps = {
  /** Sunucu/ISR'den gelen liste; verilirse istemci Supabase isteği yok. */
  initialAds?: PublicAdvertisement[];
};

export default function AdvertisementGrid({ initialAds = [] }: AdvertisementGridProps) {
  const [brokenIds, setBrokenIds] = useState<Set<string>>(() => new Set());

  const advertisements = useMemo(
    () => initialAds.filter((ad) => ad.image_url && !brokenIds.has(ad.id)),
    [initialAds, brokenIds]
  );

  if (initialAds.length === 0) {
    return null;
  }

  if (advertisements.length === 0) {
    return null;
  }

  return (
    <section className="site-container py-8">
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h2 className="text-xl font-bold text-slate-900 mb-6">Sponsorlarımız</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {advertisements.map((ad) => (
            <div
              key={ad.id}
              className="relative group cursor-pointer"
              onClick={() => {
                if (ad.link_url) {
                  window.open(ad.link_url, "_blank", "noopener,noreferrer");
                }
              }}
            >
              <div className="aspect-video bg-slate-100 rounded-lg overflow-hidden relative">
                <Image
                  src={ad.image_url}
                  alt={ad.title || "Sponsor reklamı"}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  onError={() => setBrokenIds((prev) => new Set(prev).add(ad.id))}
                />
              </div>
              <div className="mt-3 flex items-center justify-between">
                <h3 className="font-medium text-slate-900 truncate">{ad.title || "Sponsor"}</h3>
                {ad.link_url ? (
                  <ExternalLink className="h-4 w-4 text-slate-400 flex-shrink-0 ml-2" />
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
