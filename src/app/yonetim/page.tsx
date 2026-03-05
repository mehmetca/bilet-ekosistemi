import { Suspense } from "react";
import YonetimDashboard from "@/components/YonetimDashboard";

export default function YonetimPage() {
  return (
      <div className="p-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900">Yönetim Paneli</h1>
            <p className="mt-2 text-slate-600">Etkinlikleri yönetin, düzenleyin ve yeni etkinlikler ekleyin.</p>
          </div>
          <Suspense fallback={<div>Yükleniyor...</div>}>
            <YonetimDashboard />
          </Suspense>
        </div>
      </div>
  );
}
