"use client";

import { useState, useEffect, useCallback } from "react";
import AdminOnlyGuard from "@/components/AdminOnlyGuard";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";
import { BarChart3, Eye, ShoppingCart, CheckCircle } from "lucide-react";
import Link from "next/link";

interface FunnelRow {
  event_id: string;
  title: string;
  date: string;
  views: number;
  intents: number;
  completed: number;
}

interface FunnelData {
  period: number;
  totals: { views: number; intents: number; completed: number };
  funnel: FunnelRow[];
}

export default function HuniAnalitigiPage() {
  const { accessToken } = useSimpleAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<FunnelData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState("7");

  const fetchData = useCallback(async () => {
    if (!accessToken) {
      setData(null);
      setError("Oturum bulunamadı. Sayfayı yenileyip tekrar giriş yapın.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/analytics/funnel-stats?period=${period}`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = (await res.json().catch(() => ({}))) as FunnelData & {
        message?: string;
        error?: string;
      };
      if (!res.ok) {
        setData(null);
        setError(json.message || json.error || "Huni verileri alınamadı.");
        return;
      }
      setData(json);
    } catch (err) {
      console.error("Funnel fetch error:", err);
      setData(null);
      setError("Bağlantı hatası. Tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  }, [accessToken, period]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  return (
    <AdminOnlyGuard>
      <div className="p-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Huni Analitiği</h1>
              <p className="mt-2 text-slate-600">
                Görüntüleme → Ödeme başlatma → Satın alma dönüşüm hunisi
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500">Periyot:</span>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="7">Son 7 gün</option>
                <option value="14">Son 14 gün</option>
                <option value="30">Son 30 gün</option>
                <option value="90">Son 90 gün</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
            </div>
          ) : error || !data ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-8 text-center">
              <p className="text-amber-950 font-medium">
                {error || "Veri yüklenemedi."}
              </p>
              <button
                type="button"
                onClick={() => void fetchData()}
                className="mt-4 rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-950 hover:bg-amber-100"
              >
                Tekrar dene
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div className="rounded-xl border border-slate-200 bg-white p-6">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 rounded-lg bg-blue-50">
                      <Eye className="h-5 w-5 text-blue-600" />
                    </div>
                    <span className="text-sm font-medium text-slate-500">Görüntüleme</span>
                  </div>
                  <p className="text-2xl font-bold text-slate-900">{data.totals.views}</p>
                  <p className="text-xs text-slate-500 mt-1">Etkinlik sayfası görüntüleme</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-6">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 rounded-lg bg-amber-50">
                      <ShoppingCart className="h-5 w-5 text-amber-600" />
                    </div>
                    <span className="text-sm font-medium text-slate-500">Ödeme Başlatma</span>
                  </div>
                  <p className="text-2xl font-bold text-slate-900">{data.totals.intents}</p>
                  <p className="text-xs text-slate-500 mt-1">Bilet al formu gönderimi</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-6">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 rounded-lg bg-green-50">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    </div>
                    <span className="text-sm font-medium text-slate-500">Satın Alma</span>
                  </div>
                  <p className="text-2xl font-bold text-slate-900">{data.totals.completed}</p>
                  <p className="text-xs text-slate-500 mt-1">Tamamlanan sipariş</p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <div className="p-4 border-b border-slate-200 flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-slate-600" />
                  <h2 className="font-semibold text-slate-900">Etkinlik Bazlı Huni</h2>
                </div>
                {data.funnel.length === 0 ? (
                  <div className="p-12 text-center text-slate-500">
                    Bu periyotta henüz veri yok. Etkinlik sayfaları ziyaret edildikçe veriler
                    oluşacaktır.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50">
                          <th className="text-left p-4 text-sm font-medium text-slate-700">
                            Etkinlik
                          </th>
                          <th className="text-right p-4 text-sm font-medium text-slate-700">
                            Görüntüleme
                          </th>
                          <th className="text-right p-4 text-sm font-medium text-slate-700">
                            Ödeme
                          </th>
                          <th className="text-right p-4 text-sm font-medium text-slate-700">
                            Satın Alma
                          </th>
                          <th className="text-right p-4 text-sm font-medium text-slate-700">
                            Gör.→Satın %
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.funnel.map((row) => {
                          const viewToBuy =
                            row.views > 0 ? ((row.completed / row.views) * 100).toFixed(1) : "-";
                          return (
                            <tr key={row.event_id} className="border-b border-slate-100">
                              <td className="p-4">
                                <Link
                                  href={`/etkinlik/${row.event_id}`}
                                  className="font-medium text-primary-600 hover:text-primary-700"
                                >
                                  {row.title}
                                </Link>
                                <div className="text-xs text-slate-500 mt-0.5">
                                  {row.date
                                    ? new Date(row.date).toLocaleDateString("tr-TR")
                                    : ""}
                                </div>
                              </td>
                              <td className="text-right p-4">{row.views}</td>
                              <td className="text-right p-4">{row.intents}</td>
                              <td className="text-right p-4">{row.completed}</td>
                              <td className="text-right p-4">
                                {viewToBuy === "-" ? "-" : `%${viewToBuy}`}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </AdminOnlyGuard>
  );
}
