"use client";

import { Loader2 } from "lucide-react";
import DoorSalePanel from "@/components/DoorSalePanel";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";

export default function GiseSatisiPage() {
  const { user, loading, isAdmin, isOrganizer, isGateSales } = useSimpleAuth();

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-ink-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Yükleniyor…
      </div>
    );
  }

  // Gişe görevlisi satışını /gise üzerinden yapar; bu kabuk yönetici ve organizatör içindir.
  if (!user || isGateSales || (!isAdmin && !isOrganizer)) {
    return (
      <div className="m-6 rounded-xl border border-ink-200 bg-ink-50 p-6">
        <div className="font-semibold text-ink-900">Gişe ekranı bu hesap için kapalı</div>
        <p className="mt-2 text-sm text-ink-600">
          Kapıda bilet kesme yetkisini yalnızca yönetici verir; gişe görevlisi kendi sayfasından satış
          yapar.
        </p>
      </div>
    );
  }

  return <DoorSalePanel mode={isAdmin ? "observe" : "sell"} />;
}
