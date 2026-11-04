"use client";

import { useState, useEffect } from "react";
import { BarChart3, Ticket, Euro, Calendar, Wallet } from "lucide-react";
import OrganizerOrAdminGuard from "@/components/OrganizerOrAdminGuard";
import { supabase } from "@/lib/supabase-client";

type PayoutRow = {
  eventId: string;
  title: string;
  date: string;
  venue: string;
  currency: string;
  orders: number;
  tickets: number;
  gross: number;
  commissionRate: number | null;
  commissionGross: number;
  commissionTax: number;
  commissionNet: number;
  payout: number;
};

type PayoutTotals = {
  events: number;
  orders: number;
  tickets: number;
  gross: number;
  commissionGross: number;
  payout: number;
};

const money = (value: number) =>
  `€${Number(value || 0).toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function SatisRaporuPage() {
  const [rows, setRows] = useState<PayoutRow[]>([]);
  const [totals, setTotals] = useState<PayoutTotals | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPayouts();
  }, []);

  async function fetchPayouts() {
    try {
      setLoading(true);
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const headers: HeadersInit = { "Cache-Control": "no-store" };
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
      const res = await fetch("/api/organizer/payouts", { cache: "no-store", headers });
      if (!res.ok) {
        setRows([]);
        setTotals(null);
        return;
      }
      const data = (await res.json()) as { rows?: PayoutRow[]; totals?: PayoutTotals };
      setRows(Array.isArray(data.rows) ? data.rows : []);
      setTotals(data.totals || null);
    } catch {
      setRows([]);
      setTotals(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <OrganizerOrAdminGuard>
      <div className="p-8">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Satış Raporu</h1>
          <p className="text-slate-600 mb-8">
            Etkinliklerinize ait satış, komisyon ve size kalan tutar. Test siparişleri sayılmaz.
          </p>

          {loading ? (
            <div className="text-center text-slate-500 py-12">Yükleniyor...</div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
                <div className="bg-white rounded-xl border border-slate-200 p-6">
                  <div className="flex items-center gap-2 text-slate-600 mb-1">
                    <Ticket className="h-5 w-5" />
                    <span className="text-sm font-medium">Satılan Bilet</span>
                  </div>
                  <p className="text-2xl font-bold text-slate-900">{totals?.tickets ?? 0}</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-6">
                  <div className="flex items-center gap-2 text-slate-600 mb-1">
                    <Euro className="h-5 w-5" />
                    <span className="text-sm font-medium">Toplam Ciro</span>
                  </div>
                  <p className="text-2xl font-bold text-slate-900">{money(totals?.gross ?? 0)}</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-6">
                  <div className="flex items-center gap-2 text-slate-600 mb-1">
                    <BarChart3 className="h-5 w-5" />
                    <span className="text-sm font-medium">Komisyon</span>
                  </div>
                  <p className="text-2xl font-bold text-slate-900">
                    {money(totals?.commissionGross ?? 0)}
                  </p>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-6">
                  <div className="flex items-center gap-2 text-slate-600 mb-1">
                    <Wallet className="h-5 w-5" />
                    <span className="text-sm font-medium">Size Kalan</span>
                  </div>
                  <p className="text-2xl font-bold text-emerald-700">{money(totals?.payout ?? 0)}</p>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-200 flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-slate-600" />
                  <h2 className="font-semibold text-slate-900">Etkinlik Bazında</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="text-left p-3 text-sm font-medium text-slate-700">Etkinlik</th>
                        <th className="text-right p-3 text-sm font-medium text-slate-700">Bilet</th>
                        <th className="text-right p-3 text-sm font-medium text-slate-700">Ciro</th>
                        <th className="text-right p-3 text-sm font-medium text-slate-700">Komisyon %</th>
                        <th className="text-right p-3 text-sm font-medium text-slate-700">Komisyon</th>
                        <th className="text-right p-3 text-sm font-medium text-slate-700">Size Kalan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.eventId} className="border-b border-slate-100">
                          <td className="p-3 text-sm text-slate-900">
                            <div className="font-medium">{row.title}</div>
                            <div className="text-xs text-slate-500">
                              {row.date
                                ? new Date(row.date).toLocaleDateString("de-DE")
                                : "—"}
                              {row.venue ? ` · ${row.venue}` : ""}
                            </div>
                          </td>
                          <td className="p-3 text-sm text-right font-medium">{row.tickets}</td>
                          <td className="p-3 text-sm text-right font-medium">{money(row.gross)}</td>
                          <td className="p-3 text-sm text-right text-slate-600">
                            {row.commissionRate === null ? "—" : `%${row.commissionRate}`}
                          </td>
                          <td className="p-3 text-sm text-right text-slate-600">
                            {row.commissionGross > 0 ? money(row.commissionGross) : "—"}
                          </td>
                          <td className="p-3 text-sm text-right font-semibold text-emerald-700">
                            {money(row.payout)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {rows.length === 0 && (
                  <div className="p-8 text-center text-slate-500 text-sm">
                    Henüz satış bulunmuyor.
                  </div>
                )}
              </div>

              <p className="mt-4 text-xs text-slate-500">
                Komisyon brüt ciro üzerinden hesaplanır; komisyonun içindeki %19 KDV ayrıca
                düşülür. Oran tanımlı olmayan (kendi) etkinliklerde komisyon alınmaz.
              </p>
            </>
          )}
        </div>
      </div>
    </OrganizerOrAdminGuard>
  );
}
