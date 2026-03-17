"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import SalonPlanViewer from "@/components/SalonPlanViewer";
import { getPlan } from "@/lib/seating-plans";
import OrganizerOrAdminGuard from "@/components/OrganizerOrAdminGuard";

export default function MusensaalOnizlemeClient() {
  const plan = getPlan("musensaal");
  if (!plan) {
    return (
      <OrganizerOrAdminGuard>
        <div className="p-8">Plan bulunamadı.</div>
      </OrganizerOrAdminGuard>
    );
  }
  return (
    <OrganizerOrAdminGuard>
      <div className="p-8 max-w-5xl mx-auto">
        <div className="mb-6 flex items-center gap-4">
          <Link
            href="/yonetim/mekanlar"
            className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Mekanlar
          </Link>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">{plan.name} – Koltuk Planı (Önizleme)</h1>
        <p className="mt-1 text-slate-600">
          Koltuklara tıklayarak seçim yapabilirsiniz. Bu planı bir mekana atamak için mekanın oturum planı sayfasından şablonu kullanabilirsiniz.
        </p>
        <div className="mt-6 overflow-x-auto">
          <SalonPlanViewer plan={plan} />
        </div>
      </div>
    </OrganizerOrAdminGuard>
  );
}
