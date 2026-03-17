"use client";

import { useEffect, useState } from "react";

/** Geliştirme: Beyaz sayfa debug - konsola periyodik log + ekranda son heartbeat. Beyaza dönünce log devam ediyor mu bakın. */
export default function Heartbeat() {
  const [mounted, setMounted] = useState(false);
  const [last, setLast] = useState("");

  useEffect(() => {
    setMounted(true);
    const tick = () => {
      const now = new Date();
      const local = now.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
      setLast(local);
      console.log("[Heartbeat]", now.toISOString());
    };
    tick();
    const id = setInterval(tick, 15000); // her 15 saniye
    return () => clearInterval(id);
  }, []);

  // Sunucu ve ilk client render'da aynı içerik (boş) → hydration hatası olmaz
  if (!mounted) return null;

  return (
    <div
      id="heartbeat-debug"
      style={{
        position: "fixed",
        bottom: 8,
        right: 8,
        zIndex: 99998,
        fontSize: 10,
        color: "#64748b",
        background: "rgba(255,255,255,0.9)",
        padding: "4px 8px",
        borderRadius: 4,
        border: "1px solid #e2e8f0",
      }}
      aria-hidden
    >
      {last}
    </div>
  );
}
