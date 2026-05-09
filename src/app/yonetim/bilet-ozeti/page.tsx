"use client";

import { useEffect, useState } from "react";
import { Ticket, Layers, Euro, Truck, PieChart, Info } from "lucide-react";
import OrganizerOrAdminGuard from "@/components/OrganizerOrAdminGuard";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";
import { supabase } from "@/lib/supabase-client";
import { formatPrice } from "@/lib/formatPrice";
import type { OrganizerTicketSummaryEvent, OrganizerTicketSummaryResponse } from "@/types/organizer-bilet-ozeti";

export default function BiletOzetiPage() {
  const { isAdmin } = useSimpleAuth();
  const [data, setData] = useState<OrganizerTicketSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const headers: HeadersInit = { "Cache-Control": "no-store" };
        if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
        const res = await fetch("/api/organizer/bilet-ozeti", { cache: "no-store", headers });
        if (cancelled) return;
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          setError(j.error || "Veriler yüklenemedi");
          return;
        }
        const json = (await res.json()) as OrganizerTicketSummaryResponse;
        setData(json);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Hata");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const s = data?.summary;

  return (
    <OrganizerOrAdminGuard>
      <div className="p-8">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-2xl font-bold text-slate-900 mb-1">Bilet özeti</h1>
          <p className="text-slate-600 mb-6">
            {isAdmin
              ? "Tüm etkinlikler için özet (yönetici görünümü)."
              : "Yalnızca sizin oluşturduğunuz etkinlikler: satılan ve kalan biletler ile tahsilat özeti."}
          </p>

          {loading ? (
            <div className="text-center text-slate-500 py-16">Yükleniyor...</div>
          ) : error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-800">{error}</div>
          ) : (
            <>
              <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-950 flex gap-3">
                <Info className="h-5 w-5 shrink-0 text-amber-700 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-900">Kesintiler ve net hakediş</p>
                  <p className="mt-1 text-amber-900/90">
                    Ödeme altyapısı (Stripe) işlem ücretleri ve anlaşmaya bağlı komisyonlar bu ekranda tutulmaz;
                    net ödemeniz için Stripe / muhasebe kayıtlarınıza bakın. Aşağıdaki tutarlar müşteriden tahsil
                    edilen sipariş tutarlarıdır; <strong>tahmini bilet geliri</strong> satırında yalnızca kargo /
                    basılı gönderim kalemi düşülmüştür (varsa).
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <div className="flex items-center gap-2 text-slate-600 mb-2">
                    <Ticket className="h-5 w-5" />
                    <span className="text-sm font-medium">Satılan bilet</span>
                  </div>
                  <p className="text-2xl font-bold text-slate-900">{s?.soldTickets ?? 0}</p>
                  <p className="text-xs text-slate-500 mt-1">Ödemesi tamamlanan siparişler</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <div className="flex items-center gap-2 text-slate-600 mb-2">
                    <Layers className="h-5 w-5" />
                    <span className="text-sm font-medium">Kalan bilet</span>
                  </div>
                  <p className="text-2xl font-bold text-slate-900">{s?.remainingTickets ?? 0}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Stoktan (tüm bilet türleri) · Kontenjan: {s?.capacity ?? 0}
                  </p>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <div className="flex items-center gap-2 text-slate-600 mb-2">
                    <PieChart className="h-5 w-5" />
                    <span className="text-sm font-medium">Doluluk</span>
                  </div>
                  <p className="text-2xl font-bold text-slate-900">
                    {s && s.capacity > 0
                      ? Math.min(100, Math.round((s.soldTickets / s.capacity) * 100))
                      : 0}
                    %
                  </p>
                  <p className="text-xs text-slate-500 mt-1">Satılan / toplam kontenjan</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <div className="flex items-center gap-2 text-slate-600 mb-2">
                    <Euro className="h-5 w-5" />
                    <span className="text-sm font-medium">Brüt tahsilat</span>
                  </div>
                  <p className="text-2xl font-bold text-slate-900">
                    {formatPrice(s?.grossRevenue ?? 0, "EUR")}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">Sipariş total_price toplamı</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <div className="flex items-center gap-2 text-slate-600 mb-2">
                    <Euro className="h-5 w-5 text-emerald-600" />
                    <span className="text-sm font-medium">Tahmini bilet geliri</span>
                  </div>
                  <p className="text-2xl font-bold text-emerald-800">
                    {formatPrice(s?.ticketRevenueApprox ?? 0, "EUR")}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">Brüt − kargo (işlem ücreti hâlâ dahil olabilir)</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <div className="flex items-center gap-2 text-slate-600 mb-2">
                    <Truck className="h-5 w-5" />
                    <span className="text-sm font-medium">Kargo / gönderim</span>
                  </div>
                  <p className="text-2xl font-bold text-slate-900">
                    {formatPrice(s?.shippingFeesTotal ?? 0, "EUR")}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">Müşteriden alınan gönderim ücreti toplamı</p>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-200">
                  <h2 className="font-semibold text-slate-900">Etkinlik bazında</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-left">
                        <th className="p-3 font-medium text-slate-700">Etkinlik</th>
                        <th className="p-3 font-medium text-slate-700">Tarih</th>
                        <th className="p-3 text-right font-medium text-slate-700">Satılan</th>
                        <th className="p-3 text-right font-medium text-slate-700">Kalan</th>
                        <th className="p-3 text-right font-medium text-slate-700">Kontenjan</th>
                        <th className="p-3 text-right font-medium text-slate-700">Brüt</th>
                        <th className="p-3 text-right font-medium text-slate-700">Kargo</th>
                        <th className="p-3 text-right font-medium text-slate-700">Tahm. bilet</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data?.events || []).map((row: OrganizerTicketSummaryEvent) => (
                        <tr key={row.eventId} className="border-b border-slate-100 hover:bg-slate-50/80">
                          <td className="p-3 text-slate-900 font-medium">{row.title}</td>
                          <td className="p-3 text-slate-600 whitespace-nowrap">
                            {row.date
                              ? new Date(row.date).toLocaleDateString("tr-TR", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })
                              : "—"}
                          </td>
                          <td className="p-3 text-right tabular-nums">{row.soldTickets}</td>
                          <td className="p-3 text-right tabular-nums">{row.remainingTickets}</td>
                          <td className="p-3 text-right tabular-nums">{row.capacity}</td>
                          <td className="p-3 text-right tabular-nums font-medium">
                            {formatPrice(row.grossRevenue, "EUR")}
                          </td>
                          <td className="p-3 text-right tabular-nums text-slate-600">
                            {formatPrice(row.shippingFeesTotal, "EUR")}
                          </td>
                          <td className="p-3 text-right tabular-nums text-emerald-800">
                            {formatPrice(row.ticketRevenueApprox, "EUR")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {(data?.events || []).length === 0 && (
                  <div className="p-10 text-center text-slate-500">Henüz etkinlik veya satış verisi yok.</div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </OrganizerOrAdminGuard>
  );
}
