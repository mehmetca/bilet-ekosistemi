"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import PanelLayout from "@/components/PanelLayout";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";
import { useTranslations } from "next-intl";
import { supabase } from "@/lib/supabase-client";
import BiletlerimSection from "@/components/BiletlerimSection";
import { LogOut } from "lucide-react";

export default function PanelPage() {
  const t = useTranslations("panel");
  const { user, loading: authLoading, signOut, isAdmin, isController, isOrganizer } = useSimpleAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/giris");
      return;
    }
    if (!authLoading && user) {
      if (isController) {
        router.replace("/yonetim/bilet-kontrol");
        return;
      }
      if (isAdmin || isOrganizer) {
        router.replace("/yonetim");
        return;
      }
    }
  }, [user, authLoading, isAdmin, isController, isOrganizer, router]);

  async function ensureProfile() {
    if (!user) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = {
        Authorization: `Bearer ${session?.access_token || ""}`,
      };
      const getRes = await fetch("/api/profile", { headers });
      if (!getRes.ok) return;
      const existing = (await getRes.json()) as { kundennummer?: string } | null;
      if (existing?.kundennummer) return;
      headers["Content-Type"] = "application/json";
      await fetch("/api/profile", {
        method: "POST",
        headers,
        body: JSON.stringify({ email: user.email }),
      });
    } catch (e) {
      console.error("ensureProfile:", e);
    }
  }

  useEffect(() => {
    if (user) ensureProfile();
  }, [user]);

  if (authLoading || !user) {
    const isRedirecting = !authLoading && !user;
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-500">{isRedirecting ? t("redirecting") : t("loading")}</div>
      </div>
    );
  }

  return (
    <PanelLayout>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 mb-1">{t("title")}</h1>
          <p className="text-slate-600">
            {t("welcome")}, {user.email}
          </p>
        </div>
        <button
          type="button"
          onClick={async () => {
            await signOut();
            router.replace("/");
          }}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-red-50 hover:text-red-600 transition-colors self-start sm:self-auto"
        >
          <LogOut className="h-4 w-4" />
          {t("logout")}
        </button>
      </div>
      <BiletlerimSection user={user} />
    </PanelLayout>
  );
}
