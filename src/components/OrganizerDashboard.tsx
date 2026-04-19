"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  TrendingUp,
  Ticket,
  Calendar,
  UserCheck,
  ChevronRight,
} from "lucide-react";
import { formatPrice } from "@/lib/formatPrice";
import type { EventCurrency } from "@/types/database";

type DashboardStats = {
  todayRevenue: number;
  todayTickets: number;
  totalRevenue: number;
  totalTickets: number;
  upcomingCount: number;
  upcomingThisWeek: number;
  checkinRate: number;
  checkinTotal: number;
  checkinCapacity: number;
};

type DailySale = { date: string; revenue: number; tickets: number };
type TicketDistribution = { name: string; value: number; type: string };
type UpcomingEvent = {
  id: string;
  title: string;
  date: string;
  venue: string;
  location?: string;
  is_approved: boolean;
  rejected_at: string | null;
  sold: number;
  capacity: number;
};
type RecentOrder = {
  id: string;
  buyer_name: string | null;
  event_title: string;
  ticket_name: string;
  ticket_type: string;
  quantity: number;
  total_price: number;
  created_at: string;
};

type DashboardData = {
  stats: DashboardStats;
  daily_sales: DailySale[];
  ticket_distribution: TicketDistribution[];
  upcoming_events: UpcomingEvent[];
  recent_orders: RecentOrder[];
};

const CHART_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ec4899", "#14b8a6", "#8b5cf6"];

