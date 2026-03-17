"use client";

import dynamic from "next/dynamic";

const MusensaalOnizlemeClient = dynamic(
  () => import("./MusensaalOnizlemeClient"),
  {
    ssr: false,
    loading: () => (
      <div className="p-8 flex justify-center">
        <span className="text-slate-500">Yükleniyor...</span>
      </div>
    ),
  }
);

export default function MusensaalOnizlemePage() {
  return <MusensaalOnizlemeClient />;
}
