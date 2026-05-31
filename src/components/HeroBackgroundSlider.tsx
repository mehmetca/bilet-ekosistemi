"use client";

import { useState, useEffect, useRef } from "react";
import { resolvePublicImageUrl } from "@/lib/external-image";

interface HeroBackground {
  id: string;
  title: string;
  image_url: string;
  is_active: boolean;
  sort_order: number;
  transition_duration: number;
}

interface HeroBackgroundSliderProps {
  initialBackgrounds?: HeroBackground[];
  /** Sunucuda LCP img zaten çizildiyse ilk slaytı tekrar yükleme */
  lcpImageRendered?: boolean;
}

export default function HeroBackgroundSlider({
  initialBackgrounds = [],
  lcpImageRendered = false,
}: HeroBackgroundSliderProps) {
  const [backgrounds, setBackgrounds] = useState<HeroBackground[]>(initialBackgrounds);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(initialBackgrounds.length === 0);
  const [showExtraSlides, setShowExtraSlides] = useState(!lcpImageRendered);

  useEffect(() => {
    if (!lcpImageRendered || initialBackgrounds.length <= 1) return;
    const id = requestAnimationFrame(() => setShowExtraSlides(true));
    return () => cancelAnimationFrame(id);
  }, [lcpImageRendered, initialBackgrounds.length]);

  useEffect(() => {
    if (initialBackgrounds.length > 0) {
      setBackgrounds(initialBackgrounds);
      setLoading(false);
      return;
    }
    let cancelled = false;
    async function fetchBackgrounds() {
      try {
        const { supabase } = await import("@/lib/supabase-client");
        const { data, error } = await supabase
          .from("hero_backgrounds")
          .select("*")
          .eq("is_active", true)
          .order("sort_order", { ascending: true });
        if (error) throw error;
        if (!cancelled) setBackgrounds(data || []);
      } catch (error) {
        if (!cancelled) console.error("Background fetch error:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchBackgrounds();
    return () => { cancelled = true; };
  }, [initialBackgrounds.length]);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (backgrounds.length <= 1) return;

    const currentBg = backgrounds[currentIndex];
    const duration = currentBg?.transition_duration || 5000;

    const interval = setInterval(() => {
      if (!mountedRef.current) return;
      setCurrentIndex((prev) => (prev + 1) % backgrounds.length);
    }, duration);

    return () => clearInterval(interval);
  }, [backgrounds, currentIndex]);

  if (loading || backgrounds.length === 0) {
    return lcpImageRendered ? (
      <div className="absolute inset-0 z-0 bg-black/20" aria-hidden />
    ) : (
      <div className="absolute inset-0 z-0 bg-slate-950">
        <div className="absolute inset-0 bg-black/20" aria-hidden />
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-0">
      {/* Background Images */}
      {backgrounds.map((bg, index) => {
        if (lcpImageRendered && index === 0) return null;
        if (lcpImageRendered && !showExtraSlides && index > 0) return null;
        const isActive = index === currentIndex;
        return (
          <div
            key={bg.id}
            className={`absolute inset-0 transition-opacity duration-1000 ${
              isActive ? "opacity-100" : "opacity-0"
            }`}
          >
            {index === 0 && !lcpImageRendered ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={resolvePublicImageUrl(bg.image_url) ?? bg.image_url}
                alt={bg.title}
                fetchPriority="high"
                loading="eager"
                decoding="async"
                sizes="100vw"
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={resolvePublicImageUrl(bg.image_url) ?? bg.image_url}
                alt={bg.title}
                className="absolute inset-0 h-full w-full object-cover"
                sizes="100vw"
                loading="lazy"
                decoding="async"
              />
            )}
          </div>
        );
      })}
      
      {/* Dark Overlay for text readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/60"></div>
    </div>
  );
}


