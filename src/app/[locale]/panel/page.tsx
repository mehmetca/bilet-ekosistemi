"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import PanelLayout from "@/components/PanelLayout";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";
import { useTranslations } from "next-intl";
import { supabase } from "@/lib/supabase-client";
import BiletlerimSection from "@/components/BiletlerimSection";

export default function PanelPage() {
  const t = useTranslations("panel");
  const { user, loading: authLoading } = useSimpleAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/giris");
      return;
    }
  }, [user, authLoading, router]);

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
      <div className="max-w-4xl">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">{t("title")}</h1>
        <p className="text-slate-600 mb-8">
          {t("welcome")}, {user.email}
        </p>
        <BiletlerimSection user={user} />
      </div>
    </PanelLayout>
  );
}
