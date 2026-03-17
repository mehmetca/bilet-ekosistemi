"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";

const EtkinlikYeniWizard = dynamic(
  () => import("./EtkinlikYeniWizard"),
  {
    ssr: false,
    loading: () => (
      <div className="p-8 flex justify-center">
        <span className="text-slate-500">Yükleniyor...</span>
      </div>
    ),
  }
);

function YeniEtkinlikContent() {
  const searchParams = useSearchParams();
  const editId = searchParams.get("id");
  return <EtkinlikYeniWizard editId={editId} />;
}

export default function EtkinlikYeniPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 flex justify-center">
          <span className="text-slate-500">Yükleniyor...</span>
        </div>
      }
    >
      <YeniEtkinlikContent />
    </Suspense>
  );
}
