"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase-client";

interface HeroBackground {
  id: string;
  title: string;
  image_url: string;
  is_active: boolean;
  sort_order: number;
  transition_duration: number;
}

export default function HeroBackgroundSlider() {
  const [backgrounds, setBackgrounds] = useState<HeroBackground[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchBackgrounds() {
      try {
        console.log("Fetching hero backgrounds...");
        
        const { data, error } = await supabase
          .from("hero_backgrounds")
          .select("*")
          .eq("is_active", true)
          .order("sort_order", { ascending: true });

        console.log("Hero backgrounds response:", { data, error });

        if (error) {
          console.error("Background fetch error details:", error);
          throw error;
        }
        
        setBackgrounds(data || []);
      } catch (error) {
        console.error("Background fetch error:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchBackgrounds();
  }, []);

  useEffect(() => {
    if (backgrounds.length <= 1) return;

    const currentBg = backgrounds[currentIndex];
    const duration = currentBg?.transition_duration || 5000;

    const interval = setInterval(() => {
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
          <img
            src={bg.image_url}
            alt={bg.title}
            className="w-full h-full object-cover"
            loading={index === 0 ? "eager" : "lazy"}
          />
        </div>
      ))}
      
      {/* Dark Overlay for text readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/60"></div>
    </div>
  );
}
