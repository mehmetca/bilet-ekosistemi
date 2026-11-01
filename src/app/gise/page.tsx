"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, LogOut, Ticket } from "lucide-react";
import DoorSalePanel from "@/components/DoorSalePanel";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";

/**
 * Gişe görevlisinin kendi sayfası: kontrolördeki /kontrol gibi tek ekran,
 * yalnız atandığı etkinliklerde bilet keser.
 */
export default function GiseKapiPage() {
  const { user, loading, isAdmin, isOrganizer, isGateSales, signOut } = useSimpleAuth();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
      window.location.href = "/giris";
    } finally {
      setSigningOut(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 bg-paper text-sm text-ink-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Yükleniyor…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-ink-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <Ticket className="h-5 w-5 text-gold-500" />
            <div>
              <p className="text-sm font-bold text-ink-900">Gişe — kapı satışı</p>
              {user?.email ? (
                <p className="max-w-[240px] truncate text-xs text-ink-500" title={user.email}>
                  {user.email}
                </p>
              ) : null}
            </div>
          </div>
          {user ? (
            <button
              type="button"
              onClick={() => void handleSignOut()}
              disabled={signingOut}
              className="flex min-h-[40px] items-center gap-2 rounded-lg border border-ink-300 px-3 text-sm font-medium text-ink-700 hover:bg-ink-50 disabled:opacity-50"
            >
              <LogOut className="h-4 w-4" /> {signingOut ? "Çıkılıyor…" : "Çıkış"}
            </button>
          ) : (
            <Link
              href="/giris?redirect=%2Fgise"
              className="flex min-h-[40px] items-center rounded-lg bg-gold-500 px-4 text-sm font-semibold text-white hover:bg-gold-600"
            >
              Giriş yap
            </Link>
          )}
        </div>
      </header>

      {!user ? (
        <p className="mx-auto max-w-6xl px-4 py-10 text-sm text-ink-600">
          Gişe ekranı görevli girişiyle açılır.
        </p>
      ) : isGateSales ? (
        <DoorSalePanel mode="sell" />
      ) : (
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="rounded-xl border border-ink-200 bg-white p-6">
            <p className="font-semibold text-ink-900">Bu hesap gişe görevlisi olarak yetkilendirilmemiş</p>
            <p className="mt-2 text-sm text-ink-600">
              {isAdmin || isOrganizer
                ? "Yönetici kayıtları salt görüntüler, organizatör kendi etkinliklerini satar: her ikisi de paneldeki Gişe ekranındadır."
                : "Kapıda bilet kesebilmek için yöneticinin seni bir etkinliğe gişe görevlisi olarak ataması gerekir."}
            </p>
            {isAdmin || isOrganizer ? (
              <Link
                href="/yonetim/gise"
                className="mt-4 inline-flex min-h-[40px] items-center rounded-lg bg-gold-500 px-4 text-sm font-semibold text-white hover:bg-gold-600"
              >
                Paneldeki gişe ekranına git
              </Link>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
