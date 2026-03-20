"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";

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
}

export default function HeroBackgroundSlider({ initialBackgrounds = [] }: HeroBackgroundSliderProps) {
  const [backgrounds, setBackgrounds] = useState<HeroBackground[]>(initialBackgrounds);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(initialBackgrounds.length === 0);

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
    return (
      <div className="absolute inset-0 z-0 bg-gradient-to-br from-primary-600 to-primary-800">
        <div className="absolute inset-0 bg-black/20"></div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-0">
      {/* Background Images */}
      {backgrounds.map((bg, index) => (
        <div
          key={bg.id}
          className={`absolute inset-0 transition-opacity duration-1000 ${
            index === currentIndex ? "opacity-100" : "opacity-0"
          }`}
        >
          <Image
            src={bg.image_url}
            alt={bg.title}
            fill
            className="object-cover"
            sizes="100vw"
            priority={backgrounds.length <= 1 ? true : index < 2}
            fetchPriority={backgrounds.length <= 1 || index < 2 ? "high" : "low"}
            loading={backgrounds.length <= 1 || index < 2 ? "eager" : "lazy"}
          />
        </div>
      ))}
      
      {/* Dark Overlay for text readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/60"></div>
    </div>
  );
}
