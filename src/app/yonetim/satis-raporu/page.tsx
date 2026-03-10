"use client";

import { useState, useEffect } from "react";
import { BarChart3, Ticket, Euro, Calendar } from "lucide-react";
import OrganizerOrAdminGuard from "@/components/OrganizerOrAdminGuard";
import { supabase } from "@/lib/supabase-client";

type OrderRow = {
  id: string;
  event_id: string;
  quantity: number;
  total_price: number;
  status: string;
  created_at: string;
  events?: { title?: string; date?: string; venue?: string };
};

export default function SatisRaporuPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders();
  }, []);

  async function fetchOrders() {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = { "Cache-Control": "no-store" };
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
      const res = await fetch("/api/organizer/orders", { cache: "no-store", headers });
      if (!res.ok) {
        setOrders([]);
        return;
      }
      const data = (await res.json()) as OrderRow[];
      setOrders(data || []);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }

  const completed = orders.filter((o) => o.status === "completed" || !o.status);
  const totalRevenue = completed.reduce((sum, o) => sum + Number(o.total_price || 0), 0);
  const totalTickets = completed.reduce((sum, o) => sum + (o.quantity || 0), 0);

  const byEvent = completed.reduce((acc, o) => {
    const key = o.event_id;
    const title = o.events?.title || "Etkinlik";
    if (!acc[key]) {
      acc[key] = { title, revenue: 0, count: 0 };
    }
    acc[key].revenue += Number(o.total_price || 0);
    acc[key].count += o.quantity || 0;
    return acc;
  }, {} as Record<string, { title: string; revenue: number; count: number }>);

  const byEventList = Object.entries(byEvent).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.revenue - a.revenue);

  return (
    <OrganizerOrAdminGuard>
      <div className="p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Satış Raporu</h1>
          <p className="text-slate-600 mb-8">Etkinliklerinize ait satış özeti.</p>

          {loading ? (
            <div className="text-center text-slate-500 py-12">Yükleniyor...</div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                <div className="bg-white rounded-xl border border-slate-200 p-6">
                  <div className="flex items-center gap-2 text-slate-600 mb-1">
                    <Ticket className="h-5 w-5" />
                    <span className="text-sm font-medium">Toplam Sipariş</span>
                  </div>
                  <p className="text-2xl font-bold text-slate-900">{completed.length}</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-6">
                  <div className="flex items-center gap-2 text-slate-600 mb-1">
                    <Euro className="h-5 w-5" />
                    <span className="text-sm font-medium">Toplam Ciro</span>
                  </div>
                  <p className="text-2xl font-bold text-slate-900">
                    €{totalRevenue.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-6">
                  <div className="flex items-center gap-2 text-slate-600 mb-1">
                    <BarChart3 className="h-5 w-5" />
                    <span className="text-sm font-medium">Satılan Bilet</span>
                  </div>
                  <p className="text-2xl font-bold text-slate-900">{totalTickets}</p>
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
                        <th className="text-right p-3 text-sm font-medium text-slate-700">Bilet Adedi</th>
                        <th className="text-right p-3 text-sm font-medium text-slate-700">Ciro</th>
                      </tr>
                    </thead>
                    <tbody>
                      {byEventList.map((row) => (
                        <tr key={row.id} className="border-b border-slate-100">
                          <td className="p-3 text-sm text-slate-900">{row.title}</td>
                          <td className="p-3 text-sm text-right font-medium">{row.count}</td>
                          <td className="p-3 text-sm text-right font-medium">
                            €{row.revenue.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {byEventList.length === 0 && (
                  <div className="p-8 text-center text-slate-500 text-sm">
                    Henüz satış bulunmuyor.
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </OrganizerOrAdminGuard>
  );
}
