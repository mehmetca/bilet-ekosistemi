"use client";

import dynamic from "next/dynamic";

const SalonTasarimVizorClient = dynamic(
  () => import("./SalonTasarimVizorClient"),
  {
    ssr: false,
    loading: () => (
      <div className="p-8 flex justify-center">
        <span className="text-slate-500">Yükleniyor...</span>
      </div>
    ),
  }
);

export default function SalonTasarimVizorPage() {
  return <SalonTasarimVizorClient />;
}
