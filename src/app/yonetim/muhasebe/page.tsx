"use client";

import { useState, useEffect } from "react";
import type { Order } from "@/types/database";
import AdminOnlyGuard from "@/components/AdminOnlyGuard";
import { BarChart3, TrendingUp, Calendar, CreditCard } from "lucide-react";
import AdminKPIDashboard from "@/components/AdminKPIDashboard";

export default function MuhasebePage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalOrders: 0,
    monthlyRevenue: 0,
    monthlyOrders: 0,
    checkedCount: 0,
    recentOrders: [] as Order[]
  });

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    try {
      const response = await fetch("/api/orders", { cache: "no-store" });
      if (!response.ok) {
        console.error("Muhasebe verileri çekilemedi:", await response.text());
        return;
      }

      const orders = (await response.json()) as Order[];
      if (orders) {
        const ordersList = (orders ?? []) as Order[];
        const totalRevenue = ordersList.reduce((sum: number, order: Order) => sum + Number(order.total_price), 0);
        const totalOrders = ordersList.length;
        const checkedCount = ordersList.filter((order: Order) => order.checked_at).length;

        // Bu ayki gelir ve siparişler
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        
        const monthlyOrders = ordersList.filter((order: Order) => {
          const orderDate = new Date(order.created_at);
          return orderDate.getMonth() === currentMonth && orderDate.getFullYear() === currentYear;
        });
        
        const monthlyRevenue = monthlyOrders.reduce((sum: number, order: Order) => sum + Number(order.total_price), 0);

        setStats({
          totalRevenue,
          totalOrders,
          monthlyRevenue,
          monthlyOrders: monthlyOrders.length,
          checkedCount,
          recentOrders: ordersList.slice(0, 10) // Son 10 sipariş
        });
      }
    } catch (error) {
      console.error("Muhasebe sayfası hatası:", error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center text-slate-500">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <AdminOnlyGuard>
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-900 mb-6">
          Muhasebe ve Finansal Raporlar
        </h1>

        {/* KPI Özeti */}
        <div className="mb-8">
          <AdminKPIDashboard />
        </div>

        {/* İstatistik Kartları */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Toplam Gelir</p>
                <p className="text-2xl font-bold text-slate-900">
                  €{stats.totalRevenue.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <CreditCard className="h-8 w-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Toplam Sipariş</p>
                <p className="text-2xl font-bold text-slate-900">
                  {stats.totalOrders}
                </p>
              </div>
              <BarChart3 className="h-8 w-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Bu Ay Gelir</p>
                <p className="text-2xl font-bold text-slate-900">
                  €{stats.monthlyRevenue.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-600" />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Kontrol Edilen</p>
                <p className="text-2xl font-bold text-slate-900">
                  {stats.checkedCount}
                </p>
              </div>
              <Calendar className="h-8 w-8 text-orange-600" />
            </div>
          </div>
        </div>

        {/* Son Siparişler */}
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="p-6 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">Son Siparişler</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left p-4 text-sm font-medium text-slate-700">Sipariş Kodu</th>
                  <th className="text-left p-4 text-sm font-medium text-slate-700">Alıcı</th>
                  <th className="text-left p-4 text-sm font-medium text-slate-700">Miktar</th>
                  <th className="text-left p-4 text-sm font-medium text-slate-700">Toplam</th>
                  <th className="text-left p-4 text-sm font-medium text-slate-700">Durum</th>
                  <th className="text-left p-4 text-sm font-medium text-slate-700">Tarih</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentOrders.map((order, index) => (
                  <tr key={`order-${order.id || index}-${index}`} className="border-b border-slate-100">
                    <td className="p-4 text-sm font-mono text-slate-900">{order.ticket_code}</td>
                    <td className="p-4 text-sm text-slate-900">{order.buyer_name || '-'}</td>
                    <td className="p-4 text-sm text-slate-900">{order.quantity}</td>
                    <td className="p-4 text-sm font-medium text-slate-900">
                      €{Number(order.total_price).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="p-4 text-sm">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                        order.status === 'completed' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {order.status === 'completed' ? 'Tamamlandı' : 'Beklemede'}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-slate-900">
                      {new Date(order.created_at).toLocaleString('tr-TR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
    </AdminOnlyGuard>
  );
}
