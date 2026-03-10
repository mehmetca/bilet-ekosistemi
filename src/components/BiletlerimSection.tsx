"use client";

import { useState, useEffect, useCallback } from "react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Ticket, ArrowRight, Calendar, Printer, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase-client";
import TicketPrint from "@/components/TicketPrint";
import type { EventCurrency } from "@/types/database";
import type { User } from "@supabase/supabase-js";

type OrderRow = {
  id: string;
  event_id: string;
  ticket_id: string | null;
  quantity: number;
  total_price: number;
  status: string;
  created_at: string;
  ticket_code?: string;
  buyer_name?: string;
  events?: { title?: string; date?: string; time?: string; venue?: string; location?: string; currency?: string } | null;
  tickets?: { name?: string; type?: string; price?: number } | null;
};

interface BiletlerimSectionProps {
  user: User | null;
}

export default function BiletlerimSection({ user }: BiletlerimSectionProps) {
  const t = useTranslations("panel");
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [printOrderId, setPrintOrderId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setError("Oturum bulunamadı. Lütfen çıkış yapıp tekrar giriş yapın.");
        setLoading(false);
        return;
      }
      const res = await fetch("/api/user/orders", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (res.status === 401) {
        setError("Oturum süresi dolmuş. Lütfen çıkış yapıp tekrar giriş yapın.");
        setLoading(false);
        return;
      }
      if (!res.ok) {
        setError("Siparişler yüklenemedi");
        setLoading(false);
        return;
      }
      const data = (await res.json()) as OrderRow[];
      setOrders(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Biletlerim fetch error:", e);
      setError("Siparişler yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) fetchOrders();
    else setLoading(false);
  }, [user, fetchOrders]);

  async function handleDelete(orderId: string) {
    if (!window.confirm(t("deleteTicketConfirm"))) return;
    setDeletingId(orderId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;
      const res = await fetch(`/api/user/orders/${String(orderId)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setOrders((prev) => prev.filter((o) => o.id !== orderId));
      } else {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        alert(err.error || "Bilet silinemedi");
      }
    } catch (e) {
      console.error(e);
      alert("Bilet silinemedi");
    } finally {
      setDeletingId(null);
    }
  }

  if (!user) return null;

  return (
    <section className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
      <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
        <Ticket className="h-5 w-5" />
        {t("myTickets")}
      </h2>
      {loading ? (
        <div className="text-slate-500 py-8 text-center">{t("loading")}</div>
      ) : error ? (
        <div className="py-6 text-center">
          <p className="text-amber-600 text-sm mb-2">{error}</p>
          <button
            type="button"
            onClick={fetchOrders}
            className="text-primary-600 text-sm font-medium hover:underline"
          >
            Tekrar dene
          </button>
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-8">
          <Calendar className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-600 font-medium">{t("noTickets")}</p>
          <p className="text-sm text-slate-500 mt-1">{t("noTicketsDesc")}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={fetchOrders}
              className="inline-flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 text-sm font-medium"
            >
              Yenile
            </button>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700"
            >
              {t("browseEvents")}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <div
              key={order.id}
              className="rounded-lg border border-slate-100 overflow-hidden hover:bg-slate-50"
            >
              <div className="grid grid-cols-1 md:grid-cols-[minmax(280px,1fr)_auto] gap-4 p-4 items-center">
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">
                    {order.events?.title || "—"}
                  </p>
                  <p className="text-sm text-slate-500 mt-0.5">
                    {order.events?.date && order.events?.time
                      ? `${order.events.date} ${order.events.time}`
                      : order.events?.date || "—"}
                    {order.events?.venue && ` • ${order.events.venue}`}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="text-slate-600">
                    {order.tickets?.name || order.tickets?.type || "Bilet"} × {order.quantity}
                  </span>
                  <span className="font-medium text-slate-900">
                    €{Number(order.total_price).toFixed(2)}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${
                      order.status === "completed"
                        ? "bg-green-100 text-green-800"
                        : order.status === "cancelled"
                        ? "bg-red-100 text-red-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {order.status === "completed"
                      ? t("completed")
                      : order.status === "cancelled"
                      ? t("cancelled")
                      : t("pending")}
                  </span>
                  {order.status === "completed" && order.ticket_code && (
                    <button
                      type="button"
                      onClick={() => setPrintOrderId(printOrderId === order.id ? null : order.id)}
                      className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"
                    >
                      <Printer className="h-4 w-4" />
                      {t("printTicket")}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDelete(order.id)}
                    disabled={deletingId === order.id}
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                    title={t("deleteTicket")}
                  >
                    <Trash2 className="h-4 w-4" />
                    {t("deleteTicket")}
                  </button>
                </div>
              </div>
              {printOrderId === order.id && order.ticket_code && order.status === "completed" && (
                <div className="border-t border-slate-100 bg-slate-50 p-4">
                  <TicketPrint
                    ticketCode={order.ticket_code}
                    eventTitle={order.events?.title || "—"}
                    eventDate={order.events?.date || ""}
                    eventTime={order.events?.time || ""}
                    venue={order.events?.venue || "—"}
                    location={order.events?.location || "—"}
                    buyerName={order.buyer_name || "—"}
                    quantity={order.quantity}
                    ticketType={order.tickets?.name || order.tickets?.type || "Bilet"}
                    price={order.total_price}
                    currency={(order.events?.currency as EventCurrency) || "EUR"}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
