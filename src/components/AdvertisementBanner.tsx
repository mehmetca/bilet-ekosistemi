"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase-client";
import { isImageReachable } from "@/lib/image-utils";

interface Advertisement {
  id: string;
  title: string;
  image_url: string;
  link_url: string;
  is_active: boolean;
}

export default function AdvertisementBanner() {
  const [advertisement, setAdvertisement] = useState<Advertisement | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAdvertisement() {
      try {
        const { data, error } = await supabase
          .from("advertisements")
          .select("*")
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(1);

        if (error) {
          console.error("Advertisement fetch error:", error);
        } else if (data && data.length > 0) {
          const latestAd = data[0];
          const adImageIsReachable = await isImageReachable(latestAd.image_url);
          setAdvertisement(adImageIsReachable ? latestAd : null);
        }
      } catch (error) {
        console.error("Advertisement fetch error:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchAdvertisement();
  }, []);

  if (loading || !advertisement) {
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
          {advertisement.image_url ? (
            <Image
              src={advertisement.image_url}
              alt={advertisement.title || "Reklam"}
              fill
              className="object-cover hover:scale-105 transition-transform duration-300"
              sizes="(max-width: 768px) 100vw, 384px"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-400">
              <span className="text-sm">Reklam Alanı</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
