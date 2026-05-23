"use client";

import dynamic from "next/dynamic";

const SpeedInsights = dynamic(
  () => import("@vercel/speed-insights/next").then((m) => m.SpeedInsights),
  { ssr: false }
);

/** Üretimde, ana iş parçacığı ve LCP sonrası yüklenir. */
export default function DeferredSpeedInsights() {
  if (process.env.NODE_ENV !== "production") return null;
  return <SpeedInsights />;
}
