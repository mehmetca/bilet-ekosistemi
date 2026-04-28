"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { ExternalLink } from "lucide-react";
import { supabase } from "@/lib/supabase-client";
import { isImageReachable } from "@/lib/image-utils";

interface Advertisement {
  id: string;
  title: string;
  image_url: string;
  link_url: string;
  is_active: boolean;
  created_at: string;
}

export default function AdvertisementGrid() {
  const [advertisements, setAdvertisements] = useState<Advertisement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAdvertisements() {
      try {
        setLoading(true);
        setError(null);

        const { data, error } = await supabase
          .from("advertisements")
          .select("*")
          .eq("is_active", true)
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Advertisements fetch error:", error);
          setError("Reklamlar yüklenemedi");
          setAdvertisements([]);
        } else {
          const rawAdvertisements = data || [];
          const validatedAds = await Promise.all(
            rawAdvertisements.map(async (ad) => {
              const adImageIsReachable = await isImageReachable(ad.image_url);
              return adImageIsReachable ? ad : null;
            })
          );
          setAdvertisements(
            validatedAds.filter((ad): ad is Advertisement => ad !== null)
          );
        }
      } catch (error) {
        console.error("Advertisements fetch error:", error);
        setError("Reklamlar yüklenirken hata oluştu");
        setAdvertisements([]);
      } finally {
        setLoading(false);
      }
    }

    fetchAdvertisements();
  }, []);

  // Loading state
  if (loading) {
    return (
      <section className="site-container py-8">
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="text-xl font-bold text-slate-900 mb-6">Sponsorlarımız</h2>
          <div className="text-center py-10">
            <div className="inline-flex items-center gap-2 text-slate-500">
              <div className="w-4 h-4 border-2 border-slate-300 border-t-primary-600 rounded-full animate-spin"></div>
              <span>Yükleniyor...</span>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // Error state
  if (error) {
    return (
      <section className="site-container py-8">
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="text-xl font-bold text-slate-900 mb-6">Sponsorlarımız</h2>
          <div className="text-center py-10">
            <p className="text-slate-500">{error}</p>
          </div>
        </div>
      </section>
    );
  }

  // Empty state
  if (advertisements.length === 0) {
    return (
      <section className="site-container py-8">
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="text-xl font-bold text-slate-900 mb-6">Sponsorlarımız</h2>
          <div className="text-center py-10">
            <p className="text-slate-500">Henüz sponsor reklamı bulunmuyor.</p>
          </div>
        </div>
      </section>
    );
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
                {ad.image_url ? (
                  <Image
                    src={ad.image_url}
                    alt={ad.title || "Sponsor reklamı"}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400">
                    <span className="text-sm">Reklam Görseli</span>
                  </div>
                )}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <h3 className="font-medium text-slate-900 truncate">
                  {ad.title || "Sponsor"}
                </h3>
                {ad.link_url && (
                  <ExternalLink className="h-4 w-4 text-slate-400 flex-shrink-0 ml-2" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
