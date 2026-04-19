"use client";

import { useState, useEffect, useRef, useLayoutEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search as SearchIcon, Ticket, QrCode, Eye, ChevronDown } from "lucide-react";
import AdminOnlyGuard from "@/components/AdminOnlyGuard";
import type { Order } from "@/types/database";
import QRScanner from "@/components/QRScanner";
import { supabase } from "@/lib/supabase-client";

export default function BiletListesiPage() {
  // Auth kontrolünü basitleştir - sadece admin mi diye kontrol et
  type AdminOrder = Order & {
    order_number?: string;
    events?: { title?: string; date?: string; time?: string; venue?: string };
    tickets?: { name?: string; type?: string; price?: number };
    order_seats?: { id?: string; seat_id?: string; section_name?: string; row_label?: string; seat_label?: string; ticket_code?: string }[];
  };

  const router = useRouter();
  const [tickets, setTickets] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  /** Portal menü: konum + taşmada maxHeight (kaydırma çubuğu gizli) */
  const [orderMenuLayout, setOrderMenuLayout] = useState<{
    top: number;
    left: number;
    maxHeight?: number;
  } | null>(null);
  const orderMenuButtonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const orderMenuPanelRef = useRef<HTMLDivElement | null>(null);

  const MENU_WIDTH_PX = 224; // w-56

  const closeOrderMenu = useCallback(() => {
    setExpandedOrder(null);
    setOrderMenuLayout(null);
  }, []);

  const expandedMenuSeatCount = useMemo(() => {
    if (!expandedOrder) return 0;
    const o = tickets.find((t) => t.id === expandedOrder);
    if (!o) return 0;
    if (o.order_seats && o.order_seats.length > 0) return o.order_seats.length;
    return 1;
  }, [expandedOrder, tickets]);

  const updateOrderMenuLayout = useCallback(() => {
    const id = expandedOrder;
    if (!id) return;
    const btn = orderMenuButtonRefs.current.get(id);
    const panel = orderMenuPanelRef.current;
    if (!btn || !panel) return;

    const r = btn.getBoundingClientRect();
    const left = Math.min(
      Math.max(8, r.right - MENU_WIDTH_PX),
      window.innerWidth - MENU_WIDTH_PX - 8
    );

    const margin = 8;
    const gap = 6;
    const vh = window.innerHeight - 2 * margin;
    const naturalH = panel.scrollHeight;

    const spaceBelow = window.innerHeight - r.bottom - margin;
    const spaceAbove = r.top - margin;

    let top: number;
    let maxHeight: number | undefined;

    if (naturalH + gap <= spaceBelow) {
      top = r.bottom + gap;
    } else if (naturalH + gap <= spaceAbove) {
      top = r.top - naturalH - gap;
    } else if (naturalH <= vh) {
      top = margin;
    } else {
      top = margin;
      maxHeight = vh;
    }

    setOrderMenuLayout({ top, left, maxHeight });
  }, [expandedOrder]);

  const getInitialMenuLayout = useCallback((orderId: string) => {
    const btn = orderMenuButtonRefs.current.get(orderId);
    if (!btn) return null;
    const r = btn.getBoundingClientRect();
    const left = Math.min(
      Math.max(8, r.right - MENU_WIDTH_PX),
      window.innerWidth - MENU_WIDTH_PX - 8
    );
    return { top: r.bottom + 6, left };
  }, []);

  useLayoutEffect(() => {
    if (!expandedOrder) return;
    updateOrderMenuLayout();
  }, [expandedOrder, expandedMenuSeatCount, updateOrderMenuLayout]);

  useLayoutEffect(() => {
    if (!expandedOrder) return;
    const onResize = () => updateOrderMenuLayout();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [expandedOrder, updateOrderMenuLayout]);

  useEffect(() => {
    if (!expandedOrder) return;
    const onScroll = () => closeOrderMenu();
    window.addEventListener("scroll", onScroll, true);
    return () => window.removeEventListener("scroll", onScroll, true);
  }, [expandedOrder, closeOrderMenu]);

  /** Tam ekran overlay yok: kaydırma çubuğuna tıklanınca kapanmayı önlemek için */
  useEffect(() => {
    if (!expandedOrder) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (orderMenuPanelRef.current?.contains(t)) return;
      const btn = orderMenuButtonRefs.current.get(expandedOrder);
      if (btn?.contains(t)) return;
      closeOrderMenu();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [expandedOrder, closeOrderMenu]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeOrderMenu();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeOrderMenu]);

  useEffect(() => {
    if (!expandedOrder) return;
    if (!tickets.some((t) => t.id === expandedOrder)) closeOrderMenu();
  }, [expandedOrder, tickets, closeOrderMenu]);

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

  const filteredTickets = tickets.filter(ticket => {
    const searchLower = searchTerm.toLowerCase();
    // Tüm bilet kodlarını topla
    const seatCodes = ticket.order_seats?.map(s => s.ticket_code).filter(Boolean) || [];
    const allCodes = [ticket.ticket_code, ...seatCodes].filter(Boolean);
    
    return (
      // Sipariş No
      ticket.order_number?.toLowerCase().includes(searchLower) ||
      // Sipariş ID
      ticket.id?.toLowerCase().includes(searchLower) ||
      // Bilet kodları
      allCodes.some(code => code?.toLowerCase().includes(searchLower)) ||
      // Etkinlik adı
      ticket.events?.title?.toLowerCase().includes(searchLower) ||
      // Alıcı bilgileri
      ticket.buyer_name?.toLowerCase().includes(searchLower) ||
      ticket.buyer_email?.toLowerCase().includes(searchLower)
    );
  });

  function handleQRScan(code: string) {
    setShowQRScanner(false);
    // Yönlendirme yap
    router.push(`/yonetim/bilet-kontrol?code=${code}`);
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

  const menuOrder = expandedOrder ? tickets.find((t) => t.id === expandedOrder) : undefined;
  const menuSeatCodes =
    menuOrder && menuOrder.order_seats && menuOrder.order_seats.length > 0
      ? menuOrder.order_seats
      : menuOrder
        ? [{ ticket_code: menuOrder.ticket_code }]
        : [];

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
            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Sipariş no, bilet kodu, etkinlik adı veya alıcı ara..."
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
                  <th className="text-left p-4 text-sm font-medium text-slate-700">Sipariş No</th>
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
                {filteredTickets.map((ticket) => {
                  // Her bilet için ayrı kodları hazırla
                  const seatCodes = ticket.order_seats && ticket.order_seats.length > 0 
                    ? ticket.order_seats 
                    : [{ ticket_code: ticket.ticket_code }];
                  
                  return (
                  <tr key={ticket.id} className="border-b border-slate-100">
                    <td className="p-4 text-sm">
                      <span className="font-mono font-medium text-slate-900">
                        {ticket.order_number || `#${ticket.id?.slice(0, 8)}`}
                      </span>
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
                      {seatCodes.length <= 1 ? (
                        // Tek bilet - direkt kontrol butonu
                        <button
                          onClick={() => router.push(`/yonetim/bilet-kontrol?code=${seatCodes[0]?.ticket_code || ticket.ticket_code}`)}
                          className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                          title="Kontrol Et"
                        >
                          <Eye className="h-3 w-3" />
                          Kontrol
                        </button>
                      ) : (
                        <div className="relative">
                          <button
                            type="button"
                            ref={(el) => {
                              const id = ticket.id;
                              if (!id) return;
                              if (el) orderMenuButtonRefs.current.set(id, el);
                              else orderMenuButtonRefs.current.delete(id);
                            }}
                            onClick={() => {
                              const id = ticket.id;
                              if (!id) return;
                              if (expandedOrder === id) {
                                closeOrderMenu();
                                return;
                              }
                              setExpandedOrder(id);
                              const initial = getInitialMenuLayout(id);
                              if (initial) setOrderMenuLayout(initial);
                            }}
                            className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                          >
                            <Eye className="h-3 w-3" />
                            Kontrol
                            <ChevronDown
                              className={`h-3 w-3 transition-transform ${expandedOrder === ticket.id ? "rotate-180" : ""}`}
                            />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                  );
                })}
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

        {typeof document !== "undefined" &&
          expandedOrder &&
          orderMenuLayout &&
          menuSeatCodes.length > 0 &&
          createPortal(
            <div
              ref={orderMenuPanelRef}
              className={`fixed z-[500] w-56 rounded-lg border border-slate-200 bg-white py-1 shadow-xl ${
                orderMenuLayout.maxHeight != null ? "overflow-y-auto scrollbar-hide" : "overflow-visible"
              }`}
              style={{
                top: orderMenuLayout.top,
                left: orderMenuLayout.left,
                ...(orderMenuLayout.maxHeight != null
                  ? { maxHeight: orderMenuLayout.maxHeight }
                  : {}),
              }}
              role="menu"
            >
              {menuSeatCodes.map((seat, idx) => (
                <Link
                  key={idx}
                  href={`/yonetim/bilet-kontrol?code=${seat.ticket_code || menuOrder?.ticket_code}`}
                  className="flex items-center justify-between gap-2 px-3 py-2.5 text-xs hover:bg-slate-50 border-b border-slate-100 last:border-0"
                  onClick={closeOrderMenu}
                >
                  <span className="font-mono text-slate-800 break-all">
                    {seat.ticket_code || menuOrder?.ticket_code}
                  </span>
                  {seat.row_label ? (
                    <span className="shrink-0 text-slate-400">
                      {seat.section_name} · Sıra {seat.row_label}
                    </span>
                  ) : null}
                </Link>
              ))}
            </div>,
            document.body
          )}
      </div>
    </div>
    </AdminOnlyGuard>
  );
}
