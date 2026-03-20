"use client";

import { useMemo } from "react";
import {
  BarChart3,
  TrendingUp,
  ShoppingCart,
  RotateCcw,
  Percent,
  Calendar,
} from "lucide-react";

/** KPI hesabı için siparişte gerekli alanlar (tek /api/orders yanıtından beslenir). */
export type KpiOrderRow = {
  total_price?: number | null;
  created_at: string;
  status?: string | null;
};

function computeKpi(orders: KpiOrderRow[]) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 7);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const daily = orders.filter((o) => new Date(o.created_at) >= todayStart);
  const weekly = orders.filter((o) => new Date(o.created_at) >= weekStart);
  const monthly = orders.filter((o) => new Date(o.created_at) >= monthStart);

  const completed = orders.filter((o) => o.status === "completed" || !o.status);
  const cancelled = orders.filter((o) => o.status === "cancelled");

  const totalRev = orders.reduce((s, o) => s + Number(o.total_price || 0), 0);

  return {
    dailyRevenue: daily.reduce((s, o) => s + Number(o.total_price || 0), 0),
    dailyOrders: daily.length,
    weeklyRevenue: weekly.reduce((s, o) => s + Number(o.total_price || 0), 0),
    weeklyOrders: weekly.length,
    monthlyRevenue: monthly.reduce((s, o) => s + Number(o.total_price || 0), 0),
    monthlyOrders: monthly.length,
    totalRevenue: totalRev,
    totalOrders: orders.length,
    completedOrders: completed.length,
    cancelledOrders: cancelled.length,
    conversionRate: orders.length > 0 ? (completed.length / orders.length) * 100 : 0,
    returnRate: orders.length > 0 ? (cancelled.length / orders.length) * 100 : 0,
    avgOrderValue: completed.length > 0 ? totalRev / completed.length : 0,
  };
}

export default function AdminKPIDashboard({ orders }: { orders: KpiOrderRow[] }) {
  const kpi = useMemo(() => computeKpi(orders), [orders]);

  const cards = [
    {
      label: "Bugünkü Satış",
      value: `€${kpi.dailyRevenue.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      sub: `${kpi.dailyOrders} sipariş`,
      icon: Calendar,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Bu Hafta",
      value: `€${kpi.weeklyRevenue.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      sub: `${kpi.weeklyOrders} sipariş`,
      icon: TrendingUp,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      label: "Bu Ay",
      value: `€${kpi.monthlyRevenue.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      sub: `${kpi.monthlyOrders} sipariş`,
      icon: BarChart3,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
    {
      label: "Dönüşüm Oranı",
      value: `%${kpi.conversionRate.toFixed(1)}`,
      sub: `${kpi.completedOrders}/${kpi.totalOrders} tamamlandı`,
      icon: Percent,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      label: "İade Oranı",
      value: `%${kpi.returnRate.toFixed(1)}`,
      sub: `${kpi.cancelledOrders} iptal`,
      icon: RotateCcw,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      label: "Ort. Sipariş",
      value: `€${kpi.avgOrderValue.toFixed(2)}`,
      sub: "tamamlanan siparişler",
      icon: ShoppingCart,
      color: "text-slate-600",
      bg: "bg-slate-50",
    },
  ];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <div className="mb-6">
        <h2 className="text-lg font-bold text-slate-900">KPI Özeti</h2>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="rounded-lg border border-slate-100 p-4 hover:bg-slate-50/50 transition-colors"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className={`p-1.5 rounded-lg ${card.bg}`}>
                  <Icon className={`h-4 w-4 ${card.color}`} />
                </div>
                <span className="text-xs font-medium text-slate-500">{card.label}</span>
              </div>
              <p className="text-lg font-bold text-slate-900">{card.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{card.sub}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
