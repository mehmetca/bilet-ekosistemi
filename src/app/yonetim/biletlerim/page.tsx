"use client";

import { useSimpleAuth } from "@/contexts/SimpleAuthContext";
import BiletlerimSection from "@/components/BiletlerimSection";

export default function BiletlerimPage() {
  const { user } = useSimpleAuth();

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Biletlerim</h1>
        <p className="text-slate-600 mb-8">
          Satın aldığınız biletleri görüntüleyebilir ve yazdırabilirsiniz.
        </p>
        <BiletlerimSection user={user} />
      </div>
    </div>
  );
}
