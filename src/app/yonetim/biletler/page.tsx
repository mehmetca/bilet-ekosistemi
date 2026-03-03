"use client";

import { useState, useEffect } from "react";
import { Ticket, Plus, Edit2, CheckCircle, Clock } from "lucide-react";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";
import { supabase } from "@/lib/supabase-client";
import type { Ticket as TicketType } from "@/types/database";
import { TICKET_TYPE_LABELS } from "@/types/database";

export default function BiletlerPage() {
  const { isAdmin } = useSimpleAuth();
  const [tickets, setTickets] = useState<TicketType[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'tickets' | 'orders'>('tickets');

  useEffect(() => {
    if (!isAdmin) return;
    fetchData();
  }, [isAdmin]);

  async function fetchData() {
    try {
      // Tickets'leri çek
      const { data: ticketData } = await supabase
        .from("tickets")
        .select(`
          *,
          events (
            title
          )
        `)
        .order("created_at", { ascending: false });

      if (ticketData) setTickets(ticketData);

      // Orders'leri çek
      const { data: orderData } = await supabase
        .from("orders")
        .select(`
          id,
          ticket_code,
          quantity,
          total_price,
          buyer_name,
          buyer_email,
          status,
          checked_at,
          created_at,
          event_id,
          ticket_id
        `)
        .order("created_at", { ascending: false })
        .limit(50);

      if (orderData) setOrders(orderData);

    } catch (error) {
      console.error("Data fetch error:", error);
    } finally {
      setLoading(false);
    }
  }

  // Sadece admin erişebilir
  if (!isAdmin) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <Ticket className="h-12 w-12 text-red-600 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-red-800 mb-2">
            Erişim Reddedildi
          </h2>
          <p className="text-red-600">
            Bu sayfaya sadece yöneticiler erişebilir.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center text-slate-500">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-slate-900">
            Bilet Yönetimi
          </h1>
          <button
            onClick={() => window.location.href = "/yonetim"}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700"
          >
            <Plus className="h-4 w-4" />
            Yeni Bilet
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-4 mb-6 border-b border-slate-200">
          <button
            onClick={() => setActiveTab('tickets')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'tickets'
                ? 'text-primary-600 border-b-2 border-primary-600'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Bilet Listesi
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'orders'
                ? 'text-primary-600 border-b-2 border-primary-600'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Siparişler
          </button>
        </div>

        {activeTab === 'tickets' && (
          /* Bilet Listesi */
          <div className="bg-white rounded-xl border border-slate-200">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left p-4 text-sm font-medium text-slate-700">Etkinlik</th>
                    <th className="text-left p-4 text-sm font-medium text-slate-700">Bilet Adı</th>
                    <th className="text-left p-4 text-sm font-medium text-slate-700">Tür</th>
                    <th className="text-left p-4 text-sm font-medium text-slate-700">Fiyat</th>
                    <th className="text-left p-4 text-sm font-medium text-slate-700">Stok</th>
                    <th className="text-left p-4 text-sm font-medium text-slate-700">İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((ticket) => (
                    <tr key={ticket.id} className="border-b border-slate-100">
                      <td className="p-4 text-sm text-slate-900">
                        {ticket.events?.title || "-"}
                      </td>
                      <td className="p-4 text-sm text-slate-900">{ticket.name}</td>
                      <td className="p-4 text-sm text-slate-900">
                        {TICKET_TYPE_LABELS[ticket.type]}
                        {ticket.type === 'vip' && ' 🌟'}
                      </td>
                      <td className="p-4 text-sm font-medium text-slate-900">
                        €{Number(ticket.price).toLocaleString("de-DE")}
                      </td>
                      <td className="p-4 text-sm text-slate-900">{ticket.available}</td>
                      <td className="p-4 text-sm">
                        <div className="flex gap-2">
                          <button
                            onClick={() => window.location.href = `/yonetim?edit=${ticket.id}&event=${ticket.event_id}`}
                            className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => window.location.href = `/yonetim?event=${ticket.event_id}`}
                            className="p-1 text-slate-600 hover:bg-slate-50 rounded"
                          >
                            <Ticket className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'orders' && (
          /* Siparişler */
          <div className="bg-white rounded-xl border border-slate-200">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left p-4 text-sm font-medium text-slate-700">Sipariş Kodu</th>
                    <th className="text-left p-4 text-sm font-medium text-slate-700">Alıcı Adı</th>
                    <th className="text-left p-4 text-sm font-medium text-slate-700">E-posta</th>
                    <th className="text-left p-4 text-sm font-medium text-slate-700">Miktar</th>
                    <th className="text-left p-4 text-sm font-medium text-slate-700">Toplam</th>
                    <th className="text-left p-4 text-sm font-medium text-slate-700">Durum</th>
                    <th className="text-left p-4 text-sm font-medium text-slate-700">Kontrol</th>
                    <th className="text-left p-4 text-sm font-medium text-slate-700">Tarih</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id} className="border-b border-slate-100">
                      <td className="p-4 text-sm font-mono text-slate-900">{order.ticket_code}</td>
                      <td className="p-4 text-sm text-slate-900">{order.buyer_name || '-'}</td>
                      <td className="p-4 text-sm text-slate-900">{order.buyer_email || '-'}</td>
                      <td className="p-4 text-sm text-slate-900">{order.quantity}</td>
                      <td className="p-4 text-sm font-medium text-slate-900">
                        €{Number(order.total_price).toLocaleString("de-DE")}
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
                      <td className="p-4 text-sm">
                        {order.checked_at ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            <CheckCircle className="h-3 w-3" />
                            Kontrol Edildi
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                            <Clock className="h-3 w-3" />
                            Bekliyor
                          </span>
                        )}
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
        )}
      </div>
    </div>
  );
}
