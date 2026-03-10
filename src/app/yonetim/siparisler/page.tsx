"use client";

import { useState, useEffect } from "react";
import type { Order } from "@/types/database";
import { CreditCard, Search, Filter, Download } from "lucide-react";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";
import AdminOnlyGuard from "@/components/AdminOnlyGuard";
import { supabase } from "@/lib/supabase-client";

export default function SiparislerPage() {
  const { isAdmin, loading: authLoading } = useSimpleAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    if (!isAdmin) return;
    fetchOrders();
  }, [isAdmin]);

  async function fetchOrders() {
    try {
      let query = supabase
        .from("orders")
        .select(`
          *,
          events (
            title,
            date,
            venue,
            location
          ),
          tickets (
            name,
            type,
            price
          )
        `)
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data } = await query;
      if (data) setOrders(data);
    } catch (error) {
      console.error("Orders fetch error:", error);
    } finally {
      setLoading(false);
    }
  }

  const filteredOrders = orders.filter(order => 
    (order as any).events?.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (order as any).tickets?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.buyer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.buyer_email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (authLoading || loading) {
    return (
      <div className="p-8">
        <div className="text-center text-slate-500">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <AdminOnlyGuard>
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">
          Sipariş Yönetimi
        </h1>
        <p className="text-slate-600 mb-8">
          Tüm sipariş kayıtlarını görüntüleyin ve yönetin.
        </p>

        {/* Filtreler */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Sipariş ara..."
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:border-primary-500 focus:ring-primary-500"
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:border-primary-500 focus:ring-primary-500"
              >
                <option value="all">Tüm Durumlar</option>
                <option value="completed">Tamamlandı</option>
                <option value="pending">Bekliyor</option>
                <option value="cancelled">İptal Edildi</option>
              </select>
            </div>
            <button className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">
              <Download className="h-4 w-4" />
              Excel İndir
            </button>
          </div>
        </div>

        {/* Sipariş Tablosu */}
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left p-4 text-sm font-medium text-slate-700">Sipariş No</th>
                  <th className="text-left p-4 text-sm font-medium text-slate-700">Etkinlik</th>
                  <th className="text-left p-4 text-sm font-medium text-slate-700">Bilet</th>
                  <th className="text-left p-4 text-sm font-medium text-slate-700">Alıcı</th>
                  <th className="text-left p-4 text-sm font-medium text-slate-700">Adet</th>
                  <th className="text-left p-4 text-sm font-medium text-slate-700">Tutar</th>
                  <th className="text-left p-4 text-sm font-medium text-slate-700">Durum</th>
                  <th className="text-left p-4 text-sm font-medium text-slate-700">Tarih</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order, index) => (
                  <tr key={order.id} className="border-b border-slate-100">
                    <td className="p-4 text-sm text-slate-900">
                      #{order.id.toString().slice(-6)}
                    </td>
                    <td className="p-4 text-sm text-slate-900">
                      <div>
                        <div className="font-medium">{(order as any).events?.title}</div>
                        <div className="text-xs text-slate-500">        
                          {new Date((order as any).events?.date).toLocaleDateString("tr-TR")} • {(order as any).events?.venue}
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-sm text-slate-900">
                      {(order as any).tickets?.name}
                      {(order as any).tickets?.type === 'vip' && ' 🌟'}
                    </td>
                    <td className="p-4 text-sm text-slate-900">
                      <div>
                        <div className="font-medium">{order.buyer_name}</div>
                        <div className="text-xs text-slate-500">{order.buyer_email}</div>
                      </div>
                    </td>
                    <td className="p-4 text-sm text-slate-900">{order.quantity}</td>
                    <td className="p-4 text-sm font-medium text-slate-900">
                      €{Number(order.total_price).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="p-4 text-sm">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        order.status === 'completed' 
                          ? 'bg-green-100 text-green-800'
                          : order.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {order.status === 'completed' ? 'Tamamlandı' : 
                         order.status === 'pending' ? 'Bekliyor' : 'İptal Edildi'}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-slate-600">
                      {new Date(order.created_at).toLocaleString("tr-TR")}
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
