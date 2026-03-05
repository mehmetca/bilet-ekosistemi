"use client";

import { useState, useEffect } from "react";
import AdminOnlyGuard from "@/components/AdminOnlyGuard";
import { FlaskConical, BarChart3 } from "lucide-react";
import Link from "next/link";

interface AbVariant {
  id: string;
  variant_key: string;
  hero_title: string | null;
  hero_subtitle: string | null;
  cta_text: string | null;
  weight: number;
}

interface AbBreakdown {
  variant: string;
  views: number;
  intents: number;
}

export default function AbTestPage() {
  const [variants, setVariants] = useState<AbVariant[]>([]);
  const [breakdown, setBreakdown] = useState<AbBreakdown[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/ab/variants", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/analytics/funnel-stats?period=30", { cache: "no-store" }).then((r) =>
        r.json()
      ),
    ])
      .then(([varsData, funnelData]) => {
        setVariants(varsData.variants || []);
        setBreakdown(funnelData.ab_breakdown || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <AdminOnlyGuard>
      <div className="p-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900">A/B Test Yönetimi</h1>
            <p className="mt-2 text-slate-600">
              Hero ve CTA varyantları. Sonuçlar Huni Analitiği sayfasında hero_variant bazlı
              görüntülenir.
            </p>
          </div>

          {loading ? (
            <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden mb-8">
                <div className="p-4 border-b border-slate-200 flex items-center gap-2">
                  <FlaskConical className="h-5 w-5 text-slate-600" />
                  <h2 className="font-semibold text-slate-900">Aktif Varyantlar</h2>
                </div>
                {variants.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">
                    Henüz varyant tanımlanmamış. Supabase ab_variants tablosuna ekleyin.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {variants.map((v) => (
                      <div key={v.id} className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-mono text-sm font-bold text-primary-600">
                            Varyant {v.variant_key}
                          </span>
                          <span className="text-xs text-slate-500">ağırlık: %{v.weight}</span>
                        </div>
                        <p className="text-sm text-slate-700 font-medium">{v.hero_title}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{v.hero_subtitle}</p>
                        <p className="text-xs text-slate-500 mt-1">CTA: {v.cta_text}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <div className="p-4 border-b border-slate-200 flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-slate-600" />
                  <h2 className="font-semibold text-slate-900">Hero Varyant Bazlı Özet (Son 30 gün)</h2>
                </div>
                {breakdown.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">
                    Henüz veri yok. Ana sayfayı ziyaret eden ve etkinlik sayfasına giden kullanıcılar
                    burada görünecek.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50">
                          <th className="text-left p-4 text-sm font-medium text-slate-700">
                            Varyant
                          </th>
                          <th className="text-right p-4 text-sm font-medium text-slate-700">
                            Görüntüleme
                          </th>
                          <th className="text-right p-4 text-sm font-medium text-slate-700">
                            Ödeme Başlatma
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {breakdown.map((row) => (
                          <tr key={row.variant} className="border-b border-slate-100">
                            <td className="p-4 font-mono font-medium">{row.variant}</td>
                            <td className="text-right p-4">{row.views}</td>
                            <td className="text-right p-4">{row.intents}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="mt-6">
                <Link
                  href="/yonetim/huni-analitigi"
                  className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                >
                  ← Huni Analitiği sayfasına git
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </AdminOnlyGuard>
  );
}