export default function OrganizerDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { supabase } = await import("@/lib/supabase-client");
        const { data: { session } } = await supabase.auth.getSession();
        const headers: HeadersInit = { "Content-Type": "application/json" };
        if (session?.access_token) {
          headers.Authorization = `Bearer ${session.access_token}`;
        }
        const res = await fetch("/api/organizer/dashboard", { headers });
        if (cancelled) return;
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          setError((err as { error?: string }).error || "Veriler yüklenemedi");
          return;
        }
        const json = (await res.json()) as Partial<DashboardData>;
        if (
          !json ||
          !json.stats ||
          typeof json.stats.todayRevenue !== "number" ||
          !Array.isArray(json.daily_sales) ||
          !Array.isArray(json.ticket_distribution) ||
          !Array.isArray(json.upcoming_events) ||
          !Array.isArray(json.recent_orders)
        ) {
          if (!cancelled) setError("Panel verisi eksik veya geçersiz.");
          return;
        }
        setData(json as DashboardData);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-slate-500">Yükleniyor...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-red-800">
        {error || "Dashboard yüklenemedi."}
      </div>
    );
  }

  const { stats, daily_sales, ticket_distribution, upcoming_events, recent_orders } = data;
  const maxDailyRevenue = Math.max(1, ...daily_sales.map((d) => d.revenue));
  const totalDist = ticket_distribution.reduce((s, t) => s + t.value, 0);

  return (
    <div className="space-y-8">
      {/* KPI Kartları */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-600 mb-1">
            <TrendingUp className="h-5 w-5 text-primary-500" />
            <span className="text-sm font-medium">Bugünkü Satış Tutarı</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">
            {formatPrice(stats.todayRevenue, "EUR" as EventCurrency)}
          </p>
          <p className="text-sm text-slate-500 mt-1">Bugün satılan bilet: {stats.todayTickets}</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-600 mb-1">
            <Ticket className="h-5 w-5 text-green-500" />
            <span className="text-sm font-medium">Toplam Satış Tutarı</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">
            {formatPrice(stats.totalRevenue, "EUR" as EventCurrency)}
          </p>
          <p className="text-sm text-slate-500 mt-1">Toplam bilet: {stats.totalTickets}</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-600 mb-1">
            <Calendar className="h-5 w-5 text-amber-500" />
            <span className="text-sm font-medium">Yaklaşan Etkinlik Sayısı</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.upcomingCount} etkinlik</p>
          <p className="text-sm text-slate-500 mt-1">Bu hafta: {stats.upcomingThisWeek}</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-600 mb-1">
            <UserCheck className="h-5 w-5 text-blue-500" />
            <span className="text-sm font-medium">Check-in Oranı</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">%{stats.checkinRate}</p>
          <p className="text-sm text-slate-500 mt-1">
            Toplam giriş: {stats.checkinTotal} / {stats.checkinCapacity}
          </p>
        </div>
      </div>

      {/* Grafikler */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Günlük satış (son 30 gün)</h3>
          <div className="flex items-end gap-1 h-48">
            {daily_sales.map((d, i) => (
              <div
                key={d.date}
                className="flex-1 min-w-0 flex flex-col items-center gap-1"
                title={`${d.date}: ${formatPrice(d.revenue, "EUR" as EventCurrency)} (${d.tickets} bilet)`}
              >
                <div
                  className="w-full rounded-t bg-primary-500 hover:bg-primary-600 transition-colors"
                  style={{
                    height: `${Math.max(4, (d.revenue / maxDailyRevenue) * 100)}%`,
                    minHeight: "4px",
                  }}
                />
                <span className="text-[10px] text-slate-400 truncate w-full text-center">
                  {new Date(d.date).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit" })}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-2 text-center">Günlük gelir (€)</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Bilet türü dağılımı</h3>
          {totalDist === 0 ? (
            <p className="text-sm text-slate-500 py-8 text-center">Henüz satış yok</p>
          ) : (
            <div className="flex flex-wrap items-center gap-4">
              <div
                className="w-32 h-32 rounded-full flex-shrink-0"
                style={{
                  background: (() => {
                    let acc = 0;
                    const stops = ticket_distribution.map((t, i) => {
                      const start = (acc / totalDist) * 360;
                      acc += t.value;
                      const end = (acc / totalDist) * 360;
                      const c = CHART_COLORS[i % CHART_COLORS.length];
                      return `${c} ${start}deg ${end}deg`;
                    });
                    return `conic-gradient(${stops.join(", ")})`;
                  })(),
                }}
              />
              <div className="space-y-2">
                {ticket_distribution.map((t, i) => (
                  <div key={`${t.name}-${i}`} className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                    />
                    <span className="text-sm text-slate-700">
                      {t.name}: {t.value} ({totalDist > 0 ? Math.round((t.value / totalDist) * 100) : 0}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Listeler */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">Yaklaşan etkinlikler</h3>
            <Link
              href="/yonetim/etkinlikler"
              className="text-sm text-primary-600 hover:underline flex items-center gap-1"
            >
              Tümü <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
            {upcoming_events.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-sm">
                Yaklaşan etkinlik yok.
              </div>
            ) : (
              upcoming_events.slice(0, 8).map((ev) => (
                <Link
                  key={ev.id}
                  href={`/yonetim/etkinlikler`}
                  className="block px-5 py-3 hover:bg-slate-50 transition-colors"
                >
                  <div className="font-medium text-slate-900">{ev.title}</div>
                  <div className="text-sm text-slate-500 mt-0.5">
                    {new Date(ev.date).toLocaleDateString("tr-TR")} • {ev.venue}
                    {ev.location ? `, ${ev.location}` : ""}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-slate-600">
                      Satılan: {ev.sold} / {ev.capacity}
                    </span>
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        ev.rejected_at
                          ? "bg-red-100 text-red-800"
                          : ev.is_approved
                            ? "bg-green-100 text-green-800"
                            : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {ev.rejected_at ? "Reddedildi" : ev.is_approved ? "Onaylandı" : "İncelemede"}
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">Son siparişler</h3>
            <Link
              href="/yonetim/bilet-listesi"
              className="text-sm text-primary-600 hover:underline flex items-center gap-1"
            >
              Tümü <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {recent_orders.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-sm">
                Henüz sipariş yok.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-slate-700">Alıcı adı</th>
                    <th className="text-left px-4 py-2 font-medium text-slate-700">Etkinlik</th>
                    <th className="text-left px-4 py-2 font-medium text-slate-700">Bilet türü</th>
                    <th className="text-right px-4 py-2 font-medium text-slate-700">Adet</th>
                    <th className="text-right px-4 py-2 font-medium text-slate-700">Tutar</th>
                    <th className="text-left px-4 py-2 font-medium text-slate-700">Tarih</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recent_orders.slice(0, 10).map((order) => (
                    <tr key={order.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-2 text-slate-900">{order.buyer_name || "—"}</td>
                      <td className="px-4 py-2 text-slate-600">{order.event_title}</td>
                      <td className="px-4 py-2 text-slate-600">{order.ticket_name}</td>
                      <td className="px-4 py-2 text-right">{order.quantity}</td>
                      <td className="px-4 py-2 text-right font-medium text-slate-900">
                        {formatPrice(order.total_price, "EUR" as EventCurrency)}
                      </td>
                      <td className="px-4 py-2 text-slate-500">
                        {new Date(order.created_at).toLocaleString("tr-TR")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
