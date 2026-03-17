"use client";

import { useState, useEffect } from "react";
import { Search, Ticket, QrCode, Eye } from "lucide-react";
import AdminOnlyGuard from "@/components/AdminOnlyGuard";
import type { Order } from "@/types/database";
import QRScanner from "@/components/QRScanner";
import { supabase } from "@/lib/supabase-client";

export default function BiletListesiPage() {
  // Auth kontrolünü basitleştir - sadece admin mi diye kontrol et
  type AdminOrder = Order & {
    events?: { title?: string; date?: string; time?: string; venue?: string };
    tickets?: { name?: string; type?: string; price?: number };
  };

  const [tickets, setTickets] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showQRScanner, setShowQRScanner] = useState(false);

  useEffect(() => {
    fetchTickets();

    const interval = setInterval(fetchTickets, 15000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  async function fetchTickets() {
    try {
      setLoading(true);

      // Supabase oturumundan access token al ve admin API'ye Bearer olarak ilet.
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) {
        console.error("Supabase session error:", error);
        setTickets([]);
        return;
      }

      const token = session?.access_token;
      if (!token) {
        console.warn("Admin sipariş listesi için oturum bulunamadı.");
        setTickets([]);
        return;
      }

      const response = await fetch("/api/orders", {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        console.error("Siparişler çekilemedi:", await response.text());
        setTickets([]);
        return;
      }

      const data = (await response.json()) as AdminOrder[];
      setTickets(data || []);
    } catch (error) {
      console.error("Beklenmedik hata:", error);
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }

  const filteredTickets = tickets.filter(ticket => 
    ticket.ticket_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ticket.events?.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ticket.buyer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ticket.buyer_email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  function handleQRScan(code: string) {
    setShowQRScanner(false);
    // Yönlendirme yap
    window.location.href = `/yonetim/bilet-kontrol?code=${code}`;
  }

  // Sadece admin ve controller erişebilir - kontrolü devre dışı bırak
  // if (!isAdmin && !isController) {
  //   return (
  //     <div className="p-8">
  //       <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
  //         <Ticket className="h-12 w-12 text-red-600 mx-auto mb-4" />
  //         <h2 className="text-lg font-semibold text-red-800 mb-2">
  //           Erişim Reddedildi
  //         </h2>
  //         <p className="text-red-600">
  //           Bu sayfaya sadece yöneticiler ve kontrolörler erişebilir.
  //         </p>
  //       </div>
  //     </div>
  //   );
  // }

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
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-5">
          <h1 className="text-xl font-bold text-slate-900">
            Siparişler
          </h1>
          <div className="flex gap-3">
            <button
              onClick={() => setShowQRScanner(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700"
            >
              <QrCode className="h-4 w-4" />
              QR Tara
            </button>
          </div>
        </div>

        {/* Arama */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Bilet kodu, etkinlik adı veya alıcı ara..."
              className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-300 rounded-lg focus:border-primary-500 focus:ring-primary-500"
            />
          </div>
        </div>

        {/* Bilet Tablosu */}
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left p-4 text-sm font-medium text-slate-700">Bilet Kodu</th>
                  <th className="text-left p-4 text-sm font-medium text-slate-700">Etkinlik</th>
                  <th className="text-left p-4 text-sm font-medium text-slate-700">Bilet Türü</th>
                  <th className="text-left p-4 text-sm font-medium text-slate-700">Alıcı</th>
                  <th className="text-left p-4 text-sm font-medium text-slate-700">Adet</th>
                  <th className="text-left p-4 text-sm font-medium text-slate-700">Tutar</th>
                  <th className="text-left p-4 text-sm font-medium text-slate-700">Durum</th>
                  <th className="text-left p-4 text-sm font-medium text-slate-700">İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {filteredTickets.map((ticket) => (
                  <tr key={ticket.id} className="border-b border-slate-100">
                    <td className="p-4 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium text-slate-900">
                          {ticket.ticket_code}
                        </span>
                        <button
                          onClick={() => window.location.href = `/yonetim/bilet-kontrol?code=${ticket.ticket_code}`}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                          title="Kontrol Et"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                    <td className="p-4 text-sm text-slate-900">
                      <div className="font-medium">
                        {ticket.events?.title || 'Bilinmeyen Etkinlik'}
                      </div>
                      <div className="text-xs text-slate-500">
                        {ticket.events?.date ? new Date(ticket.events.date).toLocaleDateString('tr-TR') : 'Tarih belirtilmemiş'}
                      </div>
                    </td>
                    <td className="p-4 text-sm text-slate-900">
                      <div>
                        <div className="font-medium">
                          {ticket.tickets?.name || 'Standart Bilet'}
                        </div>
                        <div className="text-xs text-slate-500">
                          {ticket.tickets?.price ? `€${Number(ticket.tickets.price).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Fiyat belirtilmemiş'}
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-sm text-slate-900">
                      <div>
                        <div className="font-medium">
                          {ticket.buyer_name && ticket.buyer_name !== 'Bilet Alıcı' 
                            ? ticket.buyer_name 
                            : 'Bilinmeyen Alıcı'
                          }
                        </div>
                        <div className="text-xs text-slate-500">
                          {ticket.buyer_email && !ticket.buyer_email.includes('example.com')
                            ? ticket.buyer_email
                            : 'E-posta belirtilmemiş'
                          }
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-sm text-slate-900">
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded font-medium">
                        {ticket.quantity} adet
                      </span>
                    </td>
                    <td className="p-4 text-sm font-medium text-slate-900">
                      €{Number(ticket.total_price).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="p-4 text-sm">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        ticket.checked_at 
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {ticket.checked_at ? 'Giriş yapıldı' : 'Kullanılmadı'}
                      </span>
                    </td>
                    <td className="p-4 text-sm">
                      <div className="flex gap-2">
                        <button
                          onClick={() => window.location.href = `/yonetim/bilet-kontrol?code=${ticket.ticket_code}`}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                          title="Kontrol Et"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {filteredTickets.length === 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
            <Ticket className="h-10 w-10 text-slate-400 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-900 mb-1">
              Sipariş Bulunamadı
            </h3>
            <p className="text-sm text-slate-500">
              {searchTerm 
                ? "Arama kriterlerinize uygun sipariş bulunamadı."
                : "Henüz sipariş bulunmuyor."
              }
            </p>
          </div>
        )}

        {/* QR Scanner Modal */}
        {showQRScanner && (
          <QRScanner
            onScan={handleQRScan}
            onClose={() => setShowQRScanner(false)}
          />
        )}
      </div>
    </div>
    </AdminOnlyGuard>
  );
}
